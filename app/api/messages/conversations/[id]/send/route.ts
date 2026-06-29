import { NextRequest, NextResponse } from "next/server";
import { sendMessageAction } from "@/actions/messaging-actions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const content = typeof body?.content === "string" ? body.content : "";
  const res = await sendMessageAction(params.id, content);
  if (!res.isSuccess) {
    return NextResponse.json({ error: res.message }, { status: 400 });
  }
  return NextResponse.json({ message: res.data });
}
