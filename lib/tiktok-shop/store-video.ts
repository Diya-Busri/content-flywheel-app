import { db } from "@/db/db";
import { tiktokShopVideosTable } from "@/db/schema/library-schema";

export type StoreVideoParams = {
  userId: string;
  productLink: string;
  videoUrl: string;
  videoStyle: string;
  platform: string;
};

/**
 * Store generated video record in tiktok_shop_videos table.
 */
export async function storeTiktokShopVideo(params: StoreVideoParams): Promise<string> {
  console.log("[store-video] Saving:", { userId: params.userId, platform: params.platform });

  const [row] = await db
    .insert(tiktokShopVideosTable)
    .values({
      userId: params.userId,
      productLink: params.productLink,
      videoUrl: params.videoUrl,
      videoStyle: params.videoStyle,
      platform: params.platform,
    })
    .returning({ id: tiktokShopVideosTable.id });

  if (!row?.id) {
    throw new Error("Failed to insert tiktok_shop_videos row");
  }

  console.log("[store-video] Saved id:", row.id);
  return row.id;
}
