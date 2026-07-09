import { NextRequest, NextResponse } from "next/server";
import { reportPostAction, reportCommentAction } from "@/actions/messaging-actions";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { postId, commentId, reason, details, reportedUserId } = body ?? {};
  if (!reason) return NextResponse.json({ error: "reason required" }, { status: 400 });

  let res;
  if (postId) {
    res = await reportPostAction(postId, reason, details, reportedUserId);
  } else if (commentId) {
    res = await reportCommentAction(commentId, reason, details, reportedUserId);
  } else {
    return NextResponse.json({ error: "postId or commentId required" }, { status: 400 });
  }

  if (!res.isSuccess) return NextResponse.json({ error: res.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
