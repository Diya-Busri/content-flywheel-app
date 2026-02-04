"use client";

import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

function SignUpFallback() {
  return (
    <div className="flex flex-col items-center gap-4 text-slate-600 dark:text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      <p>Loading sign up...</p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<SignUpFallback />}>
        <SignUp
          appearance={{
            elements: {
              formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
              footerActionLink: "text-orange-500 hover:text-orange-600",
            },
          }}
          afterSignUpUrl="/dashboard"
        />
      </Suspense>
    </div>
  );
}
