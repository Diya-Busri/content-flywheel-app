import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { desc, eq } from "drizzle-orm";

// GET — list recently sent notifications (admin view, latest 50)
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const recent = await db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  return NextResponse.json({ notifications: recent });
}

// POST — send a notification to one user or all users
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    message?: string;
    type?: string;
    linkUrl?: string;
    audience?: "all" | "specific";
    targetUserId?: string;
  };

  const {
    title,
    message,
    type = "info",
    linkUrl,
    audience = "all",
    targetUserId,
  } = body;

  if (!title || !message) {
    return NextResponse.json(
      { error: "title and message are required" },
      { status: 400 }
    );
  }

  const validTypes = ["info", "success", "warning", "error"];
  const notifType = validTypes.includes(type) ? type : "info";

  let userIds: string[] = [];

  if (audience === "specific") {
    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required when audience is 'specific'" },
        { status: 400 }
      );
    }
    // If it looks like an email, resolve to userId via profiles table
    if (targetUserId.includes("@")) {
      const [profile] = await db
        .select({ userId: profilesTable.userId })
        .from(profilesTable)
        .where(eq(profilesTable.email, targetUserId.trim().toLowerCase()));
      if (!profile) {
        return NextResponse.json({ error: "No user found with that email" }, { status: 404 });
      }
      userIds = [profile.userId];
    } else {
      userIds = [targetUserId];
    }
  } else {
    const profiles = await db
      .select({ userId: profilesTable.userId })
      .from(profilesTable);
    userIds = profiles.map((p) => p.userId);
  }

  if (userIds.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Insert in batches to avoid hitting DB limits
  const batchSize = 100;
  let sent = 0;

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    await db.insert(notificationsTable).values(
      batch.map((uid) => ({
        userId: uid,
        title,
        message,
        type: notifType,
        linkUrl: linkUrl ?? null,
      }))
    );
    sent += batch.length;
  }

  return NextResponse.json({ sent, total: userIds.length });
}
