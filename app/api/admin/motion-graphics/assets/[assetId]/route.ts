/**
 * DELETE /api/admin/motion-graphics/assets/:assetId
 * Admin-only (see lib/motion-graphics/guard.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/motion-graphics/guard";
import { deleteAsset } from "@/lib/motion-graphics/assets-repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_request: NextRequest, { params }: { params: { assetId: string } }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  await deleteAsset(params.assetId);
  return NextResponse.json({ ok: true });
}
