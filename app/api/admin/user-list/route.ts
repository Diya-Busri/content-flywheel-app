import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { clerkClient } from "@clerk/nextjs/server";

// Pulls all users directly from Clerk — no dependency on profiles table
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const client = await clerkClient();
    // Fetch up to 500 users from Clerk
    const { data } = await client.users.getUserList({ limit: 500, orderBy: "-created_at" });

    const users = data.map((u) => ({
      userId: u.id,
      email: u.emailAddresses?.[0]?.emailAddress ?? "—",
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[user-list] Clerk error:", err);
    return NextResponse.json({ error: "Failed to fetch users from Clerk", users: [] }, { status: 500 });
  }
}
