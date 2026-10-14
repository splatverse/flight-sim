'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, Mail, Compass, Database, RefreshCw, AlertCircle, ArrowRight, User } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Basic validation checks
    if (!name || !email || !username || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, username, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Account creation failed.');
      }

      if (data.localMode) {
        // --- LOCAL STORAGE SIGNUP FALLBACK ---
        const localUsersStr = localStorage.getItem('flight_simulator_users');
        const localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];

        // Check if username/email conflicts locally
        const normalizedUsername = username.toLowerCase();
        const normalizedEmail = email.toLowerCase();
        
        const usernameExists = localUsers.some((u: any) => u.username.toLowerCase() === normalizedUsername);
        const emailExists = localUsers.some((u: any) => u.email.toLowerCase() === normalizedEmail);

        if (usernameExists) {
          throw new Error('Username is already taken (Local storage).');
        }
        if (emailExists) {
          throw new Error('Email is already registered (Local storage).');
        }

        // Save new user locally in plaintext for dev fallbacks
        localUsers.push({
          name,
          email: normalizedEmail,
          username: normalizedUsername,
          password,
        });
        localStorage.setItem('flight_simulator_users', JSON.stringify(localUsers));
      }

      setSuccess(true);
      
      // Redirect to login page
      setTimeout(() => {
        router.push('/login');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-8">
      {/* Background grids */}
      <div className="bg-grid-layer" />

      {/* Main Signup Card */}
      <div className="glass-panel p-8 max-w-md w-full flex flex-col gap-6 relative overflow-hidden bg-black/80">
        
        {/* Header decoration */}
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Compass size={22} className="text-sky-400 animate-spin-slow" />
            <span className="font-digital text-lg text-white">PILOT REGISTRY</span>
          </div>
          <div className="flex items-center gap-1.5 font-tech text-[10px] text-muted">
            <Database size={11} className={dbStatus === 'online' ? 'text-emerald-400' : 'text-sky-400'} />
            <span className={dbStatus === 'online' ? 'text-emerald-400 glow-green' : 'text-sky-400 glow-blue'}>
              {dbStatus === 'online' ? 'ONLINE DB' : 'LOCAL DEV'}
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-1">
          <h2 className="font-digital text-3xl text-sky-400 glow-blue mb-1">CREATE PROFILE</h2>
          <p className="font-tech text-[10px] text-muted uppercase tracking-widest">
            FLIGHT SIM PILOT REGISTRY
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="flex flex-col gap-4 font-tech">
          
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted flex items-center gap-1.5">
              <User size={12} className="text-sky-400" /> FULL NAME
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-sky-500 rounded p-2 text-white outline-none font-sans text-sm transition-all focus:box-shadow-[0_0_10px_rgba(0,217,255,0.2)]"
              placeholder="e.g. Capt. James Hook"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted flex items-center gap-1.5">
              <Mail size={12} className="text-sky-400" /> EMAIL ADDRESS
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-sky-500 rounded p-2 text-white outline-none font-sans text-sm transition-all focus:box-shadow-[0_0_10px_rgba(0,217,255,0.2)]"
              placeholder="e.g. pilot@example.com"
            />
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted flex items-center gap-1.5">
              <Shield size={12} className="text-sky-400" /> CALLSIGN (USERNAME)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-sky-500 rounded p-2 text-white outline-none font-sans text-sm transition-all focus:box-shadow-[0_0_10px_rgba(0,217,255,0.2)]"
              placeholder="e.g. maverick_88"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted flex items-center gap-1.5">
              <Key size={12} className="text-sky-400" /> ACCESS PASSWORD
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-sky-500 rounded p-2 text-white outline-none font-sans text-sm transition-all focus:box-shadow-[0_0_10px_rgba(0,217,255,0.2)]"
              placeholder="Minimum 6 characters"
            />
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted flex items-center gap-1.5">
              <Key size={12} className="text-sky-400" /> CONFIRM PASSWORD
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-sky-500 rounded p-2 text-white outline-none font-sans text-sm transition-all focus:box-shadow-[0_0_10px_rgba(0,217,255,0.2)]"
              placeholder="Re-type password"
            />
          </div>

          {/* Status indicators */}
          {error && (
            <div className="flex items-center gap-2 text-rose-500 text-xs bg-rose-950/20 border border-rose-500/30 p-2.5 rounded mt-1">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-950/20 border border-emerald-500/30 p-2.5 rounded mt-1 animate-pulse">
              <RefreshCw size={14} className="animate-spin shrink-0" /> PROFILE REGISTRATION APPROVED. REDIRECTING CONTROLLER...
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || success}
            className="btn btn-primary w-full justify-center py-2.5 font-digital text-sm tracking-widest mt-2 flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> REGISTERING...
              </>
            ) : (
              <>
                CREATE PILOT ACCOUNT <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Redirect block */}
        <div className="text-center font-tech text-xs text-muted mt-1 border-t border-white/5 pt-4 flex flex-col gap-2">
          <span>
            ALREADY REGISTERED?{' '}
            <Link href="/login" className="text-sky-400 hover:text-sky-300 font-bold underline">
              SIGN IN HERE
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
