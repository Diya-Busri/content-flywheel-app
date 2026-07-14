import { StoreCustomizeClient } from "./StoreCustomizeClient";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Layers, ArrowRight } from "lucide-react";

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

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 pt-6 sm:px-6">
        <Link
          href="/dashboard/store/blocks"
          className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm hover:bg-orange-100 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-orange-900">
            <Layers className="h-4 w-4" />
            This page controls your photo, banner, bio and theme. Manage the rest of your page (products, socials, newsletter, custom sections) in the Page Builder →
          </span>
          <ArrowRight className="h-4 w-4 text-orange-600 shrink-0" />
        </Link>
      </div>
      <StoreCustomizeClient userId={userId} brandName={brandName} />
    </>
  );
}
