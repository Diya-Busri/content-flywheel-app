import crypto from "crypto";

const EXPIRY_MS = 2 * 60 * 1000; // 2 minutes

function getSecret() {
  const secret = process.env.PDF_PREVIEW_SECRET || process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("PDF_PREVIEW_SECRET or CLERK_SECRET_KEY required for PDF preview tokens");
  return secret;
}

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
  return Buffer.from(base64 + pad, "base64");
}

/**
 * Create a short-lived token for the PDF preview URL.
 * @param {string} productId
 * @param {string} userId
 * @param {{ includeCover?: boolean, includeBackPage?: boolean }} options
 * @returns {string} token (base64url payload.signature)
 */
export function createPdfPreviewToken(productId, userId, options = {}) {
  const includeCover = options.includeCover !== false;
  const includeBackPage = options.includeBackPage !== false;
  const expiry = Date.now() + EXPIRY_MS;
  const payload = `${userId}|${expiry}|${includeCover ? "1" : "0"}|${includeBackPage ? "1" : "0"}`;
  const toSign = `${productId}|${payload}`;
  const secret = getSecret();
  const signature = crypto.createHmac("sha256", secret).update(toSign).digest();
  const token = base64UrlEncode(Buffer.from(payload, "utf8")) + "." + base64UrlEncode(signature);
  return token;
}

/**
 * Verify token and return decoded payload or null.
 * @param {string} productId
 * @param {string} token
 * @returns {{ userId: string, includeCover: boolean, includeBackPage: boolean } | null}
 */
export function verifyPdfPreviewToken(productId, token) {
  if (!productId || !token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const signatureB64 = token.slice(dot + 1);
  let payloadStr;
  let signature;
  try {
    payloadStr = base64UrlDecode(payloadB64).toString("utf8");
    signature = base64UrlDecode(signatureB64);
  } catch {
    return null;
  }
  const toSign = `${productId}|${payloadStr}`;
  const secret = getSecret();
  const expected = crypto.createHmac("sha256", secret).update(toSign).digest();
  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) return null;
  const parts = payloadStr.split("|");
  if (parts.length < 4) return null;
  const [userId, expiryStr, includeCoverStr, includeBackPageStr] = parts;
  const expiry = parseInt(expiryStr, 10);
  if (Number.isNaN(expiry) || Date.now() > expiry) return null;
  return {
    userId,
    includeCover: includeCoverStr === "1",
    includeBackPage: includeBackPageStr === "1",
  };
}
