/**
 * Fire-and-forget utility to mark an onboarding step complete server-side.
 * Safe to call from any API route — errors are swallowed so they never block
 * the main response.
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";

type OnboardingStepKey =
  | "createAccount"
  | "brandProfile"
  | "firstProduct"
  | "exploreDashboard"
  | "watchDemo"
  | "modalDismissed";

export async function markOnboardingStep(
  userId: string,
  step: OnboardingStepKey
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    const { data } = await supabase
      .from("profiles")
      .select("onboarding_steps, onboarding_completed")
      .eq("user_id", userId)
      .single();

    // Already fully complete — nothing to do
    if (data?.onboarding_completed) return;

    const current = (data?.onboarding_steps as Record<string, boolean>) ?? {};
    if (current[step]) return; // step already marked, skip the write

    const next = { ...current, [step]: true };

    await supabase
      .from("profiles")
      .update({ onboarding_steps: next })
      .eq("user_id", userId);
  } catch {
    // fire-and-forget — never block the calling request
  }
}
