"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

/**
 * Invisible component — after a new creator signs up via an invite link,
 * reads ?invite_capture=TOKEN from the URL (or sessionStorage fallback),
 * then calls the API to link their Clerk userId to the application and
 * invalidate the one-time token.
 */
export function InviteCapture() {
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;

    const tokenFromUrl = searchParams.get("invite_capture") ?? "";
    const tokenFromStorage =
      typeof window !== "undefined"
        ? (sessionStorage.getItem("cf_invite_token") ?? "")
        : "";
    const token = tokenFromUrl || tokenFromStorage;

    if (!token) return;

    // Fire-and-forget — link the Clerk userId to the application
    void fetch("/api/creator-acceptance/verify-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, clerkUserId: user.id }),
    }).then(() => {
      // Clear from storage once used
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("cf_invite_token");
      }
    });
  }, [isLoaded, user, searchParams]);

  return null;
}
