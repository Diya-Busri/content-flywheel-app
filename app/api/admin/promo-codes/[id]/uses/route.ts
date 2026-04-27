import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { promoCodeUsesTable } from "@/db/schema/promo-codes-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const uses = await db
    .select({
      id: promoCodeUsesTable.id,
      userId: promoCodeUsesTable.userId,
      usedAt: promoCodeUsesTable.usedAt,
      email: profilesTable.email,
    })
    .from(promoCodeUsesTable)
    .leftJoin(profilesTable, eq(promoCodeUsesTable.userId, profilesTable.userId))
    .where(eq(promoCodeUsesTable.codeId, params.id))
    .orderBy(promoCodeUsesTable.usedAt);

  return NextResponse.json({ uses });
}
