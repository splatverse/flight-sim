'use client';

import React from 'react';
import { Shield, Zap, Compass, RotateCw } from 'lucide-react';

export interface AircraftConfig {
  id: string;
  name: string;
  type: string;
  description: string;
  weight: number;         // Mass in kg (affects gravity, inertia)
  thrust: number;         // Max thrust force (affects acceleration)
  dragCoeff: number;      // Aerodynamic resistance factor
  liftCoeff: number;      // Aerodynamic lift factor
  rollRate: number;       // Lateral control sensitivity
  pitchRate: number;      // Longitudinal control sensitivity
  yawRate: number;        // Directional control sensitivity
  maxSpeed: number;       // Ideal top speed in knots
  color: string;          // Default color hex code
  hudColor: string;       // HUD green, blue, amber
}

export const AIRCRAFT_PRESETS: AircraftConfig[] = [
  {
    id: 'stunt',
    name: 'Aerobatic Biplane',
    type: 'Biplane Stunt',
    description: 'Ultra-lightweight biplane with incredible roll rates and instantaneous throttle response. Perfect for navigating tight ring courses.',
    weight: 700,
    thrust: 1200,
    dragCoeff: 0.08,
    liftCoeff: 0.28,
    rollRate: 2.2,
    pitchRate: 1.5,
    yawRate: 0.8,
    maxSpeed: 180,
    color: '#ef4444', // Red
    hudColor: 'var(--color-primary)', // Green
  },
  {
    id: 'fighter',
    name: 'Twin-Jet Strike Fighter',
    type: 'Supersonic Jet',
    description: 'State-of-the-art military fighter. High thrust-to-weight ratio allows vertical climbs and extreme supersonic speeds.',
    weight: 15000,
    thrust: 45000,
    dragCoeff: 0.03,
    liftCoeff: 0.18,
    rollRate: 1.8,
    pitchRate: 1.2,
    yawRate: 0.5,
    maxSpeed: 750,
    color: '#64748b', // Slate gray
    hudColor: 'var(--color-secondary)', // Blue
  },
  {
    id: 'airliner',
    name: 'Narrow-Body Airliner',
    type: 'Commercial Liner',
    description: 'A heavy commercial airliner. Inertia is high and controls are heavy, but it offers high cruise stability. Highly challenging to land.',
    weight: 75000,
    thrust: 120000,
    dragCoeff: 0.05,
    liftCoeff: 0.35,
    rollRate: 0.4,
    pitchRate: 0.3,
    yawRate: 0.15,
    maxSpeed: 480,
    color: '#38bdf8', // Sky blue
    hudColor: 'var(--color-warning)', // Amber
  },
];

interface AircraftSelectionProps {
  selectedId: string;
  onSelect: (aircraft: AircraftConfig) => void;
  customSkinUrl?: string;
}

