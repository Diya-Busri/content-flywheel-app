"use client";

import { SignIn } from "@clerk/nextjs";

export function SignInWithRedirect() {
  let redirectUrl = "/dashboard";
  if (typeof window !== "undefined") {
    const r = new URLSearchParams(window.location.search).get("redirect_url");
    if (r && r.startsWith("/")) redirectUrl = r;
  }

  return (
    <SignIn
      appearance={{
        elements: {
          formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
          footerActionLink: "text-orange-500 hover:text-orange-600",
        },
      }}
      fallbackRedirectUrl={redirectUrl}
    />
  );
}
