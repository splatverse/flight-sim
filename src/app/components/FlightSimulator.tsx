'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AircraftConfig } from './AircraftSelection';
import HUD from './HUD';
import confetti from 'canvas-confetti';
import { Play } from 'lucide-react';

interface FlightSimulatorProps {
  aircraft: AircraftConfig;
  gameMode: 'free_flight' | 'ring_challenge' | 'landing_challenge';
  customSkinUrl?: string;
  onExit: () => void;
  onLogSaved: () => void;
  pilotName?: string;
  theme?: 'sunset' | 'synthwave' | 'daylight';
}

// Procedural Heightmap generator shared between rendering and physics
const terrainScale = 0.002;
const terrainHeightMultiplier = 180;
function getTerrainHeight(x: number, z: number): number {
  // Runway is flat at Y = 20
  // Runway is located at X: [-50, 50], Z: [-400, 400]
  if (Math.abs(x) < 80 && Math.abs(z) < 450) {
    // Smooth transition from runway to terrain
    const borderX = Math.max(0, Math.abs(x) - 40) / 40;
    const borderZ = Math.max(0, Math.abs(z) - 350) / 100;
    const blend = Math.max(borderX, borderZ);
    if (blend === 0) return 20; // Exact runway height
  }

  // Multi-layered sine wave terrain (simulated simplex noise)
  const h1 = Math.sin(x * terrainScale) * Math.cos(z * terrainScale);
  const h2 = Math.sin(x * terrainScale * 3) * Math.sin(z * terrainScale * 3) * 0.4;
  const h3 = Math.cos(x * terrainScale * 8) * Math.cos(z * terrainScale * 8) * 0.1;
  
  let rawH = (h1 + h2 + h3) / 1.5;
  // Make oceans flat
  if (rawH < -0.1) {
    return 8; // Water level
  }
  
  // Exponential scaling for peaks
  const peakHeight = Math.pow(Math.max(0, rawH + 0.1), 1.5) * terrainHeightMultiplier + 10;
  return peakHeight;
}

