import { getDisabledFeatures } from "@/lib/feature-flags";
import { isAdmin } from "@/lib/is-admin";
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
 *
 * Admin bypass: if the current user is the app admin, the gate is always
 * open regardless of the flag state. This lets admins test disabled or
 * beta features in production without exposing them to regular users.
 */
export async function FeatureGate({ featureKey, children, label }: FeatureGateProps) {
  const { userId } = await auth();
  if (!userId) return <>{children}</>;

  // Admins always bypass feature gates — they can access anything, even if
  // the flag is globally OFF. This is the single source of admin bypass for
  // page-level access. Sidebar bypass lives in app/dashboard/layout.tsx.
  const adminUser = await isAdmin();
  if (adminUser) return <>{children}</>;

  const disabled = await getDisabledFeatures(userId);
  if (!disabled.has(featureKey)) return <>{children}</>;

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
