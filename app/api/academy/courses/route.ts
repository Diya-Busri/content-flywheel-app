export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listPublishedCourses, insertCourse } from "@/db/queries/academy-queries";

function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  return !!adminEmail && email.trim().toLowerCase() === adminEmail;
}

export async function GET() {
  try {
    const courses = await listPublishedCourses();
    return NextResponse.json({ courses });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
    if (!isAdminEmail(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    if (!body?.title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    const course = await insertCourse(body);
    return NextResponse.json({ course }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
