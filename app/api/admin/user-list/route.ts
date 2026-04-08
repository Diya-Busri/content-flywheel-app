import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { asc } from "drizzle-orm";

// Lightweight endpoint — just userId, email, membership, status for the user picker
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = await db
      .select({
        userId: profilesTable.userId,
        email: profilesTable.email,
        membership: profilesTable.membership,
        status: profilesTable.status,
      })
      .from(profilesTable)
      .orderBy(asc(profilesTable.email));

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error("[user-list] DB error:", err);
    return NextResponse.json({ error: "Database error", users: [] }, { status: 500 });
  }
}
