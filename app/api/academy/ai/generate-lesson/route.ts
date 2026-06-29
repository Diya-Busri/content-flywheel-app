import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { generateLessonPlan } from "@/lib/academy-ai";

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { lessonTitle, courseTitle } = (await req.json()) as {
      lessonTitle?: string;
      courseTitle?: string;
    };
    if (!lessonTitle?.trim()) {
      return NextResponse.json({ error: "lessonTitle is required" }, { status: 400 });
    }
    const result = await generateLessonPlan(lessonTitle.trim(), (courseTitle ?? "").trim());
    return NextResponse.json(result);
  } catch (e) {
    console.error("[academy/ai/generate-lesson]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate lesson" },
      { status: 500 }
    );
  }
}
