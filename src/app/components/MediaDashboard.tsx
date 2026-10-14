'use client';

import React, { useState, useRef } from 'react';
import { Upload, HelpCircle, FileImage, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface MediaDashboardProps {
  customSkinUrl: string;
  onSkinChange: (url: string) => void;
}

export default function MediaDashboard({ customSkinUrl, onSkinChange }: MediaDashboardProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [inBucket, setInBucket] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: 'skin' | 'screenshot') => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setInfo(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setInBucket(data.storage === 'bucket');

      if (type === 'skin') {
        onSkinChange(data.url);
        setInfo(
          data.storage === 'bucket'
            ? `Skin uploaded to the storage bucket! URL: ${data.url}`
            : `Skin saved locally: ${data.url} (set the STORAGE_* variables to keep uploads in a bucket)`
        );
      } else {
        setScreenshots((prev) => [data.url, ...prev]);
        setInfo(
          data.storage === 'bucket'
            ? `Screenshot uploaded to the storage bucket! URL: ${data.url}`
            : `Screenshot saved locally: ${data.url}`
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleSkinFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, 'skin');
  };

  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, 'screenshot');
  };

  const clearCustomSkin = () => {
    onSkinChange('');
    setInfo('Custom paint scheme removed. Reset to standard aircraft livery.');
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 flex flex-col gap-6">
      <div className="text-center mb-4">
        <h2 className="font-digital text-4xl mb-2 glow-blue">MEDIA CONTROLLER</h2>
        <p className="text-muted font-tech text-lg">MANAGE LARGE AIRCRAFT TEXTURES, CUSTOM PAINTS, AND SCREENSHOTS</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Skin Upload / Active Configuration */}
        <div className="glass-panel p-6 flex flex-col gap-4 lg:col-span-2">
          <h3 className="font-digital text-xl text-sky-400 border-b border-white/10 pb-2 flex items-center gap-2">
            <FileImage size={18} /> CUSTOM AIRCRAFT LIVERY (PAINT SCHEME)
          </h3>

          <p className="text-sm text-muted leading-relaxed">
            Upload a custom PNG/JPG image to paint your aircraft! The texture will wrap around the body of your active plane in the 3D Flight Simulator.
          </p>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-center py-6 border-2 border-dashed border-white/10 rounded-lg hover:border-sky-500/50 transition-colors bg-white/[0.01]">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleSkinFileChange} 
              accept="image/png,image/jpeg,image/webp" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={uploading}
              className="btn btn-secondary font-digital text-sm flex items-center gap-2"
            >
              <Upload size={16} /> SELECT TEXTURE FILE
            </button>
            <span className="text-xs text-muted">Supports PNG, JPG, or WebP</span>
          </div>

          {/* Messages */}
          {uploading && (
            <div className="flex items-center gap-2 text-sky-400 font-tech text-sm justify-center py-2 animate-pulse">
              <RefreshCw size={16} className="animate-spin" /> TRANSFERRING MEDIA STREAM TO STORAGE BUCKET...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-rose-500 font-tech text-sm bg-rose-950/20 border border-rose-500/30 p-3 rounded">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {info && (
            <div className="flex items-start gap-2 text-emerald-400 font-tech text-sm bg-emerald-950/20 border border-emerald-500/30 p-3 rounded">
              <Check size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">{inBucket ? 'STORAGE BUCKET' : 'LOCAL BACKEND FALLBACK'}</p>
                <p className="text-xs opacity-90 mt-0.5">{info}</p>
              </div>
            </div>
          )}

          {/* Active Livery Preview */}
          <div className="mt-4 p-4 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <p className="text-xs text-muted font-tech">ACTIVE LIVERY STATE</p>
              <h4 className="font-digital text-lg text-emerald-400 mt-1">
                {customSkinUrl ? 'CUSTOM PAINT INSTALLED' : 'DEFAULT MIL-SPEC LIVERY'}
              </h4>
              {customSkinUrl && (
                <p className="text-xs text-muted mt-1 truncate max-w-[300px] md:max-w-[400px]">
                  Source: {customSkinUrl}
                </p>
              )}
            </div>
            {customSkinUrl && (
              <button onClick={clearCustomSkin} className="btn btn-danger font-tech py-1.5 px-4 text-xs">
                RESET TO FACTORY PAINT
              </button>
            )}
          </div>
        </div>

        {/* Storage Info */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h3 className="font-digital text-xl text-amber-400 border-b border-white/10 pb-2 flex items-center gap-2">
            <HelpCircle size={18} /> WHERE UPLOADS GO
          </h3>

          <div className="flex flex-col gap-4 font-tech text-sm text-muted">
            <div>
              <h4 className="font-bold text-white text-base">1. Any S3-Compatible Bucket</h4>
              <p className="mt-1">
                Liveries and screenshots are stored in the bucket you configure, and served from its public URL. Allow GET requests from your site (CORS) so the 3D view can load your paint as a texture.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white text-base">2. Local Fallback</h4>
              <p className="mt-1">
                With no bucket configured, development servers save uploads to public/uploads so everything works out of the box. Production servers need a bucket.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-200 text-xs">
              <span className="font-bold block mb-1">PRO TIP: Configuration</span>
              Add these variables to your environment (see .env.example):
              <code className="block mt-2 bg-black/40 p-1 rounded select-all font-mono text-[10px]">
                STORAGE_BUCKET=...<br />
                STORAGE_ACCESS_KEY_ID=...<br />
                STORAGE_SECRET_ACCESS_KEY=...<br />
                STORAGE_ENDPOINT=...<br />
                STORAGE_PUBLIC_URL=...
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Logs Screenshots Board */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
          <h3 className="font-digital text-xl text-sky-400 flex items-center gap-2">
            <Upload size={18} /> FLIGHT SCREENSHOT GALLERY
          </h3>
          <input 
            type="file" 
            ref={screenshotInputRef} 
            onChange={handleScreenshotFileChange} 
            accept="image/png,image/jpeg,image/webp" 
            className="hidden" 
          />
          <button 
            onClick={() => screenshotInputRef.current?.click()} 
            disabled={uploading}
            className="btn btn-secondary font-tech text-xs"
          >
            UPLOAD SCREENSHOT
          </button>
        </div>

        {screenshots.length === 0 ? (
          <div className="text-center py-10 text-muted font-tech">
            NO SCREENSHOTS UPLOADED. SNAP AND SHARE YOUR FLIGHTS!
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {screenshots.map((url, index) => (
              <div key={index} className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-white/10 hover:border-sky-500 transition-all duration-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={url} 
                  alt={`Flight Screenshot ${index + 1}`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <span className="text-[10px] text-sky-400 font-mono truncate max-w-full">{url}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
