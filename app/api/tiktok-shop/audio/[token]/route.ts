import { NextResponse } from "next/server";
import { getTemporaryAudio } from "@/lib/tiktok-shop/temporary-audio-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const entry = getTemporaryAudio(token);
  if (!entry) {
    return NextResponse.json({ error: "Audio not found or expired" }, { status: 404 });
  }

  return new NextResponse(entry.buffer, {
    status: 200,
    headers: {
      "Content-Type": entry.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
