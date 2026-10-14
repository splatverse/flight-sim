'use client';

import React from 'react';
import { Shield, Zap, AlertTriangle, Play, HelpCircle } from 'lucide-react';

interface HUDProps {
  speed: number;          // knots
  altitude: number;       // feet
  pitch: number;          // radians
  roll: number;           // radians
  yaw: number;            // radians
  throttle: number;       // 0 - 100
  ringsCollected: number;
  totalRings: number;
  timeRemaining: number;
  gameMode: string;
  onExit: () => void;
  flightState: 'crashed' | 'active' | 'landed' | 'ready';
  radarTargets: Array<{ x: number; z: number; type: 'ring' | 'runway'; active: boolean }>;
  playerPos: { x: number; z: number };
  pilotName?: string;
}

export default function HUD({
  speed,
  altitude,
  pitch,
  roll,
  yaw,
  throttle,
  ringsCollected,
  totalRings,
  timeRemaining,
  gameMode,
  onExit,
  flightState,
  radarTargets,
  playerPos,
  pilotName = 'CAPT. GUEST',
}: HUDProps) {
  // Convert radians to degrees
  const pitchDeg = Math.round((pitch * 180) / Math.PI);
  const rollDeg = Math.round((roll * 180) / Math.PI);
  
  // Heading angle (0 - 360)
  let heading = Math.round(((-yaw * 180) / Math.PI) % 360);
  if (heading < 0) heading += 360;

  // Formatting utility
  const pad = (num: number, size: number) => {
    let s = num.toString();
    while (s.length < size) s = "0" + s;
    return s;
  };

  // Determine warnings
  const isTooLow = altitude < 80 && flightState === 'active' && speed > 20;
  const isStalling = speed < 40 && flightState === 'active' && altitude > 50;
  const isExtremePitch = Math.abs(pitchDeg) > 45;

  // Mini-radar positioning calculations
  const radarRadius = 60; // radius of mini-radar in pixels
  const radarScale = 0.08; // scale 3D coords to radar pixels

  return (
    <div className="hud-container select-none">
      
      {/* Top HUD bar: Flight mode & Game Timer & Exit Button */}
      <div className="flex justify-between items-start hud-interactive w-full">
        {/* Left: Esc/Exit */}
        <button 
          onClick={onExit}
          className="btn btn-secondary py-1.5 px-4 font-tech text-xs bg-black/60 backdrop-blur border border-white/10"
        >
          QUIT SIMULATION
        </button>

        {/* Center: Mission info / Ring count */}
        <div className="glass-panel px-6 py-2.5 flex items-center gap-6 bg-black/80">
          <div className="text-center">
            <span className="text-[10px] text-muted font-tech block uppercase">FLIGHT PROTOCOL</span>
            <span className="font-digital text-sm text-sky-400 uppercase tracking-wider">{gameMode}</span>
          </div>

          {gameMode === 'ring_challenge' && (
            <>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <span className="text-[10px] text-muted font-tech block">RINGS COMPLETED</span>
                <span className="font-digital text-sm text-emerald-400 glow-green">
                  {ringsCollected} / {totalRings}
                </span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <span className="text-[10px] text-muted font-tech block">CHRONOMETER</span>
                <span className={`font-digital text-sm ${timeRemaining <= 10 ? 'text-rose-500 glow-red' : 'text-white'}`}>
                  {timeRemaining.toFixed(1)}s
                </span>
              </div>
            </>
          )}

          {gameMode === 'landing_challenge' && (
            <>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <span className="text-[10px] text-muted font-tech block">RUNWAY TARGET</span>
                <span className="font-digital text-sm text-amber-400 glow-amber uppercase">
                  ACTIVE ALIGNMENT
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: Pilot callsign & Sound reminder */}
        <div className="flex flex-col items-end gap-2">
          <div className="glass-panel px-4 py-1.5 bg-black/85 border border-emerald-500/20 font-digital text-xs text-emerald-400 glow-green flex items-center gap-2">
            <Shield size={14} /> ACTIVE PILOT: {pilotName.toUpperCase()}
          </div>
          <div className="glass-panel px-4 py-2 bg-black/80 font-tech text-xs text-muted flex items-center gap-2">
            <HelpCircle size={14} className="text-sky-400" />
            <span>USE <strong className="text-white">W/S</strong> FOR PITCH, <strong className="text-white">A/D</strong> FOR ROLL, <strong className="text-white">Q/E</strong> FOR RUDDER</span>
          </div>
        </div>
      </div>

      {/* Middle Cockpit Screen Overlay */}
      <div className="flex-grow flex items-center justify-between px-16 relative">
        
        {/* LEFT HUD: Speedometer tape */}
        <div className="flex flex-col items-end gap-1 font-digital border-r-2 border-emerald-500/30 pr-3 py-6 relative bg-gradient-to-r from-transparent to-emerald-950/10">
          <span className="text-[9px] font-tech text-muted absolute -top-4 right-0">SPD (KTS)</span>
          <div className="text-sm opacity-50">{Math.round(speed + 30)}</div>
          <div className="text-sm opacity-70">{Math.round(speed + 15)}</div>
          <div className="text-xl text-emerald-400 font-bold glow-green flex items-center gap-1.5">
            <Zap size={14} className="animate-pulse" /> {Math.round(speed)}
          </div>
          <div className="text-sm opacity-70">{Math.max(0, Math.round(speed - 15))}</div>
          <div className="text-sm opacity-50">{Math.max(0, Math.round(speed - 30))}</div>
        </div>

        {/* CENTER HUD: SVG Attitude Indicator (Artificial Horizon) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
          {/* Pitch ladder and horizon bars */}
          <svg 
            width="240" 
            height="240" 
            viewBox="0 0 240 240" 
            style={{ transform: `rotate(${-rollDeg}deg)` }}
            className="transition-transform duration-75 ease-out"
          >
            {/* Horizon line */}
            <line 
              x1="20" 
              y1={120 + pitchDeg * 2} 
              x2="220" 
              y2={120 + pitchDeg * 2} 
              stroke="rgba(0, 255, 170, 0.6)" 
              strokeWidth="2"
              strokeDasharray="8 4"
            />
            {/* Pitch markings +10, +20, -10, -20 */}
            <g opacity="0.65" stroke="var(--color-primary)" strokeWidth="1.5">
              {/* Pitch +10 */}
              <line x1="80" y1={120 - 20 + pitchDeg * 2} x2="160" y2={120 - 20 + pitchDeg * 2} />
              <line x1="80" y1={120 - 20 + pitchDeg * 2} x2="80" y2={120 - 15 + pitchDeg * 2} />
              <line x1="160" y1={120 - 20 + pitchDeg * 2} x2="160" y2={120 - 15 + pitchDeg * 2} />
              
              {/* Pitch +20 */}
              <line x1="90" y1={120 - 40 + pitchDeg * 2} x2="150" y2={120 - 40 + pitchDeg * 2} />
              <line x1="90" y1={120 - 40 + pitchDeg * 2} x2="90" y2={120 - 32 + pitchDeg * 2} />
              <line x1="150" y1={120 - 40 + pitchDeg * 2} x2="150" y2={120 - 32 + pitchDeg * 2} />

              {/* Pitch -10 */}
              <line x1="80" y1={120 + 20 + pitchDeg * 2} x2="160" y2={120 + 20 + pitchDeg * 2} strokeDasharray="4 2" />
              <line x1="80" y1={120 + 20 + pitchDeg * 2} x2="80" y2={120 + 15 + pitchDeg * 2} />
              <line x1="160" y1={120 + 20 + pitchDeg * 2} x2="160" y2={120 + 15 + pitchDeg * 2} />

              {/* Pitch -20 */}
              <line x1="90" y1={120 + 40 + pitchDeg * 2} x2="150" y2={120 + 40 + pitchDeg * 2} strokeDasharray="4 2" />
              <line x1="90" y1={120 + 40 + pitchDeg * 2} x2="90" y2={120 + 32 + pitchDeg * 2} />
              <line x1="150" y1={120 + 40 + pitchDeg * 2} x2="150" y2={120 + 32 + pitchDeg * 2} />
            </g>
          </svg>

          {/* Static aircraft crosshair at exact center */}
          <div className="absolute flex items-center justify-center">
            {/* Center dot */}
            <div className="w-1.5 h-1.5 bg-sky-400 rounded-full glow-blue" />
            {/* Left wing winglet */}
            <div className="w-8 h-px bg-sky-400 ml-1.5" />
            <div className="w-px h-3 bg-sky-400" />
            {/* Right wing winglet */}
            <div className="w-8 h-px bg-sky-400 mr-1.5 order-first" />
            <div className="w-px h-3 bg-sky-400 order-last" />
          </div>

          {/* Warning notifications centered */}
          <div className="absolute top-[130px] flex flex-col items-center gap-1.5 font-tech text-xs font-bold w-[300px] text-center">
            {isTooLow && (
              <div className="px-3 py-1 bg-red-950/80 border border-red-500 rounded text-red-500 glow-red animate-bounce flex items-center gap-1 justify-center">
                <AlertTriangle size={12} /> LOW ALTITUDE - PULL UP!
              </div>
            )}
            {isStalling && (
              <div className="px-3 py-1 bg-amber-950/80 border border-amber-500 rounded text-amber-500 glow-amber flex items-center gap-1 justify-center">
                <AlertTriangle size={12} /> STALL WARNING - PITCH DOWN & THROTTLE UP!
              </div>
            )}
            {isExtremePitch && (
              <div className="px-3 py-1 bg-blue-950/80 border border-blue-500 rounded text-blue-400 glow-blue">
                STEER CORRECTION ACTIVE
              </div>
            )}
          </div>
        </div>

        {/* RIGHT HUD: Altimeter tape */}
        <div className="flex flex-col items-start gap-1 font-digital border-l-2 border-emerald-500/30 pl-3 py-6 relative bg-gradient-to-l from-transparent to-emerald-950/10">
          <span className="text-[9px] font-tech text-muted absolute -top-4 left-0">ALT (FT)</span>
          <div className="text-sm opacity-50">{Math.round(altitude + 100)}</div>
          <div className="text-sm opacity-70">{Math.round(altitude + 50)}</div>
          <div className="text-xl text-emerald-400 font-bold glow-green flex items-center gap-1.5">
            <Shield size={14} /> {Math.round(altitude)}
          </div>
          <div className="text-sm opacity-70">{Math.max(0, Math.round(altitude - 50))}</div>
          <div className="text-sm opacity-50">{Math.max(0, Math.round(altitude - 100))}</div>
        </div>

      </div>

      {/* Bottom Control Deck Panel: Compass & Throttle & Mini Radar */}
      <div className="flex justify-between items-end w-full gap-8">
        
        {/* Bottom Left: Linear Throttle lever */}
        <div className="glass-panel p-4 flex flex-col gap-2 w-48 bg-black/80 hud-interactive">
          <div className="flex justify-between font-tech text-xs font-semibold">
            <span className="text-muted">THROTTLE DEMAND</span>
            <span className={throttle > 80 ? 'text-amber-400' : 'text-emerald-400'}>{throttle}%</span>
          </div>
          {/* Slider lever */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted font-tech">0%</span>
            <div className="flex-grow h-4 bg-white/10 rounded overflow-hidden relative border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-100" 
                style={{ width: `${throttle}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-digital text-[10px] font-bold text-white shadow-inner">
                {throttle > 85 ? 'AFTERBURNER' : throttle > 30 ? 'CRUISE' : 'IDLE'}
              </span>
            </div>
            <span className="text-[10px] text-muted font-tech">100%</span>
          </div>
          <div className="text-[9px] text-muted font-tech text-center mt-1">
            PRESS <strong className="text-white">SHIFT</strong> to ACCEL, <strong className="text-white">CTRL</strong> to DECEL
          </div>
        </div>

        {/* Bottom Center: Compass strip */}
        <div className="glass-panel px-6 py-2 bg-black/80 flex flex-col items-center justify-center w-72 h-14 relative overflow-hidden">
          <div className="absolute top-0 w-px h-3 bg-rose-500 z-10" />
          
          {/* Scrolling tape representation */}
          <div className="w-full h-8 overflow-hidden relative">
            <div 
              className="flex justify-center items-center font-digital text-sm text-emerald-400 gap-8 absolute transition-all duration-75 ease-out"
              style={{
                transform: `translateX(${-((heading / 360) * 400 - 200)}px)`,
                width: '800px',
                left: '-200px'
              }}
            >
              <span>N</span><span>30</span><span>60</span>
              <span>E</span><span>120</span><span>150</span>
              <span>S</span><span>210</span><span>240</span>
              <span>W</span><span>300</span><span>330</span>
              <span>N</span>
            </div>
          </div>
          
          <div className="font-digital text-xs text-white tracking-widest mt-1">
            HDG: <strong className="text-emerald-400 font-bold">{pad(heading, 3)}°</strong>
          </div>
        </div>

        {/* Bottom Right: Mini Radar Display */}
        <div className="glass-panel p-3 bg-black/90 w-44 h-44 flex flex-col items-center justify-center hud-interactive border border-white/10 relative">
          <span className="text-[9px] font-tech text-muted absolute top-2 left-2 uppercase">NAVIGATION RADAR</span>
          
          <div className="relative w-28 h-28 rounded-full border border-emerald-500/30 radar-sweep bg-emerald-950/10 flex items-center justify-center">
            
            {/* Center: Player dot */}
            <div className="absolute w-2 h-2 bg-emerald-400 rounded-full border border-white z-20 shadow-lg" />

            {/* Radar rings */}
            <div className="absolute w-14 h-14 rounded-full border border-emerald-500/10 pointer-events-none" />
            
            {/* Radar targets */}
            {radarTargets.map((target, idx) => {
              // Calculate relative displacement in 3D (X and Z coordinates)
              const dx = target.x - playerPos.x;
              const dz = target.z - playerPos.z;

              // Apply radar scale & rotation based on yaw to align radar with aircraft forward heading
              // If we want north-up:
              // const rx = dx * radarScale;
              // const ry = dz * radarScale;
              
              // Aircraft heading-up radar rotation
              const cosYaw = Math.cos(yaw);
              const sinYaw = Math.sin(yaw);
              
              // Rotate vector around player heading
              const rx = (dx * cosYaw - dz * sinYaw) * radarScale;
              const ry = (dx * sinYaw + dz * cosYaw) * radarScale;

              // Clamp to radar perimeter
              const dist = Math.sqrt(rx * rx + ry * ry);
              const limit = radarRadius - 6;
              let finalX = rx;
              let finalY = ry;
              
              if (dist > limit) {
                finalX = (rx / dist) * limit;
                finalY = (ry / dist) * limit;
              }

              // Types coloring
              let color = 'bg-yellow-400 glow-amber';
              if (target.type === 'runway') color = 'bg-sky-400 glow-blue';
              if (!target.active) color = 'bg-white/10 border border-white/20';

              return (
                <div 
                  key={idx}
                  className={`absolute w-1.5 h-1.5 rounded-full z-10 ${color}`}
                  style={{
                    transform: `translate(${finalX}px, ${finalY}px)`,
                    opacity: target.active ? 1 : 0.4
                  }}
                  title={`${target.type} target`}
                />
              );
            })}
          </div>

          <div className="text-[10px] text-muted font-tech mt-2 text-center w-full flex justify-between px-2">
            <span>RNG: 1.5KM</span>
            <span>HDG: {heading}°</span>
          </div>
        </div>

      </div>

    </div>
  );
}
