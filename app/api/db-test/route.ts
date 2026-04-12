import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { checkDatabaseConnection } from "@/db/db";

/**
 * Debug route to test database connection. Admin-only.
 * Visit /api/db-test while signed in as admin.
 */
export async function GET(_request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
