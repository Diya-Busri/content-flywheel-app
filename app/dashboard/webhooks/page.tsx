import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { creatorWebhooksTable } from "@/db/schema/creator-webhooks-schema";
import { eq, and } from "drizzle-orm";
import WebhooksClient from "./WebhooksClient";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const hooks = await db
    .select()
    .from(creatorWebhooksTable)
    .where(and(eq(creatorWebhooksTable.userId, userId), eq(creatorWebhooksTable.active, true)));

  return <WebhooksClient initialHooks={hooks} />;
}
