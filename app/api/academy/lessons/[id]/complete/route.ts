export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLessonById, markLessonCompleteRow } from "@/db/queries/academy-queries";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const lesson = await getLessonById(params.id);
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    await markLessonCompleteRow(userId, lesson.id, lesson.courseId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to mark complete" }, { status: 500 });
  }
}
