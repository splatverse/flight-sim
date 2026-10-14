'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AircraftConfig } from './AircraftSelection';

interface AircraftViewerProps {
  aircraft: AircraftConfig;
  customSkinUrl?: string;
}

export default function AircraftViewer({ aircraft, customSkinUrl }: AircraftViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState<boolean>(false);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 300;
    const height = mountRef.current.clientHeight || 180;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8, 20);
    camera.lookAt(0, 0.5, 0);

    // 3. Renderer setup
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      mountRef.current.appendChild(renderer.domElement);
    } catch (e) {
      console.warn('WebGL not supported in AircraftViewer:', e);
      setWebglError(true);
      return;
    }

    // 4. Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Accent point light matching the plane HUD color
    const hudColorHex = aircraft.hudColor.includes('primary')
      ? 0x00ffaa // Green
      : aircraft.hudColor.includes('secondary')
      ? 0x00d9ff // Blue
      : 0xffb700; // Amber
    const accentLight = new THREE.PointLight(hudColorHex, 2.5, 30);
    accentLight.position.set(0, -2, 0);
    scene.add(accentLight);

    // 5. Grid Hangar Base Platform
    const platformGeo = new THREE.CylinderGeometry(8, 8.2, 0.4, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.8,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -3.2;
    platform.receiveShadow = true;
    scene.add(platform);

    // Grid ring accent
    const ringGeo = new THREE.RingGeometry(7.8, 8.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: hudColorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -2.99;
    scene.add(ring);

    const gridHelper = new THREE.GridHelper(16, 16, hudColorHex, 0x334155);
    gridHelper.position.y = -2.98;
    scene.add(gridHelper);

    // 6. Build Airplane Group
    const aircraftGroup = new THREE.Group();
    aircraftGroup.position.set(0, 0, 0);
    scene.add(aircraftGroup);

    // Aircraft materials
    const aircraftMaterial = new THREE.MeshStandardMaterial({
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
          aircraftMaterial.color = new THREE.Color(0xffffff);
          aircraftMaterial.needsUpdate = true;
        },
        undefined,
        (err) => console.warn('Failed to load custom livery in viewer:', err)
      );
    }

    // Fuselage
    const bodyGeo = new THREE.CylinderGeometry(0.8, 0.5, 7, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, aircraftMaterial);
    bodyMesh.castShadow = true;
    aircraftGroup.add(bodyMesh);

    // Canopy
    const canopyGeo = new THREE.SphereGeometry(0.6, 8, 8);
    canopyGeo.scale(1, 0.8, 2);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x00d9ff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 0.6, 0.5);
    aircraftGroup.add(canopyMesh);

    // Main Wings
    const wingGeo = new THREE.BoxGeometry(8, 0.12, 1.25);
    const wingMesh = new THREE.Mesh(wingGeo, aircraftMaterial);
    wingMesh.position.set(0, 0.05, 0);
    wingMesh.castShadow = true;
    aircraftGroup.add(wingMesh);

    // Tail Horizontal
    const tailHGeo = new THREE.BoxGeometry(2.7, 0.08, 0.7);
    const tailHMesh = new THREE.Mesh(tailHGeo, aircraftMaterial);
    tailHMesh.position.set(0, 0.1, -2.6);
    tailHMesh.castShadow = true;
    aircraftGroup.add(tailHMesh);

    // Tail Vertical
    const tailVGeo = new THREE.BoxGeometry(0.08, 1.4, 0.8);
    const tailVMesh = new THREE.Mesh(tailVGeo, aircraftMaterial);
    tailVMesh.position.set(0, 0.8, -2.7);
    tailVMesh.castShadow = true;
    aircraftGroup.add(tailVMesh);

    // Propeller (if stunt)
    let propellerMesh: THREE.Mesh | null = null;
    if (aircraft.id === 'stunt') {
      const spinnerGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 6);
      spinnerGeo.rotateX(Math.PI / 2);
      const spinner = new THREE.Mesh(spinnerGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      spinner.position.set(0, 0, 3.6);
      aircraftGroup.add(spinner);

      const propGeo = new THREE.BoxGeometry(2.4, 0.2, 0.02);
      propellerMesh = new THREE.Mesh(propGeo, new THREE.MeshBasicMaterial({ color: 0xffb700 }));
      propellerMesh.position.set(0, 0, 3.8);
      aircraftGroup.add(propellerMesh);
    }

    // Jet Engine flame exhaust
    let exhaustFire: THREE.Mesh | null = null;
    if (aircraft.id === 'fighter') {
      const exhaustGeo = new THREE.CylinderGeometry(0.4, 0.05, 1, 8);
      exhaustGeo.rotateX(Math.PI / 2);
      const exhaustMat = new THREE.MeshBasicMaterial({
        color: 0xff3c00,
        transparent: true,
        opacity: 0.8,
      });
      exhaustFire = new THREE.Mesh(exhaustGeo, exhaustMat);
      exhaustFire.position.set(0, 0, -3.75);
      aircraftGroup.add(exhaustFire);
    }

    // 7. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Slowly rotate aircraft group
      aircraftGroup.rotation.y = elapsed * 0.4;
      // Slight floating animation
      aircraftGroup.position.y = Math.sin(elapsed * 1.5) * 0.25;
      aircraftGroup.rotation.z = Math.sin(elapsed * 1.2) * 0.05;

      // Spin propeller
      if (propellerMesh) {
        propellerMesh.rotation.z += 0.15;
      }

      // Flicker engine glow
      if (exhaustFire) {
        const flicker = 0.8 + Math.sin(elapsed * 25) * 0.25;
        exhaustFire.scale.set(flicker, flicker, flicker);
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // 8. Resize listener
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        mountRef.current.removeChild(renderer.domElement);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [aircraft, customSkinUrl]);

  if (webglError) {
    return (
      <div className="w-full h-full flex flex-col justify-center items-center text-center p-4 bg-slate-950/40 border border-white/5 rounded-lg text-xs font-tech text-muted">
        <span className="text-rose-500 font-bold mb-1">3D VIEWER NOT RUNNING</span>
        <span>WebGL disabled or unsupported.</span>
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-[180px] relative overflow-hidden rounded-lg bg-black/40 border border-white/5" />;
}
