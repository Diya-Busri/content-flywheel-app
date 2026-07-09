import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq } from "drizzle-orm";
import { EmbedSubscribeForm } from "./EmbedSubscribeForm";

export const dynamic = "force-dynamic";

export default async function EmbedSubscribePage({ params }: { params: { userId: string } }) {
  const { userId } = params;

  let brandName = "this creator";
  try {
    const [bv] = await db.select({ brandName: brandVoiceTable.brandName }).from(brandVoiceTable).where(eq(brandVoiceTable.userId, userId)).limit(1);
    if (bv?.brandName?.trim()) brandName = bv.brandName.trim();
  } catch {}

  return <EmbedSubscribeForm userId={userId} brandName={brandName} />;
}
