import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/apply(.*)",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/pricing",
  "/pay(.*)",
  "/subscribe(.*)",
  "/product(.*)",
  "/guide(.*)",
  "/unsubscribed",
  "/c(.*)",
  "/products(.*)",
  /** All API routes (nested paths included); individual routes still enforce auth inside handlers. */
  "/api(.*)",
]);

const isAuthRoute = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const url = req.nextUrl;

  // Authenticated users hitting sign-in → redirect immediately to dashboard (no blank page)
  // Note: sign-up is excluded so the email-verification step (pending session) is not interrupted
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  // After Stripe Checkout: /dashboard?session_id=cs_xxx → verify session then redirect to dashboard
  if (url.pathname === "/dashboard" && url.searchParams.get("session_id")) {
    const sessionId = url.searchParams.get("session_id");
    return NextResponse.redirect(new URL(`/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId!)}`, req.url));
  }
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
