import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { affiliateLinksTable } from "@/db/schema/affiliate-links-schema";
import { eq, desc } from "drizzle-orm";
import AffiliatesClient from "./AffiliatesClient";

export const metadata = { title: "Affiliates | Content Flywheel" };

export default async function AffiliatesPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const links = await db
    .select()
    .from(affiliateLinksTable)
    .where(eq(affiliateLinksTable.creatorUserId, userId))
    .orderBy(desc(affiliateLinksTable.createdAt));

  return <AffiliatesClient initialLinks={links} />;
}
