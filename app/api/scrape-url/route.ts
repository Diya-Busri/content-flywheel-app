import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 15;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { url } = body as { url?: string };
  if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

  let normalised = url.trim();
  if (!/^https?:\/\//i.test(normalised)) normalised = `https://${normalised}`;

  let html = "";
  try {
    const res = await fetch(normalised, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentFlywheel/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: `Could not fetch that URL: ${e instanceof Error ? e.message : e}` }, { status: 422 });
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : "";

  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  const excerpt = bodyMatch ? stripHtml(bodyMatch[0]).slice(0, 1500) : stripHtml(html).slice(0, 1500);

  return NextResponse.json({ title, description, excerpt, url: normalised });
}
