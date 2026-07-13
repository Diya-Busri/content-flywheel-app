import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PLATFORM_HOSTNAME = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
  : "contentflywheel.co.uk";

/**
 * Check if this request comes from a custom creator domain (not the main platform domain).
 * If so, look up the creator's userId and rewrite to /c/[userId].
 */
async function handleCustomDomain(req: NextRequest): Promise<NextResponse | null> {
  const host = req.headers.get("host") ?? "";
  const hostname = host.split(":")[0].toLowerCase();

  // Skip the bare platform domain, www, known platform subdomains, and localhost.
  // clerk.* must be excluded — the wildcard CNAME routes clerk.contentflywheel.co.uk to our app,
  // so without this exclusion Clerk's JS/API calls hit our custom-domain lookup and return CORS errors.
  if (
    hostname === PLATFORM_HOSTNAME ||
    hostname === `www.${PLATFORM_HOSTNAME}` ||
    hostname === `clerk.${PLATFORM_HOSTNAME}` ||
    hostname.endsWith(`.clerk.${PLATFORM_HOSTNAME}`) ||
    hostname === "localhost"
  ) {
    return null;
  }

  // Look up the custom domain in DB via a lightweight API call.
  // IMPORTANT: use the platform's own base URL, NOT req.url — if req.url is on a wildcard
  // subdomain (e.g. digitaldrift.contentflywheel.co.uk), the fetch would recurse through
  // middleware infinitely and time out, causing this function to return null.
  try {
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${PLATFORM_HOSTNAME}`;
    const lookupUrl = new URL(`/api/custom-domain/lookup?host=${encodeURIComponent(hostname)}`, appBaseUrl);
    const res = await fetch(lookupUrl.toString(), { next: { revalidate: 60 } }); // cache 60s
    if (!res.ok) return null;
    const data = await res.json() as { userId?: string };
    if (!data.userId) return null;

    // Only the storefront root maps to /c/[userId] — it's a single-page storefront
    // with no nested routes. Everything else (/product/[id], /course/[id], /pay, etc.)
    // is a normal top-level route that already works on any hostname, so let it pass
    // through unrewritten. Previously this rewrote every path to /c/[userId]{path},
    // which sent product links on custom domains to a non-existent /c/[userId]/product/[id]
    // route and 404'd.
    const path = req.nextUrl.pathname;
    if (path !== "/") return null;

    const rewriteUrl = new URL(`/c/${data.userId}`, req.url);
    rewriteUrl.search = req.nextUrl.search;
    return NextResponse.rewrite(rewriteUrl);
  } catch {
    return null;
  }
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/apply(.*)",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/cookie-policy",
  "/pricing",
  "/pay(.*)",
  "/subscribe(.*)",
  "/product(.*)",
  "/guide(.*)",
  "/unsubscribed",
  "/c(.*)",
  "/products(.*)",
  /** Public marketing pages */
  "/features",
  "/journey",
  "/blog(.*)",
  "/faq",
  "/contact",
  "/selling-guide",
  "/affiliates",
  /** Public marketplace — browsable + purchasable without a creator account */
  "/marketplace(.*)",
  /** All API routes (nested paths included); individual routes still enforce auth inside handlers. */
  "/api(.*)",
]);

const isAuthRoute = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Handle custom creator domains first — rewrite to /c/[userId] transparently
  const customDomainResponse = await handleCustomDomain(req);
  if (customDomainResponse) return customDomainResponse;

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
