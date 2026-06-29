import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserCourseProgress } from "@/db/queries/academy-queries";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const progress = await getUserCourseProgress(userId, params.id);
    return NextResponse.json({
      progress,
      completedLessonIds: progress.map((p) => p.lessonId),
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 });
  }
}
