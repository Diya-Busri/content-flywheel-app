export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userFeedbackTable } from "@/db/schema/user-feedback-schema";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    rating?: number;
    category?: string;
    message?: string;
    page?: string;
  };

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  await db.insert(userFeedbackTable).values({
    userId,
    rating: body.rating ?? null,
    category: (body.category as "bug" | "idea" | "praise" | "other") ?? "other",
    message: body.message.trim(),
    page: body.page ?? null,
  });

  return NextResponse.json({ ok: true });
}
