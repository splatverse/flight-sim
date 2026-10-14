'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Trophy, Cloud, HelpCircle, ArrowRight, Play, Database, LogOut, LogIn, User } from 'lucide-react';
import Link from 'next/link';
import AircraftSelection, { AIRCRAFT_PRESETS, AircraftConfig } from './components/AircraftSelection';
import MediaDashboard from './components/MediaDashboard';
import Leaderboard from './components/Leaderboard';
import FlightSimulator from './components/FlightSimulator';
import AircraftViewer from './components/AircraftViewer';

type TabType = 'hangar' | 'leaderboard' | 'media' | 'instructions';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('hangar');
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftConfig>(AIRCRAFT_PRESETS[0]);
  const [gameMode, setGameMode] = useState<'free_flight' | 'ring_challenge' | 'landing_challenge'>('ring_challenge');
  const [environmentTheme, setEnvironmentTheme] = useState<'sunset' | 'synthwave' | 'daylight'>('sunset');
  const [customSkinUrl, setCustomSkinUrl] = useState<string>('');
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);
  const [pilot, setPilot] = useState<{ name: string; email: string; username: string } | null>(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem('flight_simulator_session');
    if (sessionStr) {
      try {
        setPilot(JSON.parse(sessionStr));
      } catch (e) {
        localStorage.removeItem('flight_simulator_session');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('flight_simulator_session');
    setPilot(null);
  };

  const handleLaunchSimulator = () => {
    setIsPlaying(true);
  };

  const handleExitSimulator = () => {
    setIsPlaying(false);
    // Refresh leaderboard in case we achieved a new high score
    setLeaderboardRefresh((prev) => prev + 1);
  };

  const triggerLeaderboardRefresh = () => {
    setLeaderboardRefresh((prev) => prev + 1);
  };

  // Render the active game simulator overlay
  if (isPlaying) {
    return (
      <div className="fixed inset-0 w-screen h-screen z-50 bg-black">
        <FlightSimulator
          aircraft={selectedAircraft}
          gameMode={gameMode}
          customSkinUrl={customSkinUrl || undefined}
          onExit={handleExitSimulator}
          onLogSaved={triggerLeaderboardRefresh}
          pilotName={pilot ? pilot.name : 'CAPT. GUEST'}
          theme={environmentTheme}
        />
      </div>
    );
  }

  return (
    <div className={`theme-${environmentTheme} relative min-h-screen w-full flex flex-col justify-between overflow-y-auto px-4 md:px-8 py-6 z-10`}>
      
      {/* Background futuristic grids */}
      <div className="bg-grid-layer" />

      {/* HEADER SECTION */}
      <header className="w-full max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 mb-8 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-sky-500 to-emerald-500 rounded-lg text-black font-extrabold flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Compass className="animate-spin-slow" size={24} />
          </div>
          <div>
            <h1 className="font-digital text-2xl tracking-widest text-white">
              FLIGHT SIM <span className="text-sky-400">v1.2</span>
            </h1>
            <p className="text-[10px] font-tech text-muted tracking-widest uppercase">
              Web-Based 3D Flight Simulation Terminal
            </p>
          </div>
        </div>

        {/* NAVIGATION TABS & PROFILE */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <nav className="flex items-center gap-1 bg-white/[0.02] border border-white/5 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('hangar')}
              className={`nav-tab flex items-center gap-1.5 ${activeTab === 'hangar' ? 'active' : ''}`}
            >
              <Compass size={16} /> HANGAR
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`nav-tab flex items-center gap-1.5 ${activeTab === 'leaderboard' ? 'active' : ''}`}
            >
              <Trophy size={16} /> LEADERBOARD
            </button>
            <button
              onClick={() => setActiveTab('media')}
              className={`nav-tab flex items-center gap-1.5 ${activeTab === 'media' ? 'active' : ''}`}
            >
              <Cloud size={16} /> MEDIA
            </button>
            <button
              onClick={() => setActiveTab('instructions')}
              className={`nav-tab flex items-center gap-1.5 ${activeTab === 'instructions' ? 'active' : ''}`}
            >
              <HelpCircle size={16} /> FLIGHT GUIDE
            </button>
          </nav>

          {/* PILOT PROFILE CONTROLLER */}
          <div className="flex items-center bg-white/[0.02] border border-white/5 py-1.5 px-3 rounded-lg h-9 font-tech text-xs">
            {pilot ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-400 font-digital">
                  <User size={13} /> CAPT. {pilot.username.toUpperCase()}
                </span>
                <div className="w-px h-4 bg-white/10" />
                <button 
                  onClick={handleLogout}
                  className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <LogOut size={13} /> SIGN OUT
                </button>
              </div>
            ) : (
              <Link 
                href="/login"
                className="text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <LogIn size={13} /> PILOT LOG IN
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="w-full max-w-6xl mx-auto flex-grow flex flex-col justify-center items-center gap-8 mb-12">
        
        {activeTab === 'hangar' && (
          <div className="w-full flex flex-col gap-8">
            {/* Top row: Mission configuration launch panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Launcher Card */}
              <div className="glass-panel p-6 flex flex-col justify-between gap-4 lg:col-span-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl" />
                
                <div>
                  <h3 className="font-digital text-xl text-sky-400 mb-1">MISSION DEPLOYMENT DECK</h3>
                  <p className="text-xs text-muted font-tech mb-4 uppercase">CHOOSE MISSION PROTOCOL AND LAUNCH AIRFRAME</p>
                  
                  {/* Mode Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-tech mt-2">
                    <div 
                      onClick={() => setGameMode('free_flight')}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        gameMode === 'free_flight' 
                          ? 'border-sky-500 bg-sky-950/20' 
                          : 'border-white/5 bg-white/[0.01] hover:border-white/10'
                      }`}
                    >
                      <h4 className="font-digital text-sm text-white mb-1">FREE FLIGHT</h4>
                      <p className="text-[11px] text-muted leading-relaxed">Fly freely around procedural landscapes. No timers, no targets. Great for practice.</p>
                    </div>

                    <div 
                      onClick={() => setGameMode('ring_challenge')}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        gameMode === 'ring_challenge' 
                          ? 'border-sky-500 bg-sky-950/20' 
                          : 'border-white/5 bg-white/[0.01] hover:border-white/10'
                      }`}
                    >
                      <h4 className="font-digital text-sm text-white mb-1">RING CHALLENGE</h4>
                      <p className="text-[11px] text-muted leading-relaxed">Fly through floating glowing torus targets. Collecting rings extends flight time.</p>
                    </div>

                    <div 
                      onClick={() => setGameMode('landing_challenge')}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        gameMode === 'landing_challenge' 
                          ? 'border-sky-500 bg-sky-950/20' 
                          : 'border-white/5 bg-white/[0.01] hover:border-white/10'
                      }`}
                    >
                      <h4 className="font-digital text-sm text-white mb-1">LANDING TRIAL</h4>
                      <p className="text-[11px] text-muted leading-relaxed">Start in the air, align with the runway, throttle down, and achieve touchdown without crashing.</p>
                    </div>
                  </div>

                  {/* Sky Environment Theme Selector */}
                  <div className="mt-5 pt-4 border-t border-white/5">
                    <h4 className="font-tech text-xs text-muted uppercase tracking-wider mb-2">VISUAL SKY ENVIRONMENT</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-tech">
                      <div 
                        onClick={() => setEnvironmentTheme('sunset')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-center items-center text-center ${
                          environmentTheme === 'sunset' 
                            ? 'border-amber-500 bg-amber-950/20' 
                            : 'border-white/5 bg-white/[0.01] hover:border-white/10'
                        }`}
                      >
                        <span className="font-digital text-xs text-white">GOLDEN SUNSET</span>
                        <span className="text-[10px] text-muted mt-1">Warm sunset lighting & ambient fog</span>
                      </div>

                      <div 
                        onClick={() => setEnvironmentTheme('synthwave')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-center items-center text-center ${
                          environmentTheme === 'synthwave' 
                            ? 'border-pink-500 bg-pink-950/20' 
                            : 'border-white/5 bg-white/[0.01] hover:border-white/10'
                        }`}
                      >
                        <span className="font-digital text-xs text-white">CYBER SYNTHWAVE</span>
                        <span className="text-[10px] text-muted mt-1">Neon grid, synthwave sky & glow</span>
                      </div>

                      <div 
                        onClick={() => setEnvironmentTheme('daylight')}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-center items-center text-center ${
                          environmentTheme === 'daylight' 
                            ? 'border-sky-500 bg-sky-950/20' 
                            : 'border-white/5 bg-white/[0.01] hover:border-white/10'
                        }`}
                      >
                        <span className="font-digital text-xs text-white">OCEAN DAYLIGHT</span>
                        <span className="text-[10px] text-muted mt-1">Bright daylight sky & volumetric clouds</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-white/5">
                  <div className="font-tech text-xs text-muted">
                    ACTIVE AIRFRAME: <span className="text-white font-bold">{selectedAircraft.name}</span>
                    {customSkinUrl && <span className="text-emerald-400 block mt-0.5">Custom Paint Scheme Active</span>}
                  </div>
                  <button 
                    onClick={handleLaunchSimulator}
                    className="btn btn-primary font-digital text-base w-full sm:w-auto px-8 py-2.5 flex items-center gap-2"
                  >
                    <Play size={16} /> LAUNCH FLIGHT SIMULATOR <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* 3D Aircraft Preview Hangar Card */}
              <div className="glass-panel p-6 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="font-digital text-xl text-emerald-400 mb-1 flex items-center gap-2">
                    <Compass size={16} className="animate-pulse" /> 3D AIRCRAFT PREVIEW
                  </h3>
                  <p className="text-xs text-muted font-tech mb-4 uppercase">LIVE ROTATING DIAGNOSTIC VIEWER</p>
                  
                  <div className="mb-4">
                    <AircraftViewer aircraft={selectedAircraft} customSkinUrl={customSkinUrl || undefined} />
                  </div>

                  <div className="flex flex-col gap-3 font-tech text-sm text-muted">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span>Engine:</span>
                      <strong className="text-white">Three.js WebGL</strong>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span>Callsign:</span>
                      <strong className="text-emerald-400 font-digital">{selectedAircraft.id.toUpperCase()}</strong>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span>HUD Link:</span>
                      <strong className="text-white uppercase">{selectedAircraft.hudColor.includes('primary') ? 'Green' : selectedAircraft.hudColor.includes('secondary') ? 'Blue' : 'Amber'}</strong>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setActiveTab('leaderboard')}
                  className="btn btn-secondary text-xs font-tech justify-center"
                >
                  VIEW LEADERBOARD DATA
                </button>
              </div>

            </div>

            {/* Aircraft Selection slider row */}
            <AircraftSelection 
              selectedId={selectedAircraft.id} 
              onSelect={setSelectedAircraft}
              customSkinUrl={customSkinUrl}
            />
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard refreshTrigger={leaderboardRefresh} />
        )}

        {activeTab === 'media' && (
          <MediaDashboard 
            customSkinUrl={customSkinUrl} 
            onSkinChange={setCustomSkinUrl} 
          />
        )}

        {activeTab === 'instructions' && (
          <div className="glass-panel p-8 max-w-3xl w-full flex flex-col gap-6 font-tech">
            <h2 className="font-digital text-3xl text-sky-400 border-b border-white/10 pb-3">PILOT FLIGHT OPERATIONS GUIDE</h2>
            
            <div className="flex flex-col gap-4 text-muted leading-relaxed">
              <div>
                <h3 className="text-white text-lg font-bold mb-1">1. Takeoff Procedures</h3>
                <p>
                  Upon clicking launch, the engines will start in an idle state. Hold <strong className="text-white">SHIFT</strong> to throttle up to 100%. Once airspeed surpasses 40 KTS, tap <strong className="text-white">S (or ArrowDown)</strong> to pitch up. The lift force generated by airspeed will elevate the airframe off the ground runway.
                </p>
              </div>

              <div>
                <h3 className="text-white text-lg font-bold mb-1">2. Maneuvering & Pitch Dynamics</h3>
                <p>
                  Control keys are mapped as follows:
                </p>
                <ul className="list-disc pl-5 mt-1.5 flex flex-col gap-1 text-xs">
                  <li><strong className="text-white">W / S (or ArrowUp / ArrowDown)</strong> controls <strong className="text-white">Pitch</strong>. Pitching up climbs, but decreases airspeed. Pitching down dives, increasing speed.</li>
                  <li><strong className="text-white">A / D (or ArrowLeft / ArrowRight)</strong> controls <strong className="text-white">Roll</strong>. Rolling banks the wings, causing the lift vector to pull the plane into a coordinated turn.</li>
                  <li><strong className="text-white">Q / E</strong> controls <strong className="text-white">Yaw</strong>. Rudder input shifts heading laterally. Excellent for alignment adjustments.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white text-lg font-bold mb-1">3. Stalling Warning</h3>
                <p>
                  If airspeed drops below 40 KTS, the wings lose air flow and stall. The aircraft nose will drop sharply, and altitude will fall rapidly. To recover, increase throttle immediately and point the nose down to gain airspeed.
                </p>
              </div>

              <div>
                <h3 className="text-white text-lg font-bold mb-1">4. Landing Operations</h3>
                <p>
                  To complete a mission, you must return to the runway. Reduce throttle (using <strong className="text-white">CTRL</strong>) to keep speed below 90 KTS. Level your wings completely (roll close to 0) and slide gently onto the runway (Y=20 height). A hard landing (descent rate too high) or off-runway touchdown will result in crash destruction.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-white/5 font-tech text-xs text-muted">
        <div>
          FLIGHT SIM · OPEN SOURCE UNDER THE MIT LICENSE.
        </div>
        <div className="flex gap-4">
          <span>Three.js WebGL</span>
          <span>•</span>
          <span>MongoDB Leaderboards</span>
          <span>•</span>
          <span>S3-Compatible Media</span>
        </div>
      </footer>

    </div>
  );
}
