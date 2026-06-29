import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  getCourseById,
  updateCourseRow,
  deleteCourseRow,
  listModulesByCourse,
  listLessonsByCourse,
} from "@/db/queries/academy-queries";

function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  return !!adminEmail && email.trim().toLowerCase() === adminEmail;
}

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 } as const;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  if (!isAdminEmail(email)) return { error: "Forbidden", status: 403 } as const;
  return { userId } as const;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const course = await getCourseById(params.id);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const [modules, lessons] = await Promise.all([
      listModulesByCourse(params.id),
      listLessonsByCourse(params.id),
    ]);
    return NextResponse.json({ course, modules, lessons });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load course" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const body = await req.json();
    const course = await updateCourseRow(params.id, body);
    return NextResponse.json({ course });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    await deleteCourseRow(params.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
