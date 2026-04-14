import { getDisabledFeatures } from "@/lib/feature-flags";
import { USE_CASES } from "@/lib/use-cases";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

interface FeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
  label?: string;
}

/**
 * Server component — wraps a page and shows a "feature disabled" screen
 * if the flag is turned off for the current user in the admin panel.
 * User's explicit feature selections (Settings → Features) override global admin flags.
 */
export async function FeatureGate({ featureKey, children, label }: FeatureGateProps) {
  const { userId } = await auth();
  if (!userId) return <>{children}</>;

  const disabled = await getDisabledFeatures(userId);
  // Feature is not disabled at all — show it
  if (!disabled.has(featureKey)) return <>{children}</>;

  // Feature IS disabled globally, but check if the user explicitly enabled it in Settings.
  // User preference overrides the global admin flag.
  try {
    const profile = await getProfileByUserId(userId);
    if (profile?.enabledFeatures) {
      const selectedUseCases: string[] = JSON.parse(profile.enabledFeatures);
      const userExplicitKeys = new Set(
        USE_CASES.filter(uc => selectedUseCases.includes(uc.id)).flatMap(uc => uc.featureKeys)
      );
      if (userExplicitKeys.has(featureKey)) return <>{children}</>;
    }
  } catch {
    // Profile lookup failed — fall through to disabled screen
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="text-xl font-semibold mb-2">{label ?? "Feature Unavailable"}</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        This feature is currently disabled. Check back soon or contact support if you think this is a mistake.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 text-sm text-orange-500 underline hover:no-underline"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
