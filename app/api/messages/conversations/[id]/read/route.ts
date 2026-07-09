import { NextRequest, NextResponse } from "next/server";
import { markReadAction } from "@/actions/messaging-actions";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await markReadAction(params.id);
  if (!res.isSuccess) return NextResponse.json({ error: res.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
