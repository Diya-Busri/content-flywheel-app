/**
 * POST /api/admin/video-engine/placeholders
 *
 * Accepts a list of scenes (id, sceneNumber, sceneType, onScreenText?) and
 * generates an SVG placeholder for each one, saving it to:
 *   /public/engine-renders/placeholders/{projectId}/{sceneId}.svg
 *
 * Returns: { assetUrls: Record<sceneId, url> }
 *   where url is the public path like /engine-renders/placeholders/{projectId}/{sceneId}.svg
 *
 * SVGs are 1080 × 1920 px (9:16) and can be consumed directly by the Remotion
 * composition as background images via the <Img> component.
 *
 * Security: admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { isAdmin } from '@/lib/is-admin';
import { generatePlaceholderSvg, PlaceholderScene } from '@/lib/video-engine/placeholder-generator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RequestBody = {
  projectId: string;
  scenes: PlaceholderScene[];
};

export async function POST(request: NextRequest) {
  // ── Admin guard ──────────────────────────────────────────────────────────
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectId, scenes } = body;

  if (!projectId || !Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json(
      { error: 'projectId and non-empty scenes[] are required' },
      { status: 400 }
    );
  }

  // ── Create output directory ───────────────────────────────────────────────
  const placeholderDir = path.resolve(`public/engine-renders/placeholders/${projectId}`);
  await mkdir(placeholderDir, { recursive: true });

  // ── Generate & save each SVG ─────────────────────────────────────────────
  const assetUrls: Record<string, string> = {};

  await Promise.all(
    scenes.map(async (scene) => {
      const svgString = generatePlaceholderSvg(scene);
      const filename  = `${scene.id}.svg`;
      const filePath  = path.join(placeholderDir, filename);
      await writeFile(filePath, svgString, 'utf8');
      assetUrls[scene.id] = `/engine-renders/placeholders/${projectId}/${filename}`;
    })
  );

  return NextResponse.json({ assetUrls });
}
