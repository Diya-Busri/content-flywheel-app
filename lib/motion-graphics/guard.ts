/**
 * Admin-only guard for every Motion Graphics Studio API route.
 *
 * Thin wrapper around the app-wide lib/is-admin.ts check (single ADMIN_EMAIL
 * env var, compared against the Clerk session's email — see that file for
 * the canonical implementation). Kept as its own module so:
 *   1. every motion-graphics route imports one obvious name (`requireAdmin`)
 *   2. if this feature ever needs a stricter/different check than the rest
 *      of the admin surface, there's a single place to change it.
 *
 * Page-level gating (rendering the UI at all) is handled by
 * app/dashboard/admin/layout.tsx, which every route under
 * /dashboard/admin/* — including /dashboard/admin/motion-graphics-studio —
 * already inherits. This module is the belt-and-braces backend check so a
 * direct API call without the page can never bypass admin-only access.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";

/** Resolves true only for the single configured admin account. */
export async function isMotionGraphicsAdmin(): Promise<boolean> {
  return isAdmin();
}

/**
 * Call at the top of every motion-graphics route handler:
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 *
 * Returns a 403 NextResponse if the caller is not the admin, otherwise null.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isMotionGraphicsAdmin())) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }
  return null;
}
