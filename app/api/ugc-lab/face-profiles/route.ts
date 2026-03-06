import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { faceProfilesTable } from "@/db/schema/face-profiles-schema";
import { eq, desc } from "drizzle-orm";
import { uploadFaceImage } from "@/lib/ugc-lab/upload-face-image";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** GET: List face profiles for the current user. */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);

    if (rl) return rl;

    const profiles = await db
      .select()
      .from(faceProfilesTable)
      .where(eq(faceProfilesTable.userId, userId))
      .orderBy(desc(faceProfilesTable.createdAt));

    return NextResponse.json({ profiles });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    const code = (err as { code?: string })?.code;

    // 42P01 = undefined_table; handle missing face_profiles table gracefully
    if (code === "42P01" || (msg.includes("face_profiles") && msg.includes("does not exist"))) {
      console.warn("[face-profiles] Table missing. Run migration: db/migrations/0025_ugc_lab_all_tables.sql");
      return NextResponse.json({ profiles: [] }, { status: 200 });
    }

    console.error("[face-profiles] GET Error:", err);
    return NextResponse.json({ error: "Failed to list profiles" }, { status: 500 });
  }
}

/** POST: Create a new face profile. */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string)?.trim();

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid format. Use JPEG, PNG, or WebP." }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Image too large. Max 5MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type.includes("png") ? "image/png" : file.type.includes("webp") ? "image/webp" : "image/jpeg";
    const imageUrl = await uploadFaceImage(buffer, contentType);

    const [profile] = await db
      .insert(faceProfilesTable)
      .values({ userId, name, imageUrl })
      .returning();

    return NextResponse.json({ profile });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    const code = (err as { code?: string })?.code;

    if (code === "42P01" || (msg.includes("face_profiles") && msg.includes("does not exist"))) {
      console.warn("[face-profiles] Table missing. Run migration: db/migrations/0025_ugc_lab_all_tables.sql");
      return NextResponse.json(
        { error: "Database not ready. Run UGC Lab migration (0025_ugc_lab_all_tables.sql)." },
        { status: 503 }
      );
    }

    console.error("[face-profiles] POST Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save profile" },
      { status: 500 }
    );
  }
}
