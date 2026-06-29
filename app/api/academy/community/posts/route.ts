import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { listCommunityPosts, insertCommunityPost, listLikedPostIds } from "@/db/queries/academy-queries";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    const category = req.nextUrl.searchParams.get("category") ?? undefined;
    const posts = await listCommunityPosts(category);
    let likedIds: string[] = [];
    if (userId) {
      const set = await listLikedPostIds(userId, posts.map((p) => p.id));
      likedIds = Array.from(set);
    }
    return NextResponse.json({ posts, likedPostIds: likedIds });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
    const body = await req.json();
    if (!body?.title || !body?.content) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
    const isAdmin = !!adminEmail && email.trim().toLowerCase() === adminEmail;
    const category = body.category === "admin" && !isAdmin ? "general" : body.category || "general";
    const post = await insertCommunityPost({
      userId,
      userEmail: email,
      title: body.title,
      content: body.content,
      category,
      imageUrls: body.imageUrls,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
