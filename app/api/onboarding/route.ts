import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export type OnboardingSteps = {
  createAccount?: boolean;
  brandProfile?: boolean;
  firstProduct?: boolean;
  exploreDashboard?: boolean;
  watchDemo?: boolean;
  modalDismissed?: boolean; // welcome modal skipped or finished
};

const ALL_STEPS: (keyof OnboardingSteps)[] = [
  "createAccount",
  "brandProfile",
  "firstProduct",
  "exploreDashboard",
  "watchDemo",
];

function allStepsComplete(steps: OnboardingSteps | null): boolean {
  if (!steps) return false;
  return ALL_STEPS.every((k) => steps[k] === true);
}

/** GET: return onboarding_completed and onboarding_steps for the current user */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarding_completed, onboarding_steps")
      .eq("user_id", userId)
      .single();
    if (error || !data) {
      return NextResponse.json(
        { onboardingCompleted: false, onboardingSteps: {} },
      );
    }
    const steps = (data.onboarding_steps as OnboardingSteps) ?? {};
    return NextResponse.json({
      onboardingCompleted: data.onboarding_completed === true,
      onboardingSteps: steps,
    });
  } catch (err) {
    console.error("[onboarding GET]", err);
    return NextResponse.json({ error: "Failed to load onboarding" }, { status: 500 });
  }
}

/** PATCH: update onboarding_steps and optionally set onboarding_completed */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { steps: stepsUpdate, complete, reset } = body as {
      steps?: Partial<OnboardingSteps>;
      complete?: boolean;
      reset?: boolean; // dev: wipe all state back to zero
    };

    // Hard reset — admin only
    if (reset === true) {
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
      const user = await currentUser();
      const userEmail = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
      if (!adminEmail || userEmail !== adminEmail) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const supabase = getSupabaseAdmin();
      if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });
      await supabase.from("profiles").update({ onboarding_steps: {}, onboarding_completed: false }).eq("user_id", userId);
      return NextResponse.json({ ok: true, reset: true });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    let nextSteps: OnboardingSteps = {};
    if (stepsUpdate && Object.keys(stepsUpdate).length > 0) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("onboarding_steps")
        .eq("user_id", userId)
        .single();
      const current = (existing?.onboarding_steps as OnboardingSteps) ?? {};
      nextSteps = { ...current, ...stepsUpdate };
    }
    const allComplete = complete === true || allStepsComplete(nextSteps);
    const update: Record<string, unknown> = {};
    if (Object.keys(nextSteps).length > 0) {
      update.onboarding_steps = nextSteps;
    }
    if (allComplete) {
      update.onboarding_completed = true;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true });
    }
    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("user_id", userId);
    if (error) {
      console.error("[onboarding PATCH]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      onboardingCompleted: allComplete,
      onboardingSteps: nextSteps,
    });
  } catch (err) {
    console.error("[onboarding PATCH]", err);
    return NextResponse.json({ error: "Failed to update onboarding" }, { status: 500 });
  }
}
