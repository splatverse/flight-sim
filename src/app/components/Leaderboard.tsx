'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Clock, Target, Calendar, CheckCircle2, XCircle, RefreshCw, Database } from 'lucide-react';

export interface FlightLog {
  _id?: string;
  aircraft: string;
  mode: string;
  score: number;
  ringsCollected: number;
  flightTime: number; // in seconds
  landed: boolean;
  date: string;
}

interface LeaderboardProps {
  refreshTrigger?: number;
}

export default function Leaderboard({ refreshTrigger = 0 }: LeaderboardProps) {
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [localMode, setLocalMode] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/flight-logs');
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to retrieve leaderboard logs');
      }

      setLocalMode(data.localMode);
      
      if (data.localMode) {
        // Fall back to local storage
        const localDataStr = localStorage.getItem('flight_simulator_logs');
        if (localDataStr) {
          const parsed = JSON.parse(localDataStr) as FlightLog[];
          // Sort by score desc, then date desc
          parsed.sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime());
          setLogs(parsed.slice(0, 20));
        } else {
          setLogs([]);
        }
      } else {
        setLogs(data.logs || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error communicating with database API');
      
      // Secondary fallback
      const localDataStr = localStorage.getItem('flight_simulator_logs');
      if (localDataStr) {
        const parsed = JSON.parse(localDataStr) as FlightLog[];
        parsed.sort((a, b) => b.score - a.score);
        setLogs(parsed.slice(0, 20));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, refreshTrigger]);

  const clearLogs = () => {
    if (confirm('Are you sure you want to purge all local flight logs?')) {
      localStorage.removeItem('flight_simulator_logs');
      fetchLogs();
    }
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Unknown';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Trophy size={20} className="glow-blue" />
          </div>
          <div>
            <h3 className="font-digital text-xl">GLOBAL LEADERBOARD</h3>
            <p className="text-xs text-muted font-tech">TOP FLIGHT SIMULATION RECORDS</p>
          </div>
        </div>

        {/* Database state badge */}
        <div className="flex items-center gap-4 font-tech">
          <div className="flex items-center gap-2 text-xs">
            <Database size={14} className={localMode ? 'text-sky-400' : 'text-emerald-400'} />
            <span className="text-muted">DB STATUS:</span>
            <span className={`font-bold uppercase ${localMode ? 'text-sky-400 glow-blue' : 'text-emerald-400 glow-green'}`}>
              {localMode ? 'LOCAL STORAGE MODE' : 'MONGODB ONLINE'}
            </span>
          </div>

          <button 
            onClick={fetchLogs} 
            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-colors"
            title="Refresh Leaderboard"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-16 text-center text-muted font-tech flex flex-col gap-2 items-center justify-center">
          <RefreshCw size={32} className="animate-spin text-sky-400 mb-2" />
          RECALLING TELEMETRY RECORDS...
        </div>
      ) : error ? (
        <div className="glass-panel p-8 text-center text-rose-500 font-tech">
          ERROR RECALLING LOGS: {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-panel p-16 text-center text-muted font-tech flex flex-col gap-4 items-center justify-center">
          <Trophy size={48} className="opacity-20" />
          NO REGISTERED LOGS FOUND. COMPLETED MISSIONS WILL BE LOGGED HERE.
        </div>
      ) : (
        <div className="glass-panel overflow-x-auto">
          {/* Table Header */}
          <div className="log-item log-header bg-white/[0.03]">
            <div>PILOT & AIRFRAME</div>
            <div className="text-center">FLIGHT TELEMETRY</div>
            <div className="text-center">TIME & STATUS</div>
            <div className="text-right">RATING SCORE</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/5">
            {logs.map((log, index) => {
              const rank = index + 1;
              let rankColor = 'text-white';
              if (rank === 1) rankColor = 'text-amber-400 font-bold';
              else if (rank === 2) rankColor = 'text-slate-300 font-bold';
              else if (rank === 3) rankColor = 'text-amber-600 font-bold';

              return (
                <div key={log._id || index} className="log-item items-center py-4">
                  
                  {/* Left: Rank, Plane name */}
                  <div className="flex items-center gap-3">
                    <span className={`font-digital text-base w-6 text-center ${rankColor}`}>
                      #{rank}
                    </span>
                    <div>
                      <h4 className="font-digital text-sm text-white">{log.aircraft}</h4>
                      <p className="text-[10px] text-muted tracking-wider uppercase mt-0.5">{log.mode}</p>
                    </div>
                  </div>

                  {/* Middle Left: Stats (rings, time) */}
                  <div className="flex flex-col gap-1 items-center justify-center text-xs">
                    <span className="flex items-center gap-1 text-muted">
                      <Target size={11} className="text-sky-400" />
                      Rings: <strong className="text-white">{log.ringsCollected}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-muted">
                      <Clock size={11} className="text-sky-400" />
                      Time: <strong className="text-white">{formatTime(log.flightTime)}</strong>
                    </span>
                  </div>

                  {/* Middle Right: Landed indicator, Date */}
                  <div className="flex flex-col gap-1 items-center justify-center text-xs">
                    <span className="flex items-center gap-1">
                      {log.landed ? (
                        <>
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span className="text-emerald-400 font-semibold uppercase text-[10px]">Landed</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={12} className="text-rose-500" />
                          <span className="text-rose-400 font-semibold uppercase text-[10px]">Crashed</span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted">
                      <Calendar size={9} />
                      {formatDate(log.date)}
                    </span>
                  </div>

                  {/* Right: Score */}
                  <div className="text-right font-digital text-lg text-emerald-400 glow-green pr-2">
                    {log.score.toLocaleString()}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dev options */}
      {logs.length > 0 && localMode && (
        <div className="text-right">
          <button onClick={clearLogs} className="btn btn-danger py-1.5 px-4 font-tech text-xs">
            PURGE LOCAL SCOREBOARD
          </button>
        </div>
      )}

    </div>
  );
}
