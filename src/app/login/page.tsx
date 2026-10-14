'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, Compass, Database, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dbStatus, setDbStatus] = useState<'online' | 'local'>('local');

  // Check database configuration on load
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/flight-logs');
        const data = await res.json();
        setDbStatus(data.localMode ? 'local' : 'online');
      } catch (e) {
        setDbStatus('local');
      }
    };
    checkStatus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setError('Please provide all credentials.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      if (data.localMode) {
        // --- LOCAL STORAGE AUTH FALLBACK ---
        const localUsersStr = localStorage.getItem('flight_simulator_users');
        const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];
        
        // Search by username or email
        const targetKey = usernameOrEmail.toLowerCase();
        const localUser = localUsers.find(
          (u: any) => u.username.toLowerCase() === targetKey || u.email.toLowerCase() === targetKey
        );

        if (!localUser || localUser.password !== password) {
          throw new Error('Invalid username/email or password (Local validation).');
        }

        // Save session locally
        localStorage.setItem(
          'flight_simulator_session',
          JSON.stringify({
            name: localUser.name,
            email: localUser.email,
            username: localUser.username,
          })
        );
      } else {
        // Online Mode Success
        localStorage.setItem('flight_simulator_session', JSON.stringify(data.user));
      }

      setSuccess(true);
      
      // Perform a page reload redirect to refresh dashboard contexts
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-12">
      {/* Background grids */}
      <div className="bg-grid-layer" />

      {/* Main Login Card */}
      <div className="glass-panel p-8 max-w-md w-full flex flex-col gap-6 relative overflow-hidden bg-black/80">
        
        {/* Header decoration */}
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Compass size={22} className="text-sky-400 animate-spin-slow" />
            <span className="font-digital text-lg text-white">PILOT SIGN IN</span>
          </div>
          <div className="flex items-center gap-1.5 font-tech text-[10px] text-muted">
            <Database size={11} className={dbStatus === 'online' ? 'text-emerald-400' : 'text-sky-400'} />
            <span className={dbStatus === 'online' ? 'text-emerald-400 glow-green' : 'text-sky-400 glow-blue'}>
              {dbStatus === 'online' ? 'ONLINE DB' : 'LOCAL DEV'}
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-2">
          <h2 className="font-digital text-3xl text-sky-400 glow-blue mb-1">AUTHORIZATION</h2>
          <p className="font-tech text-[10px] text-muted uppercase tracking-widest">
            FLIGHT SIM PILOT ACCESS
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4 font-tech">
          {/* Username/Email Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted flex items-center gap-1.5">
              <Shield size={12} className="text-sky-400" /> USERNAME OR EMAIL
            </label>
            <input
              type="text"
              required
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-sky-500 rounded p-2.5 text-white outline-none font-sans text-sm transition-all focus:box-shadow-[0_0_10px_rgba(0,217,255,0.2)]"
              placeholder="e.g. pilot_echo or pilot@sky.com"
            />
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted flex items-center gap-1.5">
              <Key size={12} className="text-sky-400" /> SYSTEM PASSWORD
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-sky-500 rounded p-2.5 text-white outline-none font-sans text-sm transition-all focus:box-shadow-[0_0_10px_rgba(0,217,255,0.2)]"
              placeholder="••••••••"
            />
          </div>

          {/* Status indicators */}
          {error && (
            <div className="flex items-center gap-2 text-rose-500 text-xs bg-rose-950/20 border border-rose-500/30 p-3 rounded mt-2">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-950/20 border border-emerald-500/30 p-3 rounded mt-2 animate-pulse">
              <RefreshCw size={14} className="animate-spin shrink-0" /> SECURITY CLEARED. INITIALIZING PROFILE ROUTINES...
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || success}
            className="btn btn-primary w-full justify-center py-2.5 font-digital text-sm tracking-widest mt-4 flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> AUTHORIZING...
              </>
            ) : (
              <>
                SIGN IN PILOT <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Redirect block */}
        <div className="text-center font-tech text-xs text-muted mt-2 border-t border-white/5 pt-4 flex flex-col gap-2">
          <span>
            NEW TO FLIGHT SIM?{' '}
            <Link href="/signup" className="text-sky-400 hover:text-sky-300 font-bold underline">
              CREATE A PILOT FILE
            </Link>
          </span>
          <Link href="/" className="text-muted hover:text-white transition-colors">
            ← RETREAT TO TERMINAL
          </Link>
        </div>

      </div>
    </div>
  );
}
