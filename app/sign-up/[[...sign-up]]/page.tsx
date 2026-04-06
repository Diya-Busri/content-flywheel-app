"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignUpForm() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");
  const afterUrl = ref ? `/dashboard?ref=${encodeURIComponent(ref)}` : "/dashboard";

  return (
    <SignUp
      appearance={{
        elements: {
          formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
          footerActionLink: "text-orange-500 hover:text-orange-600",
        },
      }}
      forceRedirectUrl={afterUrl}
      fallbackRedirectUrl={afterUrl}
    />
  );
}

export default function SignUpPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#0F0F0F] p-4"
      style={{ minHeight: "100vh" }}
    >
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
