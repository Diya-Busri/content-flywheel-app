import { StoreCustomizeClient } from "./StoreCustomizeClient";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function StoreCustomizePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [brandVoice] = await db
    .select({ brandName: brandVoiceTable.brandName })
    .from(brandVoiceTable)
    .where(eq(brandVoiceTable.userId, userId))
    .limit(1)
    .catch(() => [undefined]);

  const brandName = brandVoice?.brandName?.trim() || "Your Store";

  return <StoreCustomizeClient userId={userId} brandName={brandName} />;
}
