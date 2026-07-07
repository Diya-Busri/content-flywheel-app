"use client";

import { SignIn } from "@clerk/nextjs";

export function SignInWithRedirect() {
  let redirectUrl = "/dashboard";
  if (typeof window !== "undefined") {
    const r = new URLSearchParams(window.location.search).get("redirect_url");
    if (r && r.startsWith("/") && r !== "/pricing") redirectUrl = r;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
            footerActionLink: "text-orange-500 hover:text-orange-600",
            // Hide Clerk's built-in forgot password link
            formFieldAction__password: "hidden",
          },
        }}
        fallbackRedirectUrl={redirectUrl}
      />
      <p className="text-xs text-gray-500 text-center max-w-xs">
        Forgot your password?{" "}
        <a
          href="mailto:contentflywheel@gmail.com?subject=Password Reset Request"
          className="text-orange-400 hover:text-orange-300 underline transition-colors"
        >
          Email us to reset it
        </a>
      </p>
    </div>
  );
}
