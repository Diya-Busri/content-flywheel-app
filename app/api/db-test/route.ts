import { NextResponse } from "next/server";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";
import { checkDatabaseConnection } from "@/db/db";

/**
 * Debug route to test database connection.
 * Visit /api/db-test to see the actual error.
 */
export async function GET(request: Request) {
  const rl = await checkApiRateLimit(getClientIp(request));
  if (rl) return rl;
  const hasUrl = !!process.env.DATABASE_URL;
  const urlPreview = process.env.DATABASE_URL
    ? `${process.env.DATABASE_URL.substring(0, 40)}...`
    : "(missing)";

  const result = await checkDatabaseConnection();

  return NextResponse.json({
    hasDatabaseUrl: hasUrl,
    urlPreview,
    ok: result.ok,
    message: result.message,
  });
}