export default function AircraftSelection({ selectedId, onSelect, customSkinUrl }: AircraftSelectionProps) {
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="text-center mb-8">
        <h2 className="font-digital text-4xl mb-2 glow-blue">FLIGHT HANGAR</h2>
        <p className="text-muted font-tech text-lg">SELECT YOUR AIRCRAFT AND REVIEW PERFORMANCE SPECIFICATIONS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {AIRCRAFT_PRESETS.map((plane) => {
          const isSelected = plane.id === selectedId;
          
          // Calculate percentages for spec bars
          const speedPct = (plane.maxSpeed / 750) * 100;
          const agilityPct = (plane.rollRate / 2.2) * 100;
          const powerPct = (plane.thrust / plane.weight / 3.0) * 100; // Thrust-to-weight ratio indicator
          const stabilityPct = (plane.weight / 75000) * 100; // Weight/size factor

          return (
            <div
              key={plane.id}
              onClick={() => onSelect(plane)}
              className={`glass-panel cursor-pointer flex flex-col p-6 transition-all duration-300 relative ${
                isSelected ? 'border-2' : ''
              }`}
              style={{
                borderColor: isSelected ? plane.hudColor : 'var(--glass-border)',
                boxShadow: isSelected ? `0 0 20px ${plane.hudColor}33` : 'none',
              }}
            >
              {/* Airplane Badge */}
              <div 
                className="absolute top-4 right-4 text-xs font-digital px-2.5 py-1 rounded border"
                style={{
                  color: plane.hudColor,
                  borderColor: `${plane.hudColor}44`,
                  background: `${plane.hudColor}11`,
                }}
              >
                {plane.type}
              </div>

              <h3 className="font-digital text-2xl mt-4 mb-1" style={{ color: isSelected ? plane.hudColor : '#fff' }}>
                {plane.name}
              </h3>
              <p className="font-tech text-muted mb-4 text-sm uppercase tracking-wider">
                Dry Weight: {plane.weight.toLocaleString()} kg
              </p>
              
              <p className="text-sm text-muted flex-grow mb-6 leading-relaxed">
                {plane.description}
              </p>

              {customSkinUrl && isSelected && (
                <div className="mb-4 p-2 bg-emerald-950/20 border border-emerald-500/30 rounded text-xs text-emerald-400 text-center">
                  Custom aircraft paint scheme active!
                </div>
              )}

              {/* Aircraft Specs Dashboard */}
              <div className="flex flex-col gap-3 font-tech">
                {/* Max Speed */}
                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-muted">
                      <Zap size={13} style={{ color: plane.hudColor }} /> MAXIMUM VELOCITY
                    </span>
                    <span style={{ color: plane.hudColor }}>{plane.maxSpeed} KTS</span>
                  </div>
                  <div className="spec-bar-bg">
                    <div 
                      className="spec-bar-fill" 
                      style={{ width: `${speedPct}%`, backgroundColor: plane.hudColor, boxShadow: `0 0 8px ${plane.hudColor}88` }} 
                    />
                  </div>
                </div>

                {/* Agility / Roll Rate */}
                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-muted">
                      <RotateCw size={13} style={{ color: plane.hudColor }} /> MANEUVERABILITY
                    </span>
                    <span style={{ color: plane.hudColor }}>{(plane.rollRate * 50).toFixed(0)} AQ</span>
                  </div>
                  <div className="spec-bar-bg">
                    <div 
                      className="spec-bar-fill" 
                      style={{ width: `${agilityPct}%`, backgroundColor: plane.hudColor, boxShadow: `0 0 8px ${plane.hudColor}88` }} 
                    />
                  </div>
                </div>

                {/* Thrust-to-Weight Ratio */}
                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-muted">
                      <Compass size={13} style={{ color: plane.hudColor }} /> THRUST EFFICIENCY
                    </span>
                    <span style={{ color: plane.hudColor }}>{(plane.thrust / plane.weight).toFixed(2)} TWR</span>
                  </div>
                  <div className="spec-bar-bg">
                    <div 
                      className="spec-bar-fill" 
                      style={{ width: `${Math.min(powerPct, 100)}%`, backgroundColor: plane.hudColor, boxShadow: `0 0 8px ${plane.hudColor}88` }} 
                    />
                  </div>
                </div>

                {/* Weight / Stability */}
                <div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-muted">
                      <Shield size={13} style={{ color: plane.hudColor }} /> AERODYNAMIC WEIGHT
                    </span>
                    <span style={{ color: plane.hudColor }}>{plane.weight > 5000 ? 'HEAVY' : 'LIGHT'}</span>
                  </div>
                  <div className="spec-bar-bg">
                    <div 
                      className="spec-bar-fill" 
                      style={{ width: `${Math.max(stabilityPct, 15)}%`, backgroundColor: plane.hudColor, boxShadow: `0 0 8px ${plane.hudColor}88` }} 
                    />
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button 
                className="btn w-full mt-6 justify-center transition-all duration-300"
                style={{
                  background: isSelected ? plane.hudColor : 'rgba(255,255,255,0.03)',
                  color: isSelected ? '#000' : 'var(--text-muted)',
                  border: `1px solid ${isSelected ? plane.hudColor : 'var(--glass-border)'}`,
                  boxShadow: isSelected ? `0 0 15px ${plane.hudColor}66` : 'none',
                }}
              >
                {isSelected ? 'AIRCRAFT ARMED' : 'SELECT AIRFRAME'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
