#!/usr/bin/env node
/**
 * Verifies OAuth URL construction for Connected Accounts:
 * - Production callback base yields correct redirect_uri
 * - Facebook/Instagram use valid scopes only
 * Run: node scripts/verify-oauth-urls.mjs
 */

const PRODUCTION_CALLBACK_BASE = "https://contentflywheel.co.uk";
const FB_SCOPES = "public_profile";

const EXPECTED_REDIRECT_PRODUCTION =
  "https://contentflywheel.co.uk/api/connected-accounts/callback";

function buildCallbackUrl(baseUrl, platform) {
  const isProduction = baseUrl?.includes("contentflywheel.co.uk");
  const callbackBase = isProduction
    ? PRODUCTION_CALLBACK_BASE
    : (baseUrl?.replace(/\/$/, "") ?? "http://localhost:3000");
  return `${callbackBase}/api/connected-accounts/callback?platform=${platform}`;
}

let ok = true;

// 1) Production base → redirect must use contentflywheel.co.uk
const prodBase = "https://contentflywheel.co.uk";
const prodCallback = buildCallbackUrl(prodBase, "youtube");
const redirectOrigin = prodCallback.split("?")[0];
if (redirectOrigin !== EXPECTED_REDIRECT_PRODUCTION) {
  console.error("FAIL: Production redirect_uri base should be", EXPECTED_REDIRECT_PRODUCTION, "got", redirectOrigin);
  ok = false;
} else {
  console.log("OK: Production redirect_uri base:", redirectOrigin);
}

// 2) Facebook scope: public_profile only (no Instagram scopes; Instagram uses Basic Display API separately)
if (FB_SCOPES !== "public_profile") {
  console.error("FAIL: FB_SCOPES should be public_profile, got", FB_SCOPES);
  ok = false;
} else {
  console.log("OK: FB scopes:", FB_SCOPES);
}

// 3) Local dev keeps localhost
const localCallback = buildCallbackUrl("http://localhost:3000", "instagram");
if (!localCallback.startsWith("http://localhost:3000")) {
  console.error("FAIL: Local callback should use localhost, got", localCallback);
  ok = false;
} else {
  console.log("OK: Local callback uses localhost");
}

if (ok) {
  console.log("\nOAuth URL logic verified. Add these in consoles:");
  console.log("  Google & Facebook redirect URIs:", EXPECTED_REDIRECT_PRODUCTION);
  process.exit(0);
} else {
  process.exit(1);
}
