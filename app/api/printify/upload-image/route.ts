import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { userSettingsTable } from "@/db/schema/user-settings-schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { printifyFetch } from "@/lib/printify";
import { alertPrintifyError } from "@/lib/printify-alert";

/** Upload a design image to Printify's image library and return the Printify image ID */
export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { imageUrl, fileName } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const [settings] = await db
      .select({ printifyApiKey: userSettingsTable.printifyApiKey })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, userId))
      .limit(1);

    if (!settings?.printifyApiKey) {
      return NextResponse.json({ error: "Printify not connected" }, { status: 400 });
    }

    // Upload image to Printify by URL
    const result = await printifyFetch("/uploads/images.json", settings.printifyApiKey, {
      method: "POST",
      body: JSON.stringify({
        file_name: fileName ?? "design.png",
        url: imageUrl,
      }),
    });

    return NextResponse.json({ imageId: result.id, preview: result.preview_url });
  } catch (err) {
    console.error("[printify/upload-image]", err);
    await alertPrintifyError({ route: "/api/printify/upload-image", message: err instanceof Error ? err.message : "Image upload failed", userId });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}