export default function FlightSimulator({
  aircraft,
  gameMode,
  customSkinUrl,
  onExit,
  onLogSaved,
  pilotName = 'CAPT. GUEST',
  theme = 'sunset',
}: FlightSimulatorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Game states
  const [flightState, setFlightState] = useState<'ready' | 'active' | 'crashed' | 'landed'>('ready');
  const [speed, setSpeed] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [yaw, setYaw] = useState(Math.PI); // facing runway
  const [throttle, setThrottle] = useState(0);
  const [ringsCollected, setRingsCollected] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [score, setScore] = useState(0);
  const [webglError, setWebglError] = useState<string | null>(null);

  // References for the loop (avoid state closure issues in requestAnimationFrame)
  const stateRef = useRef({
    flightState: 'ready',
    position: new THREE.Vector3(0, 21, -300), // Start on runway facing forward
    velocity: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, Math.PI, 0, 'YXZ'), // Facing north/runway direction
    throttle: 0,
    speed: 0,
    pitch: 0,
    roll: 0,
    yaw: Math.PI,
    controls: {
      pitchUp: false,
      pitchDown: false,
      rollLeft: false,
      rollRight: false,
      yawLeft: false,
      yawRight: false,
      throttleUp: false,
      throttleDown: false,
    },
    rings: [] as Array<{ pos: THREE.Vector3; active: boolean; mesh?: THREE.Mesh }>,
    ringsCollected: 0,
    timeRemaining: 90,
    totalRings: 12,
    score: 0,
    flightTime: 0,
    hasTakenOff: false,
  });

  // Web Audio state references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscNodeRef = useRef<OscillatorNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize Web Audio Engine
  const initAudio = () => {
    if (audioCtxRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Low frequency engine hum
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, ctx.currentTime);

      // Low-pass filter to make it sound like a rumble
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, ctx.currentTime);

      // Gain controls volume
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(0);

      oscNodeRef.current = osc;
      filterNodeRef.current = filter;
      gainNodeRef.current = gain;
    } catch (e) {
      console.warn('Web Audio API not supported in this browser', e);
    }
  };

  const updateAudioVolumeAndPitch = (throttlePercent: number, speedKnots: number) => {
    const ctx = audioCtxRef.current;
    const osc = oscNodeRef.current;
    const filter = filterNodeRef.current;
    const gain = gainNodeRef.current;

    if (!ctx || !osc || !filter || !gain) return;

    // Pitch increases with throttle and speed
    const baseFreq = 50 + (throttlePercent / 100) * 120 + (speedKnots / 750) * 80;
    osc.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.1);

    // Filter frequency widens at high throttle (more jet scream)
    const filterFreq = 180 + (throttlePercent / 100) * 800;
    filter.frequency.setTargetAtTime(filterFreq, ctx.currentTime, 0.1);

    // Volume depends on throttle, but adds some base vibration
    const targetVolume = flightState === 'active' || flightState === 'ready'
      ? 0.05 + (throttlePercent / 100) * 0.15
      : 0.0;
    gain.gain.setTargetAtTime(targetVolume, ctx.currentTime, 0.15);
  };

  const playBeep = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    // Quick synthesizer sound for ring completion
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  };

  const startEngine = () => {
    initAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    
    setFlightState('active');
    stateRef.current.flightState = 'active';
  };

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const c = stateRef.current.controls;
      if (e.key === 'ArrowUp' || e.key === 's' || e.key === 'S') c.pitchUp = true;
      if (e.key === 'ArrowDown' || e.key === 'w' || e.key === 'W') c.pitchDown = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') c.rollLeft = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') c.rollRight = true;
      if (e.key === 'q' || e.key === 'Q') c.yawLeft = true;
      if (e.key === 'e' || e.key === 'E') c.yawRight = true;
      if (e.key === 'Shift') c.throttleUp = true;
      if (e.key === 'Control') c.throttleDown = true;
      
      // Auto start engine on key press if ready
      if (stateRef.current.flightState === 'ready') {
        startEngine();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const c = stateRef.current.controls;
      if (e.key === 'ArrowUp' || e.key === 's' || e.key === 'S') c.pitchUp = false;
      if (e.key === 'ArrowDown' || e.key === 'w' || e.key === 'W') c.pitchDown = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') c.rollLeft = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') c.rollRight = false;
      if (e.key === 'q' || e.key === 'Q') c.yawLeft = false;
      if (e.key === 'e' || e.key === 'E') c.yawRight = false;
      if (e.key === 'Shift') c.throttleUp = false;
      if (e.key === 'Control') c.throttleDown = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [flightState]);

  // Main ThreeJS Setup & Animation Loop
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Set up renderer dimensions
    const width = mountRef.current.clientWidth || window.innerWidth;
    const height = mountRef.current.clientHeight || window.innerHeight;

    // Theme configurations
    let skyColorVal = 0x0c1424;
    let fogColorVal = 0x0c1424;
    let fogDensity = 0.00035;
    let sunColorVal = 0xfff8e7;
    let sunIntensity = 1.2;
    let ambientColorVal = 0xffffff;
    let ambientIntensity = 0.3;
    let hemiSkyColorVal = 0x00d9ff;
    let hemiGroundColorVal = 0x07090e;
    let hemiIntensity = 0.4;
    
    let cloudColorVal = 0x334155;
    let cloudOpacityVal = 0.15;
    
    let waterColorVal = 0x0f2537;
    let waterMetalness = 0.8;
    let waterRoughness = 0.1;

    let ringActiveColorHex = 0x00ffaa; // Green rings
    let markingMatColor = 0xffffff;
    let lightsGroupColor = 0x00ffaa;

    if (theme === 'sunset') {
      skyColorVal = 0x180f24;
      fogColorVal = 0x1c1228;
      fogDensity = 0.00035;
      sunColorVal = 0xff6633;
      sunIntensity = 1.6;
      ambientColorVal = 0xffb78a;
      ambientIntensity = 0.5;
      hemiSkyColorVal = 0xff9900;
      hemiGroundColorVal = 0x120c1a;
      hemiIntensity = 0.5;
      cloudColorVal = 0xff9e79;
      cloudOpacityVal = 0.25;
      waterColorVal = 0x1c102a;
      waterMetalness = 0.7;
      waterRoughness = 0.15;
      ringActiveColorHex = 0x00ffcc;
      lightsGroupColor = 0xffb700;
    } else if (theme === 'synthwave') {
      skyColorVal = 0x0a001a;
      fogColorVal = 0x0a001a;
      fogDensity = 0.00045;
      sunColorVal = 0xff00ff;
      sunIntensity = 1.8;
      ambientColorVal = 0x7b2cbf;
      ambientIntensity = 0.4;
      hemiSkyColorVal = 0x00ffff;
      hemiGroundColorVal = 0x10002b;
      hemiIntensity = 0.6;
      cloudColorVal = 0xbf55ec;
      cloudOpacityVal = 0.2;
      waterColorVal = 0x0a0014;
      waterMetalness = 0.95;
      waterRoughness = 0.05;
      ringActiveColorHex = 0x00ffff;
      markingMatColor = 0xff00ff;
      lightsGroupColor = 0x00ffff;
    } else if (theme === 'daylight') {
      skyColorVal = 0xbce7fd;
      fogColorVal = 0xbae6fd;
      fogDensity = 0.0002;
      sunColorVal = 0xfffaed;
      sunIntensity = 1.4;
      ambientColorVal = 0xffffff;
      ambientIntensity = 0.6;
      hemiSkyColorVal = 0x0ea5e9;
      hemiGroundColorVal = 0x3f6212;
      hemiIntensity = 0.4;
      cloudColorVal = 0xffffff;
      cloudOpacityVal = 0.45;
      waterColorVal = 0x0284c7;
      waterMetalness = 0.4;
      waterRoughness = 0.15;
      ringActiveColorHex = 0xff3b30;
      lightsGroupColor = 0x0ea5e9;
    }

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(skyColorVal);
    scene.fog = new THREE.FogExp2(fogColorVal, fogDensity);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.5, 8000);
    camera.position.set(0, 26, -280); // Chase camera behind start runway position

    // 3. Renderer setup with hardware acceleration fallbacks
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    } catch (e) {
      console.warn('Failed to construct WebGLRenderer with logarithmic depth, trying fallback...', e);
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: false });
      } catch (e2: any) {
        console.error('WebGL is completely unsupported or hardware acceleration is disabled:', e2);
        setWebglError('WebGL is completely unsupported or hardware acceleration is disabled in your browser.');
        return;
      }
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // 4. Lighting setup
    const ambientLight = new THREE.AmbientLight(ambientColorVal, ambientIntensity);
    scene.add(ambientLight);

    // Directional sun light
    const dirLight = new THREE.DirectionalLight(sunColorVal, sunIntensity);
    dirLight.position.set(2000, 1500, 1000);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 50;
    dirLight.shadow.camera.far = 4000;
    const d = 500;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Secondary blue sky reflection light
    const hemiLight = new THREE.HemisphereLight(hemiSkyColorVal, hemiGroundColorVal, hemiIntensity);
    scene.add(hemiLight);

    // 5. Sky & Sun sphere
    const skyGeo = new THREE.SphereGeometry(4000, 32, 15);
    // Gradient sky using vertex colors
    const skyMat = new THREE.MeshBasicMaterial({
      color: skyColorVal,
      side: THREE.BackSide,
      fog: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // 6. Volumetric clouds
    const cloudGroup = new THREE.Group();
    const cloudGeo = new THREE.SphereGeometry(80, 8, 8);
    const cloudMat = new THREE.MeshLambertMaterial({
      color: cloudColorVal,
      transparent: true,
      opacity: cloudOpacityVal,
      flatShading: true,
    });
    
    // Spawn 80 random cloud formations
    for (let i = 0; i < 80; i++) {
      const cloud = new THREE.Group();
      const numSpheres = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < numSpheres; j++) {
        const mesh = new THREE.Mesh(cloudGeo, cloudMat);
        mesh.position.set(
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 30,
          (Math.random() - 0.5) * 60
        );
        const scale = 0.5 + Math.random() * 0.8;
        mesh.scale.set(scale, scale * 0.6, scale);
        cloud.add(mesh);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 8000,
        150 + Math.random() * 450,
        (Math.random() - 0.5) * 8000
      );
      cloudGroup.add(cloud);
    }
    scene.add(cloudGroup);

    // 7. Terrain Grid and Elevation Rendering
    const terrainSegments = 120;
    const terrainSize = 8000;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    terrainGeo.rotateX(-Math.PI / 2); // Lay flat

    // Adjust heights
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getTerrainHeight(vx, vz);
      posAttr.setY(i, vy);
    }
    terrainGeo.computeVertexNormals();

    // Material with subtle green/rock shading based on height
    const terrainMat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0.15,
      vertexColors: true,
      flatShading: true,
    });

    // Color code vertices by elevation
    const colors = [];
    for (let i = 0; i < posAttr.count; i++) {
      const heightVal = posAttr.getY(i);
      const c = new THREE.Color();
      
      if (theme === 'sunset') {
        if (heightVal <= 8.5) {
          c.setHSL(0.08, 0.45, 0.35); // Warm sand coast
        } else if (heightVal < 40) {
          c.setHSL(0.07, 0.35, 0.22 + (heightVal / 40) * 0.08); // Warm orange hills
        } else if (heightVal < 100) {
          c.setHSL(0.04, 0.3, 0.15 + ((heightVal - 40) / 60) * 0.05); // Reddish mountain forest
        } else if (heightVal < 170) {
          c.setHSL(0.95, 0.2, 0.15 + ((heightVal - 100) / 70) * 0.08); // Purple rock
        } else {
          c.setHSL(0.08, 0.4, 0.75); // Golden snow cap
        }
      } else if (theme === 'synthwave') {
        if (heightVal <= 8.5) {
          c.setHSL(0.78, 0.8, 0.04); // Deep violet waterbed
        } else if (heightVal < 50) {
          c.setHSL(0.76, 0.85, 0.08 + (heightVal / 50) * 0.04); // Purple grid base
        } else if (heightVal < 120) {
          c.setHSL(0.88, 0.9, 0.1 + ((heightVal - 50) / 70) * 0.05); // Magenta slopes
        } else {
          c.setHSL(0.5, 0.9, 0.25); // Cyan peaks
        }
      } else if (theme === 'daylight') {
        if (heightVal <= 8.5) {
          c.setHSL(0.12, 0.5, 0.65); // Beach sand
        } else if (heightVal < 40) {
          c.setHSL(0.32, 0.45, 0.32 + (heightVal / 40) * 0.1); // Green meadows
        } else if (heightVal < 100) {
          c.setHSL(0.35, 0.35, 0.2 + ((heightVal - 40) / 60) * 0.05); // Dark green trees
        } else if (heightVal < 170) {
          c.setHSL(0.0, 0.0, 0.35 + ((heightVal - 100) / 70) * 0.1); // Cool grey rock
        } else {
          c.setHSL(0.0, 0.0, 0.95); // White snow caps
        }
      } else {
        if (heightVal <= 8.5) {
          c.setHSL(0.12, 0.4, 0.45);
        } else if (heightVal < 40) {
          c.setHSL(0.35, 0.35, 0.22 + (heightVal / 40) * 0.08);
        } else if (heightVal < 100) {
          c.setHSL(0.3, 0.25, 0.15 + ((heightVal - 40) / 60) * 0.05);
        } else if (heightVal < 170) {
          c.setHSL(0.0, 0.0, 0.18 + ((heightVal - 100) / 70) * 0.1);
        } else {
          c.setHSL(0.0, 0.0, 0.85);
        }
      }
      colors.push(c.r, c.g, c.b);
    }
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Water level plane (transparent ocean)
    const waterGeo = new THREE.PlaneGeometry(8000, 8000);
    const waterMat = new THREE.MeshStandardMaterial({
      color: waterColorVal,
      transparent: true,
      opacity: theme === 'synthwave' ? 0.9 : 0.8,
      roughness: waterRoughness,
      metalness: waterMetalness,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotateX(-Math.PI / 2);
    waterMesh.position.y = 8; // Sea height
    scene.add(waterMesh);

    // 8. Runway Construction
    const runwayGeo = new THREE.BoxGeometry(60, 2, 800);
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
    });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.position.set(0, 19, 0); // Flat on surface Y=20 (runway is 2 units thick, centered at Y=19 so surface is Y=20)
    runway.receiveShadow = true;
    scene.add(runway);

    // Runway markings (Dashed white lines)
    const runwayMarkingGroup = new THREE.Group();
    const markingGeo = new THREE.PlaneGeometry(2, 40);
    const markingMat = new THREE.MeshBasicMaterial({ color: markingMatColor, side: THREE.DoubleSide });
    for (let z = -350; z <= 350; z += 100) {
      if (z === 0) continue; // skip center
      const marking = new THREE.Mesh(markingGeo, markingMat);
      marking.rotation.x = -Math.PI / 2;
      marking.position.set(0, 20.05, z);
      runwayMarkingGroup.add(marking);
    }
    scene.add(runwayMarkingGroup);

    // Runway glowing boundary lights (emerald green)
    const lightsGroup = new THREE.Group();
    const lightGeo = new THREE.SphereGeometry(0.6, 6, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: lightsGroupColor });
    for (let z = -390; z <= 390; z += 50) {
      const leftLight = new THREE.Mesh(lightGeo, lightMat);
      leftLight.position.set(-29.5, 20.2, z);
      const rightLight = new THREE.Mesh(lightGeo, lightMat);
      rightLight.position.set(29.5, 20.2, z);
      lightsGroup.add(leftLight, rightLight);
    }
    scene.add(lightsGroup);

    // 9. Model Aircraft in 3D using primitives
    const aircraftGroup = new THREE.Group();
    aircraftGroup.position.set(0, 21, -300); // start at runway beginning
    scene.add(aircraftGroup);

    // Load custom texture if active
    let aircraftMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(aircraft.color),
      roughness: 0.4,
      metalness: 0.6,
    });

    if (customSkinUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        customSkinUrl,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(1, 1);
          aircraftMaterial.map = texture;
          aircraftMaterial.color = new THREE.Color(0xffffff); // Use original image colors
          aircraftMaterial.needsUpdate = true;
        },
        undefined,
        (err) => console.warn('Failed to load custom aircraft livery:', err)
      );
    }

    // Fuselage (Body cylinder)
    const bodyGeo = new THREE.CylinderGeometry(1.6, 1.0, 14, 8);
    bodyGeo.rotateX(Math.PI / 2); // point forward
    const bodyMesh = new THREE.Mesh(bodyGeo, aircraftMaterial);
    bodyMesh.castShadow = true;
    aircraftGroup.add(bodyMesh);

    // Canopy (Cockpit glass)
    const canopyGeo = new THREE.SphereGeometry(1.2, 8, 8);
    canopyGeo.scale(1, 0.8, 2);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 1.2, 1);
    aircraftGroup.add(canopyMesh);

    // Main Wings (stretched box)
    const wingGeo = new THREE.BoxGeometry(16, 0.25, 2.5);
    const wingMesh = new THREE.Mesh(wingGeo, aircraftMaterial);
    wingMesh.position.set(0, 0.1, 0);
    wingMesh.castShadow = true;
    aircraftGroup.add(wingMesh);

    // Horizontal Tail stabilizer
    const tailHGeo = new THREE.BoxGeometry(5.5, 0.15, 1.4);
    const tailHMesh = new THREE.Mesh(tailHGeo, aircraftMaterial);
    tailHMesh.position.set(0, 0.2, -5.3);
    tailHMesh.castShadow = true;
    aircraftGroup.add(tailHMesh);

    // Vertical Tail stabilizer
    const tailVGeo = new THREE.BoxGeometry(0.15, 2.8, 1.6);
    // Skew vertically
    const tailVMesh = new THREE.Mesh(tailVGeo, aircraftMaterial);
    tailVMesh.position.set(0, 1.6, -5.4);
    tailVMesh.castShadow = true;
    aircraftGroup.add(tailVMesh);

    // Propeller spinner (Biplane prop spin)
    let propellerMesh: THREE.Mesh | null = null;
    if (aircraft.id === 'stunt') {
      const spinnerGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.8, 6);
      spinnerGeo.rotateX(Math.PI / 2);
      const spinner = new THREE.Mesh(spinnerGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      spinner.position.set(0, 0, 7.3);
      aircraftGroup.add(spinner);

      const propGeo = new THREE.BoxGeometry(4.8, 0.4, 0.05);
      propellerMesh = new THREE.Mesh(propGeo, new THREE.MeshBasicMaterial({ color: 0xffb700 }));
      propellerMesh.position.set(0, 0, 7.7);
      aircraftGroup.add(propellerMesh);
    }

    // Jet Engine flame exhaust
    let exhaustFire: THREE.Mesh | null = null;
    if (aircraft.id === 'fighter') {
      const exhaustGeo = new THREE.CylinderGeometry(0.8, 0.1, 2, 8);
      exhaustGeo.rotateX(Math.PI / 2);
      const exhaustMat = new THREE.MeshBasicMaterial({
        color: 0xff3c00,
        transparent: true,
        opacity: 0.85,
      });
      exhaustFire = new THREE.Mesh(exhaustGeo, exhaustMat);
      exhaustFire.position.set(0, 0, -7.5);
      aircraftGroup.add(exhaustFire);
    }

    // 10. Floating Target Rings (Torus geometry)
    const ringTargetGroup = new THREE.Group();
    scene.add(ringTargetGroup);

    const ringGeo = new THREE.TorusGeometry(18, 1.8, 8, 24);
    const ringActiveMat = new THREE.MeshBasicMaterial({ color: ringActiveColorHex, wireframe: false });
    
    // Spawn 12 rings in a dynamic flight path loop
    const ringPathCoords = [
      new THREE.Vector3(0, 60, 400),
      new THREE.Vector3(100, 100, 1000),
      new THREE.Vector3(400, 140, 1500),
      new THREE.Vector3(800, 190, 1200),
      new THREE.Vector3(1100, 230, 600),
      new THREE.Vector3(1000, 200, -200),
      new THREE.Vector3(700, 150, -800),
      new THREE.Vector3(300, 90, -1400),
      new THREE.Vector3(-200, 110, -1600),
      new THREE.Vector3(-600, 130, -1000),
      new THREE.Vector3(-500, 80, -300),
      new THREE.Vector3(-200, 40, -100),
    ];

    stateRef.current.rings = ringPathCoords.map((pos, idx) => {
      const mesh = new THREE.Mesh(ringGeo, ringActiveMat.clone());
      mesh.position.copy(pos);
      // Orient ring to face flight direction
      let nextPos = ringPathCoords[(idx + 1) % ringPathCoords.length];
      mesh.lookAt(nextPos);
      ringTargetGroup.add(mesh);
      return { pos, active: true, mesh };
    });

    stateRef.current.totalRings = ringPathCoords.length;

    // Particle Exhaust trail simulation
    const particleCount = 25;
    const particles: Array<{ mesh: THREE.Mesh; age: number; maxAge: number; velocity: THREE.Vector3 }> = [];
    const partGeo = new THREE.DodecahedronGeometry(0.5);
    const partMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.35,
    });

    for (let i = 0; i < particleCount; i++) {
      const pm = new THREE.Mesh(partGeo, partMat.clone());
      pm.visible = false;
      scene.add(pm);
      particles.push({
        mesh: pm,
        age: 0,
        maxAge: 0,
        velocity: new THREE.Vector3(),
      });
    }

    let nextParticleIndex = 0;
    const spawnParticle = (pos: THREE.Vector3, vel: THREE.Vector3) => {
      const p = particles[nextParticleIndex];
      p.mesh.position.copy(pos);
      p.mesh.scale.set(1, 1, 1);
      // Give random jitter
      p.velocity.copy(vel).add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5
      ));
      p.age = 0;
      p.maxAge = 15 + Math.random() * 20; // frames
      p.mesh.visible = true;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.4;
      if (aircraft.id === 'fighter') {
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xff7700);
      } else {
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xcccccc);
      }
      nextParticleIndex = (nextParticleIndex + 1) % particleCount;
    };

    // 11. Physics Loop Variables
    const clock = new THREE.Clock();
    let animationFrameId: number;

    // Initial positioning variables
    const position = stateRef.current.position;
    const rotation = stateRef.current.rotation;
    const velocity = stateRef.current.velocity;

    // Align initial velocity vector facing north
    velocity.set(0, 0, 0);

    const animationLoop = () => {
      const dt = Math.min(clock.getDelta(), 0.05); // cap frame step to prevent physics blowouts
      const state = stateRef.current;
      const c = state.controls;

      // Update game timer
      if (state.flightState === 'active') {
        state.flightTime += dt;
        
        if (gameMode === 'ring_challenge') {
          state.timeRemaining -= dt;
          setTimeRemaining(Math.max(0, state.timeRemaining));
          if (state.timeRemaining <= 0) {
            // Out of time -> Trigger Crash
            setFlightState('crashed');
            state.flightState = 'crashed';
          }
        }
      }

      if (state.flightState === 'active' || state.flightState === 'ready') {
        // Adjust throttle lever input
        if (c.throttleUp) state.throttle = Math.min(100, state.throttle + 40 * dt);
        if (c.throttleDown) state.throttle = Math.max(0, state.throttle - 40 * dt);
        setThrottle(Math.round(state.throttle));

        if (state.flightState === 'active') {
          // --- FLIGHT DYNAMICS MATH SOLVER ---
          
          // 1. Control Surfaces (Pitch / Roll / Yaw rotation inputs)
          let rollRateInput = 0;
          let pitchRateInput = 0;
          let yawRateInput = 0;

          if (c.rollLeft) rollRateInput = aircraft.rollRate;
          if (c.rollRight) rollRateInput = -aircraft.rollRate;
          
          if (c.pitchUp) pitchRateInput = aircraft.pitchRate;
          if (c.pitchDown) pitchRateInput = -aircraft.pitchRate;

          if (c.yawLeft) yawRateInput = aircraft.yawRate;
          if (c.yawRight) yawRateInput = -aircraft.yawRate;

          // Apply rotation rates directly to Euler angles (damping applied for stability)
          rotation.z += rollRateInput * dt;   // roll
          rotation.x += pitchRateInput * dt;  // pitch
          rotation.y += yawRateInput * dt;    // yaw (rudder)

          // Auto-yaw on banking/rolling (realistic aerodynamic coupling)
          // Rolling causes the aircraft vector to slip, creating a coordinated turn
          const bankTurn = Math.sin(rotation.z) * 0.4 * (state.speed / 100);
          rotation.y += bankTurn * dt;

          // Keep Euler rotations bounded
          rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, rotation.x)); // don't flip upside down vertically

          // Set 3D mesh rotation
          aircraftGroup.rotation.copy(rotation);

          // 2. Compute Aerodynamic Forces
          // Extract forward, up, and right vectors from rotation matrix
          const forward = new THREE.Vector3(0, 0, 1).applyEuler(rotation); // forward direction vector
          const liftDirection = new THREE.Vector3(0, 1, 0).applyEuler(rotation); // up direction vector

          // Current forward speed (knots/unit scale)
          // Project current velocity onto forward vector
          state.speed = velocity.dot(forward);
          if (state.speed < 0) state.speed = 0;

          // Calculate Thrust force
          const maxThrustPower = aircraft.thrust / 20; // scale force for game space
          const currentThrust = (state.throttle / 100) * maxThrustPower;

          // Calculate Aerodynamic Drag (proportional to velocity squared)
          const dragMagnitude = 0.5 * Math.pow(state.speed, 2) * aircraft.dragCoeff * 0.005;
          const dragForce = forward.clone().multiplyScalar(-dragMagnitude);

          // Calculate Aerodynamic Lift (proportional to velocity squared, and angle of attack/pitch)
          // Lift is high when moving fast, and when pitch angle is slightly positive
          const angleOfAttack = rotation.x + 0.08; // slight built-in wing angle
          const liftMagnitude = 0.5 * Math.pow(state.speed, 2) * aircraft.liftCoeff * Math.max(0, angleOfAttack) * 0.05;
          const liftForce = liftDirection.clone().multiplyScalar(liftMagnitude);

          // Gravity pulling downward
          const gravityAcceleration = 9.8 * 0.15; // scaled down gravity
          const gravityForce = new THREE.Vector3(0, -gravityAcceleration * (aircraft.weight / 1000), 0);

          // Thrust force vector
          const thrustForce = forward.clone().multiplyScalar(currentThrust);

          // Net Force Vector sum
          const netForce = new THREE.Vector3()
            .add(thrustForce)
            .add(dragForce)
            .add(liftForce)
            .add(gravityForce);

          // Acceleration = Net Force / Mass
          const acceleration = netForce.divideScalar(aircraft.weight / 1000);

          // Update velocity vector
          velocity.add(acceleration);

          // Friction on ground/water
          const groundY = getTerrainHeight(position.x, position.z);
          if (position.y <= groundY + 0.5) {
            // Apply landing friction / braking
            velocity.x *= 0.95;
            velocity.z *= 0.95;
          }

          // Update position coordinates
          position.addScaledVector(velocity, dt * 50);

          // Set 3D mesh position
          aircraftGroup.position.copy(position);

          // Sync variables to states for HUD
          setSpeed(Math.round(state.speed * 2.5)); // visual scaling (knots)
          setAltitude(Math.round(position.y * 3.28)); // 1 unit = 3.28 feet
          setPitch(rotation.x);
          setRoll(rotation.z);
          setYaw(rotation.y);

          // Update Web Audio engine sound parameters
          updateAudioVolumeAndPitch(state.throttle, Math.round(state.speed * 2.5));

          // Rotate propeller if biplane
          if (propellerMesh) {
            propellerMesh.rotation.z += (state.throttle / 100) * 0.8 + 0.1;
          }

          // Modify F-18 afterburner exhaust fire scaling
          if (exhaustFire) {
            const fireScale = (state.throttle / 100) * 1.5;
            exhaustFire.scale.set(fireScale, fireScale, fireScale);
            exhaustFire.visible = state.throttle > 5;
          }

          // Spawn particle trail behind aircraft engine tail pipe
          if (state.throttle > 10 && Math.random() < 0.45) {
            const tailOffset = new THREE.Vector3(0, 0, -6.5).applyEuler(rotation);
            const emitPos = position.clone().add(tailOffset);
            const emitVel = forward.clone().multiplyScalar(-state.speed * 0.1);
            spawnParticle(emitPos, emitVel);
          }
        }
      }

      // Render Active Particles
      particles.forEach((p) => {
        if (!p.mesh.visible) return;
        p.age++;
        if (p.age >= p.maxAge) {
          p.mesh.visible = false;
        } else {
          p.mesh.position.addScaledVector(p.velocity, dt * 2);
          const ratio = 1 - p.age / p.maxAge;
          p.mesh.scale.set(ratio * 2.5, ratio * 2.5, ratio * 2.5);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.4;
        }
      });

      // Camera chasing logic: smooth interpolation behind plane
      if (state.flightState === 'active' || state.flightState === 'ready') {
        const offset = new THREE.Vector3(0, 5, -28).applyEuler(rotation); // Chase distance vector
        const targetCamPos = position.clone().add(offset);
        camera.position.lerp(targetCamPos, 0.12);
        
        // Point camera ahead of the plane
        const lookTarget = position.clone().add(new THREE.Vector3(0, 1.2, 50).applyEuler(rotation));
        camera.lookAt(lookTarget);
      }

      // --- COLLISION DETECTION & CHALLENGE CHECKS ---
      if (state.flightState === 'active') {
        const groundHeight = getTerrainHeight(position.x, position.z);

        // Update takeoff status
        if (position.y > groundHeight + 8) {
          state.hasTakenOff = true;
        }

        // 1. Terrain Collision / Landing Check
        if (position.y < groundHeight + 0.8) {
          if (state.hasTakenOff) {
            // Evaluates crash/landing if we have already taken off
            const onRunway = Math.abs(position.x) < 35 && Math.abs(position.z) < 400;
            const speedKnots = state.speed * 2.5;
            const pitchDegVal = (rotation.x * 180) / Math.PI;
            const rollDegVal = (rotation.z * 180) / Math.PI;

            const verticalSpeed = velocity.y * 10; // descent rate factor
            const isWingsLevel = Math.abs(rollDegVal) < 12;
            const isPitchSafe = pitchDegVal >= -5 && pitchDegVal <= 15;
            const isSpeedSafe = speedKnots < 95;
            const isDescentSmooth = verticalSpeed > -12;

            if (onRunway && isWingsLevel && isPitchSafe && isSpeedSafe && isDescentSmooth) {
              // Successful Landing!
              setFlightState('landed');
              state.flightState = 'landed';
              
              // Play landing fan-fare confetti!
              confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 }
              });

              // Trigger log score saving
              const finalScore = state.score + 2000; // landing bonus
              setScore(finalScore);
              state.score = finalScore;
              saveFlightLog(true, finalScore);
            } else {
              // Crash landing!
              setFlightState('crashed');
              state.flightState = 'crashed';
              saveFlightLog(false, state.score);
              
              // Visual crash fireballs
              const explosionGeo = new THREE.SphereGeometry(15, 8, 8);
              const explosionMat = new THREE.MeshBasicMaterial({ color: 0xff3c00, transparent: true, opacity: 0.9 });
              const explosion = new THREE.Mesh(explosionGeo, explosionMat);
              explosion.position.copy(position);
              scene.add(explosion);
            }
          } else {
            // Taxiing Mode: clamp to runway surface and prevent falling due to gravity
            position.y = groundHeight + 0.2;
            if (velocity.y < 0) {
              velocity.y = 0;
            }

            // Check if we rolled off the runway while taxiing
            const onRunway = Math.abs(position.x) < 35 && Math.abs(position.z) < 400;
            if (!onRunway && state.speed > 5) {
              // Crash if we roll off the runway at significant speed!
              setFlightState('crashed');
              state.flightState = 'crashed';
              saveFlightLog(false, state.score);
              
              const explosionGeo = new THREE.SphereGeometry(15, 8, 8);
              const explosionMat = new THREE.MeshBasicMaterial({ color: 0xff3c00, transparent: true, opacity: 0.9 });
              const explosion = new THREE.Mesh(explosionGeo, explosionMat);
              explosion.position.copy(position);
              scene.add(explosion);
            }
          }
        }

        // 2. Floating Target Ring Checkpoints Collisions
        state.rings.forEach((ring, idx) => {
          if (!ring.active) return;
          
          const distance = position.distanceTo(ring.pos);
          // If within ring boundary
          if (distance < 24) {
            ring.active = false;
            if (ring.mesh) {
              // Dim the ring to show it is collected
              (ring.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x334155);
              ring.mesh.scale.set(0.1, 0.1, 0.1); // shrink it
            }

            // Update scores
            state.ringsCollected += 1;
            setRingsCollected(state.ringsCollected);
            playBeep();

            // Ring collected bonus time and score
            if (gameMode === 'ring_challenge') {
              state.timeRemaining += 12; // add 12 seconds
              setTimeRemaining(state.timeRemaining);
            }
            state.score += 500;
            setScore(state.score);

            // Double check if all rings collected in Ring Challenge
            if (gameMode === 'ring_challenge' && state.ringsCollected === state.totalRings) {
              setFlightState('landed');
              state.flightState = 'landed';
              confetti({ particleCount: 150, spread: 80 });
              const finalScore = state.score + 3000; // completion bonus
              setScore(finalScore);
              state.score = finalScore;
              saveFlightLog(true, finalScore);
            }
          }
        });
      }

      // Render 3D frame
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animationLoop);
    };

    // Begin render frame loop
    animationFrameId = requestAnimationFrame(animationLoop);

    // Handle window resize dynamically
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || window.innerWidth;
      const h = mountRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Clean up Three.js objects on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        mountRef.current.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
      
      // Stop Web Audio synth
      if (oscNodeRef.current) {
        try {
          oscNodeRef.current.stop();
        } catch (e) {}
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [aircraft, gameMode, customSkinUrl, theme]);

  // Handled in main useEffect resize listener
  useEffect(() => {}, []);

  // API Call: Save flight log to MongoDB / Local Storage Fallback
  const saveFlightLog = async (landed: boolean, finalScore: number) => {
    const state = stateRef.current;
    const logData = {
      aircraft: aircraft.name,
      mode: gameMode.replace('_', ' '),
      score: finalScore,
      ringsCollected: state.ringsCollected,
      flightTime: Math.round(state.flightTime),
      landed,
      date: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/flight-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      });

      const resJson = await response.json();
      
      if (resJson.localMode || !resJson.success) {
        // Save to Local Storage Fallback
        const localLogsStr = localStorage.getItem('flight_simulator_logs');
        const localLogs = localLogsStr ? JSON.parse(localLogsStr) : [];
        localLogs.push(logData);
        localStorage.setItem('flight_simulator_logs', JSON.stringify(localLogs));
      }
    } catch (e) {
      console.error('Error reporting flight logs:', e);
      // Local Storage Fallback
      const localLogsStr = localStorage.getItem('flight_simulator_logs');
      const localLogs = localLogsStr ? JSON.parse(localLogsStr) : [];
      localLogs.push(logData);
      localStorage.setItem('flight_simulator_logs', JSON.stringify(localLogs));
    } finally {
      onLogSaved();
    }
  };

  const restartSimulation = () => {
    setFlightState('ready');
    setSpeed(0);
    setAltitude(0);
    setPitch(0);
    setRoll(0);
    setYaw(Math.PI);
    setThrottle(0);
    setRingsCollected(0);
    setTimeRemaining(90);
    setScore(0);

    const state = stateRef.current;
    state.flightState = 'ready';
    state.position.set(0, 21, -300);
    state.velocity.set(0, 0, 0);
    state.rotation.set(0, Math.PI, 0, 'YXZ');
    state.throttle = 0;
    state.speed = 0;
    state.pitch = 0;
    state.roll = 0;
    state.yaw = Math.PI;
    state.ringsCollected = 0;
    state.timeRemaining = 90;
    state.score = 0;
    state.flightTime = 0;
    state.hasTakenOff = false;
    
    // Reactivate all rings
    state.rings.forEach((ring) => {
      ring.active = true;
      if (ring.mesh) {
        const activeColorHex = theme === 'sunset' ? 0x00ffcc : theme === 'synthwave' ? 0x00ffff : theme === 'daylight' ? 0xff3b30 : 0x00ffaa;
        (ring.mesh.material as THREE.MeshBasicMaterial).color.setHex(activeColorHex);
        ring.mesh.scale.set(1, 1, 1);
      }
    });

    if (oscNodeRef.current) {
      try {
        oscNodeRef.current.frequency.setValueAtTime(60, audioCtxRef.current?.currentTime || 0);
      } catch (e) {}
    }
  };

  return (
    <div className={`theme-${theme} relative w-full h-full overflow-hidden flex flex-col justify-end bg-black`}>
      
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Cockpit HUD Visual Layer */}
      <div className="absolute inset-0 z-10">
        <HUD
          speed={speed}
          altitude={altitude}
          pitch={pitch}
          roll={roll}
          yaw={yaw}
          throttle={throttle}
          ringsCollected={ringsCollected}
          totalRings={stateRef.current.totalRings}
          timeRemaining={timeRemaining}
          gameMode={gameMode}
          onExit={onExit}
          flightState={flightState}
          radarTargets={stateRef.current.rings.map(r => ({
            x: r.pos.x,
            z: r.pos.z,
            type: 'ring' as 'ring' | 'runway',
            active: r.active,
          })).concat([{ x: 0, z: 0, type: 'runway', active: true }])}
          playerPos={{ x: stateRef.current.position.x, z: stateRef.current.position.z }}
          pilotName={pilotName}
        />
      </div>

      {/* Screen Overlay MODAL: Crash State */}
      {flightState === 'crashed' && (
        <div className="absolute inset-0 bg-red-950/45 backdrop-blur-sm z-20 flex flex-col justify-center items-center gap-6">
          <div className="text-center">
            <h2 className="font-digital text-6xl text-rose-500 glow-red animate-pulse mb-3">CRASH DETECTED</h2>
            <p className="font-tech text-xl text-white uppercase tracking-widest">AIRFRAME HULL INTEGRITY COMPROMISED</p>
          </div>

          <div className="font-tech text-muted text-center flex flex-col gap-1 text-sm bg-black/60 p-4 border border-rose-500/20 rounded">
            <span>FLIGHT SCORE: <strong className="text-white font-digital">{score}</strong></span>
            <span>RINGS PASSED: <strong className="text-white font-digital">{ringsCollected}</strong></span>
          </div>

          <div className="flex gap-4">
            <button onClick={restartSimulation} className="btn btn-primary font-digital px-6">
              RE-LAUNCH AIRCRAFT
            </button>
            <button onClick={onExit} className="btn btn-secondary font-digital px-6">
              RETURN TO HANGAR
            </button>
          </div>
        </div>
      )}

      {/* Screen Overlay MODAL: Landing Success State */}
      {flightState === 'landed' && (
        <div className="absolute inset-0 bg-emerald-950/45 backdrop-blur-sm z-20 flex flex-col justify-center items-center gap-6">
          <div className="text-center">
            <h2 className="font-digital text-6xl text-emerald-400 glow-green mb-3">MISSION SUCCESS</h2>
            <p className="font-tech text-xl text-white uppercase tracking-widest">AIRCRAFT TOUCHDOWN COMPLETED SUCCESSFULLY</p>
          </div>

          <div className="font-tech text-muted text-center flex flex-col gap-1 text-sm bg-black/60 p-4 border border-emerald-500/20 rounded">
            <span>FINAL SCORE: <strong className="text-emerald-400 font-digital">{score}</strong></span>
            <span>RINGS COLLECTED: <strong className="text-white font-digital">{ringsCollected}</strong></span>
            <span>FLIGHT TIME: <strong className="text-white font-digital">{Math.round(stateRef.current.flightTime)}s</strong></span>
          </div>

          <div className="flex gap-4">
            <button onClick={restartSimulation} className="btn btn-primary font-digital px-6">
              FLY AGAIN
            </button>
            <button onClick={onExit} className="btn btn-secondary font-digital px-6">
              RETURN TO HANGAR
            </button>
          </div>
        </div>
      )}

      {/* Screen Overlay MODAL: Pre-Flight Launch Controller */}
      {flightState === 'ready' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-20 flex flex-col justify-center items-center gap-6">
          <div className="text-center max-w-lg">
            <h2 className="font-digital text-5xl text-sky-400 glow-blue mb-3">{aircraft.name}</h2>
            <p className="font-tech text-sm text-muted uppercase tracking-wider mb-6">READY ON RUNWAY FOR TAKEOFF</p>
            
            <div className="text-xs text-left text-muted leading-relaxed bg-slate-950/60 p-5 border border-white/5 rounded-lg flex flex-col gap-2 font-tech mb-6">
              <span className="text-white font-bold text-sm block mb-1">PRE-FLIGHT CONTROLS CHECK LIST:</span>
              <span>1. Press <strong className="text-white">SHIFT</strong> to increase throttle (Accelerate to 40+ KTS).</span>
              <span>2. Press <strong className="text-white">S (or ArrowDown)</strong> to pull nose UP and takeoff.</span>
              <span>3. Press <strong className="text-white">A / D (or ArrowLeft/Right)</strong> to roll / bank wings.</span>
              <span>4. Press <strong className="text-white">W (or ArrowUp)</strong> to pitch nose DOWN.</span>
              <span>5. Press <strong className="text-white">Q / E</strong> to yaw rudder left/right.</span>
              <span className="text-amber-400 font-bold block mt-2">SOUND WARNING: Takeoff will initialize real-time synthesized engine audio.</span>
            </div>
          </div>

          <button onClick={startEngine} className="btn btn-primary font-digital px-8 py-3 text-lg flex items-center gap-2">
            <Play size={18} /> START ENGINES & LAUNCH
          </button>
        </div>
      )}

      {/* WebGL Troubleshooting Diagnostic Screen */}
      {webglError && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-30 flex flex-col justify-center items-center gap-6 p-6 text-center">
          <div className="max-w-md bg-black/60 p-8 border border-rose-500/20 rounded-xl flex flex-col items-center gap-4">
             <h2 className="font-digital text-3xl text-rose-500 glow-red">WEBGL NOT AVAILABLE</h2>
             <p className="font-tech text-base text-white uppercase tracking-wider leading-relaxed">
               {webglError}
             </p>
             <div className="w-full text-xs text-left text-muted leading-relaxed bg-slate-900/60 p-4 border border-white/5 rounded font-mono flex flex-col gap-2">
               <span className="text-amber-400 font-bold block mb-1">STEPS TO RESOLVE:</span>
               <span>1. Open Google Chrome Settings.</span>
               <span>2. Navigate to "System" or search "hardware acceleration".</span>
               <span>3. Toggle ON "Use graphics acceleration when available".</span>
               <span>4. Relaunch your browser tab and try again.</span>
             </div>
             <button onClick={onExit} className="btn btn-secondary font-tech px-6 w-full justify-center">
               RETURN TO HANGAR
             </button>
          </div>
        </div>
      )}

    </div>
  );
}
