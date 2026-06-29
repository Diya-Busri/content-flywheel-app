import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { generateCoursePlan } from "@/lib/academy-ai";

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { title } = (await req.json()) as { title?: string };
    if (!title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const result = await generateCoursePlan(title.trim());
    return NextResponse.json(result);
  } catch (e) {
    console.error("[academy/ai/generate-course]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate course" },
      { status: 500 }
    );
  }
}
