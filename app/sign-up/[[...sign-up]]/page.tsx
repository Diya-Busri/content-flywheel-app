"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F0F0F] p-4">
      <SignUp
        path="/sign-up"
        appearance={{
          elements: {
            formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
            footerActionLink: "text-orange-500 hover:text-orange-600",
          },
        }}
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
