import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { creatorPromoCodesTable } from "@/db/schema/creator-promo-codes-schema";
import { eq, desc } from "drizzle-orm";
import DiscountCodesClient from "./DiscountCodesClient";

export const metadata = { title: "Discount Codes | Content Flywheel" };

export default async function DiscountCodesPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const codes = await db
    .select()
    .from(creatorPromoCodesTable)
    .where(eq(creatorPromoCodesTable.creatorUserId, userId))
    .orderBy(desc(creatorPromoCodesTable.createdAt));

  return <DiscountCodesClient initialCodes={codes} />;
}
