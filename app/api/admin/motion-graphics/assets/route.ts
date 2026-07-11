/**
 * GET  /api/admin/motion-graphics/assets?kind=image|video|logo|audio|music|sfx
 * POST /api/admin/motion-graphics/assets  (multipart/form-data: file, kind, name?)
 *
 * Uploads go straight to Cloudflare R2 via lib/storage.ts (the app-wide
 * storage abstraction) rather than local disk — unlike the CF Video Engine's
 * upload route (app/api/admin/video-engine/upload/route.ts), which writes to
 * /public and only works on a single long-lived dev server. R2 URLs work the
 * same in dev, on Vercel, and inside the Remotion Chromium renderer.
 *
 * Admin-only (see lib/motion-graphics/guard.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { listAssets, createAsset } from "@/lib/motion-graphics/assets-repo";
import { upload } from "@/lib/storage";
import type { AssetKind } from "@/lib/motion-graphics/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_KINDS: AssetKind[] = ["image", "video", "logo", "audio", "music", "sfx"];

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kindParam = request.nextUrl.searchParams.get("kind") as AssetKind | null;
  const kind = kindParam && VALID_KINDS.includes(kindParam) ? kindParam : undefined;

  const assets = await listAssets(userId, kind);
  return NextResponse.json({ assets });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind") as AssetKind | null;
  const nameOverride = formData.get("name") as string | null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!kind || !VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of ${VALID_KINDS.join(", ")}` }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const pathname = `motion-graphics/assets/${userId}/${kind}-${Date.now()}.${ext}`;

  const { url } = await upload(pathname, file, { contentType: file.type });

  const asset = await createAsset(userId, {
    kind,
    name: nameOverride?.trim() || file.name,
    url,
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
  });

  return NextResponse.json({ asset }, { status: 201 });
}
