"use client";

import { SignIn } from "@clerk/nextjs";
import { useRef, useEffect, useState } from "react";

export function SignInWithRedirect() {
  let redirectUrl = "/dashboard";
  if (typeof window !== "undefined") {
    const r = new URLSearchParams(window.location.search).get("redirect_url");
    if (r && r.startsWith("/") && r !== "/pricing") redirectUrl = r;
  }

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    // When the primary submit button is clicked, show the loading overlay
    // after a short delay (gives Clerk time to reject bad credentials first)
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button[type=submit], button.cl-formButtonPrimary")) {
        setTimeout(() => setNavigating(true), 800);
      }
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, []);

  return (
    <>
      {/* Full-screen loading overlay shown while Clerk redirects */}
      {navigating && (
        <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            <p className="text-sm text-white/50">Signing you in…</p>
          </div>
        </div>
      )}

      <div ref={wrapperRef} className="flex flex-col items-center gap-3">
        <SignIn
          appearance={{
            elements: {
              formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
              footerActionLink: "text-orange-500 hover:text-orange-600",
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
    </>
  );
}
