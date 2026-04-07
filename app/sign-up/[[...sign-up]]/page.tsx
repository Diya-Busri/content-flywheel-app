"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, XCircle, Sparkles } from "lucide-react";

type VerifyResult = { valid: boolean; name?: string; email?: string } | null;

function SignUpForm() {
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite") ?? "";

  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<VerifyResult>(null);

  useEffect(() => {
    if (!invite) {
      setVerifying(false);
      setResult({ valid: false });
      return;
    }
    fetch(`/api/creator-acceptance/verify-invite?token=${encodeURIComponent(invite)}`)
      .then((r) => r.json())
      .then((data: VerifyResult) => setResult(data))
      .catch(() => setResult({ valid: false }))
      .finally(() => setVerifying(false));
  }, [invite]);

  // Store the invite token so the dashboard can capture + link it after sign-up
  useEffect(() => {
    if (invite && typeof window !== "undefined") {
      sessionStorage.setItem("cf_invite_token", invite);
    }
  }, [invite]);

  if (verifying) {
    return (
      <div className="flex flex-col items-center gap-3 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm text-gray-400">Verifying your invite…</p>
      </div>
    );
  }

  // Blocked — no valid invite
  if (!result?.valid) {
    return (
      <div className="text-center max-w-sm px-4">
        <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-6 h-6 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">
          {invite ? "Invite link expired or already used" : "Content Flywheel is invite-only"}
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          {invite
            ? "This invite link has already been used or is no longer valid. If you think this is a mistake, email us."
            : "To create an account you need to be accepted through our Creator Acceptance Program first."}
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/apply"
            className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
          >
            Apply for access
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Already have an account? Sign in
          </Link>
          {invite && (
            <a
              href="mailto:contentflywheel@gmail.com"
              className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
            >
              Contact us
            </a>
          )}
        </div>
      </div>
    );
  }

  // Valid invite — show sign-up form
  return (
    <div className="flex flex-col items-center gap-4">
      {result.name && (
        <div className="text-center mb-2">
          <p className="text-white font-semibold text-lg">Welcome, {result.name}! 🎉</p>
          <p className="text-gray-400 text-sm mt-1">Create your password to get started</p>
        </div>
      )}
      <SignUp
        appearance={{
          elements: {
            formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
            footerActionLink: "text-orange-500 hover:text-orange-600",
            // Hide the social login options — password only
            socialButtonsBlockButton: "hidden",
            socialButtonsBlockButtonArrow: "hidden",
            dividerRow: "hidden",
            dividerText: "hidden",
          },
        }}
        forceRedirectUrl={`/dashboard?invite_capture=${encodeURIComponent(invite)}`}
        fallbackRedirectUrl={`/dashboard?invite_capture=${encodeURIComponent(invite)}`}
      />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F0F0F] p-4">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="text-sm">Loading…</span>
          </div>
        }
      >
        <SignUpForm />
      </Suspense>
    </div>
  );
}
