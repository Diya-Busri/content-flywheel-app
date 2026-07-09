/**
 * POST /api/admin/video-engine/upload
 *
 * Accepts a multipart form upload of an image or video file.
 * Saves it to /public/engine-renders/uploads/ so it is:
 *   1. Served by the Next.js dev server → accessible by Remotion's Chrome renderer
 *   2. Accessible in the browser preview immediately after upload
 *
 * Returns: { url, filename, mimeType, sizeBytes }
 *
 * Security: admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { isAdmin } from '@/lib/is-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allowed MIME types — images and common short-form video formats
const ALLOWED_IMAGE = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
const ALLOWED = new Set([...ALLOWED_IMAGE, ...ALLOWED_VIDEO]);

// Extension map for sanitised filenames
const EXT_MAP: Record<string, string> = {
  'image/jpeg':     'jpg',
  'image/jpg':      'jpg',
  'image/png':      'png',
  'image/webp':     'webp',
  'image/gif':      'gif',
  'image/avif':     'avif',
  'video/mp4':      'mp4',
  'video/webm':     'webm',
  'video/quicktime':'mov',
  'video/mov':      'mov',
};

export async function POST(request: NextRequest) {
  // ── Admin guard ──────────────────────────────────────────────────────────
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse multipart form ─────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file field in form data' }, { status: 400 });
  }

  // ── Validate type ────────────────────────────────────────────────────────
  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type "${mimeType}". Allowed: JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV` },
      { status: 415 }
    );
  }

  // ── Build safe filename ──────────────────────────────────────────────────
  const ext = EXT_MAP[mimeType] ?? 'bin';
  const ts  = Date.now();
  const rnd = Math.random().toString(36).slice(2, 7);
  const filename = `${ts}-${rnd}.${ext}`;

  // ── Write to /public/engine-renders/uploads/ ─────────────────────────────
  const uploadDir = path.resolve('public/engine-renders/uploads');
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  // Public URL served by Next.js static file serving
  const url = `/engine-renders/uploads/${filename}`;

  return NextResponse.json({
    url,
    filename,
    mimeType,
    sizeBytes: buffer.length,
    isVideo: ALLOWED_VIDEO.includes(mimeType),
    isImage: ALLOWED_IMAGE.includes(mimeType),
  });
}
