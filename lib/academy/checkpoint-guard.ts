/**
 * Feature-flag gate for the Academy "Understanding Check" checkpoint.
 *
 * Reuses the app-wide admin check (lib/is-admin.ts, single ADMIN_EMAIL env
 * var) and the standard beta feature-flag resolution (lib/feature-flags.ts)
 * — no user id/email is ever hardcoded here. Admins automatically bypass,
 * exactly like every other beta feature (see app/dashboard/layout.tsx).
 *
 * This is checked in TWO places by design:
 *   1. Server components (lesson page) — decides whether to render the panel.
 *   2. API routes / actions — belt-and-braces so a direct request can't
 *      reach the checkpoint AI endpoint while the flag is off for that user.
 */
import { isAdmin } from "@/lib/is-admin";
import { getDisabledFeatures, FEATURE_KEYS } from "@/lib/feature-flags";

export async function isAcademyCheckpointEnabled(userId: string): Promise<boolean> {
  if (await isAdmin()) return true;
  const disabled = await getDisabledFeatures(userId);
  return !disabled.has(FEATURE_KEYS.ACADEMY_UNDERSTANDING_CHECK);
}
