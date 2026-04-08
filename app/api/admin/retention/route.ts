import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, lt, and, gte, count, isNull, isNotNull } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const day60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // All pro users
  const [{ total }] = await db
    .select({ total: count() })
    .from(profilesTable)
    .where(eq(profilesTable.membership, "pro"));

  // Active last 7 days
  const [{ active7 }] = await db
    .select({ active7: count() })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.membership, "pro"),
        gte(profilesTable.lastActiveAt, day7)
      )
    );

  // Active last 30 days
  const [{ active30 }] = await db
    .select({ active30: count() })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.membership, "pro"),
        gte(profilesTable.lastActiveAt, day30)
      )
    );

  // At risk: inactive 30+ days (but has been active at least once)
  const [{ atRisk }] = await db
    .select({ atRisk: count() })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.membership, "pro"),
        lt(profilesTable.lastActiveAt, day30),
        isNotNull(profilesTable.lastActiveAt)
      )
    );

  // Never active: pro user with no lastActiveAt
  const [{ neverActive }] = await db
    .select({ neverActive: count() })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.membership, "pro"),
        isNull(profilesTable.lastActiveAt)
      )
    );

  // Dormant: inactive 60+ days
  const [{ dormant }] = await db
    .select({ dormant: count() })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.membership, "pro"),
        lt(profilesTable.lastActiveAt, day60),
        isNotNull(profilesTable.lastActiveAt)
      )
    );

  // At-risk users detail (up to 20, oldest active first)
  const atRiskUsers = await db
    .select({
      userId: profilesTable.userId,
      email: profilesTable.email,
      lastActiveAt: profilesTable.lastActiveAt,
      createdAt: profilesTable.createdAt,
    })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.membership, "pro"),
        lt(profilesTable.lastActiveAt, day30),
        isNotNull(profilesTable.lastActiveAt)
      )
    )
    .orderBy(profilesTable.lastActiveAt)
    .limit(20);

  // Never active users detail (up to 20)
  const neverActiveUsers = await db
    .select({
      userId: profilesTable.userId,
      email: profilesTable.email,
      createdAt: profilesTable.createdAt,
    })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.membership, "pro"),
        isNull(profilesTable.lastActiveAt)
      )
    )
    .orderBy(profilesTable.createdAt)
    .limit(20);

  return NextResponse.json({
    summary: {
      total: Number(total),
      active7: Number(active7),
      active30: Number(active30),
      atRisk: Number(atRisk),
      neverActive: Number(neverActive),
      dormant: Number(dormant),
    },
    atRiskUsers,
    neverActiveUsers,
  });
}
