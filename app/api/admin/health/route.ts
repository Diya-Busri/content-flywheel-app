import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { adminHealthLogsTable } from "@/db/schema/admin-health-logs-schema";
import { desc, eq, gte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level");
  const since = searchParams.get("since"); // ISO date string

  let query = db.select().from(adminHealthLogsTable).$dynamic();

  if (level && level !== "all") {
    query = query.where(eq(adminHealthLogsTable.level, level as "error" | "warning" | "info"));
  }
  if (since) {
    query = query.where(gte(adminHealthLogsTable.createdAt, new Date(since)));
  }

  const logs = await query.orderBy(desc(adminHealthLogsTable.createdAt)).limit(200);

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warning").length;

  return NextResponse.json({ logs, errorCount, warnCount });
}
