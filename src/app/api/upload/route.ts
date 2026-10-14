import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { isStorageConfigured, putObject } from '@/lib/storage';

// Liveries and screenshots: images only, so an upload can never be served as a page.
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_BYTES = 5 * 1024 * 1024;

// The route is open to guests, so it is rate limited per IP (in this server's memory).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 10;
const recentUploads = new Map<string, number[]>();

function rateLimited(req: NextRequest): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  const now = Date.now();
  const hits = (recentUploads.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_UPLOADS_PER_WINDOW) {
    recentUploads.set(ip, hits);
    return true;
  }
  hits.push(now);
  recentUploads.set(ip, hits);
  if (recentUploads.size > 10_000) {
    for (const [key, times] of recentUploads) {
      if (times.every((t) => now - t >= WINDOW_MS)) recentUploads.delete(key);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    if (rateLimited(req)) {
      return NextResponse.json({ success: false, error: 'Too many uploads. Try again in a few minutes.' }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    const ext = IMAGE_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ success: false, error: 'Upload a PNG, JPG or WebP image.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Images must be 5 MB or smaller.' }, { status: 400 });
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

    if (isStorageConfigured) {
      const url = await putObject(`uploads/${filename}`, buffer, file.type);
      return NextResponse.json({ success: true, url, storage: 'bucket' });
    }

    // A production server only serves the public/ files that existed at build time,
    // so saving to disk is a development convenience only.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Uploads need an S3-compatible bucket: set the STORAGE_* variables.' },
        { status: 503 }
      );
    }

    // Local fallback: write to public/uploads so the app works out of the box in development.
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/${filename}`,
      storage: 'local',
      message: 'No bucket configured. Saved to public/uploads (development only).',
    });
  } catch (error) {
    console.error('Upload API Error:', error);
    const message = error instanceof Error && error.message ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
