import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { checkSpendLimit } from "@/lib/spend-guard";

const FAL_API_KEY = () => {
  const key = process.env.FAL_API_KEY?.trim();
  if (!key) throw new Error("FAL_API_KEY is not set");
  return key;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sg = await checkSpendLimit("fal");
  if (sg) return sg;

  let imageUrl: string;
  try {
    const body = await request.json() as { imageUrl?: string };
    imageUrl = (body.imageUrl ?? "").trim();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const res = await fetch("https://fal.run/fal-ai/birefnet", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_API_KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      model: "General Use (Light)",
      operating_resolution: "1024x1024",
      output_format: "png",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Background removal failed: ${text.slice(0, 200)}` }, { status: 500 });
  }

  const data = await res.json() as { image?: { url: string } };
  const cleanUrl = data.image?.url;
  if (!cleanUrl) return NextResponse.json({ error: "No image returned from bg removal" }, { status: 500 });

  // Re-host to Vercel Blob so the URL is permanent
  const imgRes = await fetch(cleanUrl);
  if (!imgRes.ok) return NextResponse.json({ error: "Failed to fetch cleaned image" }, { status: 500 });
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const blob = await put(`pod-designs/${userId}/nobg-${Date.now()}.png`, buffer, { access: "public", contentType: "image/png" });

  return NextResponse.json({ url: blob.url });
}
