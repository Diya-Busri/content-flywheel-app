"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const SignUp = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.SignUp),
  { ssr: false, loading: () => <SignUpFallback /> }
);

function SignUpFallback() {
  return (
    <div className="flex flex-col items-center gap-4 text-white">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      <p className="text-sm font-medium">Loading sign up...</p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F0F0F]">
      <Suspense fallback={<SignUpFallback />}>
        <SignUp
          appearance={{
            elements: {
              formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
              footerActionLink: "text-orange-500 hover:text-orange-600",
            },
          }}
          afterSignUpUrl="/dashboard"
          redirectUrl="/dashboard"
        />
      </Suspense>
    </div>
  );
}
