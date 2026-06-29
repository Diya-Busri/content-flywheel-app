import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listComments, insertComment } from "@/db/queries/academy-queries";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const comments = await listComments(params.id);
    return NextResponse.json({ comments });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
    const body = await req.json();
    if (!body?.content) return NextResponse.json({ error: "Content required" }, { status: 400 });
    const comment = await insertComment({ postId: params.id, userId, userEmail: email, content: body.content });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
