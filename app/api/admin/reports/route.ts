import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { getReports } from "@/db/queries/messaging-queries";
import { adminUpdateReportAction } from "@/actions/messaging-actions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const reports = await getReports(status);
  return NextResponse.json({ reports });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { reportId, status } = body ?? {};
  if (!reportId || !status) return NextResponse.json({ error: "reportId and status required" }, { status: 400 });
  const res = await adminUpdateReportAction(reportId, status);
  if (!res.isSuccess) return NextResponse.json({ error: res.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
