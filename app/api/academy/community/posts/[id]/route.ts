import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  getCommunityPostById,
  updateCommunityPostRow,
  deleteCommunityPostRow,
  listComments,
} from "@/db/queries/academy-queries";

function isAdminEmail(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  return !!adminEmail && email.trim().toLowerCase() === adminEmail;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const post = await getCommunityPostById(params.id);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const comments = await listComments(params.id);
    return NextResponse.json({ post, comments });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load post" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
    if (!isAdminEmail(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    const allowed: any = {};
    if (typeof body.isPinned === "boolean") allowed.isPinned = body.isPinned;
    if (typeof body.isFeatured === "boolean") allowed.isFeatured = body.isFeatured;
    const post = await updateCommunityPostRow(params.id, allowed);
    return NextResponse.json({ post });
  } catch (e) {
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
    const post = await getCommunityPostById(params.id);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (post.userId !== userId && !isAdminEmail(email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await deleteCommunityPostRow(params.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
