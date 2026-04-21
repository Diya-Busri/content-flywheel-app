import { getSupabaseAdmin } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

const BUCKET = "diagrams";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function buildMermaidCode(
  slideType: string,
  slideTitle: string,
  slidePoints: string[],
  apiKey: string
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Convert the provided slide data into valid Mermaid.js diagram syntax only. Return ONLY the raw Mermaid code, no code fences, no explanation.
For funnel → use graph TD with trapezoid shapes
For steps → use graph LR with rectangular nodes and arrows
For vs_comparison → use graph LR with two nodes and a VS node between
For stat_callout → use graph TD with one large central node
For text_hook → use graph TD with a single large styled node
For flowchart → use flowchart TD
Always use dark theme compatible styles. Keep node labels short (max 20 chars).`,
        },
        {
          role: "user",
          content: `slideType: ${slideType}\ntitle: ${slideTitle}\npoints:\n${slidePoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (d.choices?.[0]?.message?.content ?? "")
    .replace(/^```mermaid?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

async function renderMermaidToPng(mermaidCode: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { launchPuppeteerBrowser } = require("@/lib/puppeteer-launch");
  const browser = await launchPuppeteerBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 600 });
    await page.setContent(`<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { background: #000; margin: 0; padding: 40px;
           display: flex; align-items: center; justify-content: center; min-height: 520px; }
    .mermaid svg { max-width: 1000px; height: auto; }
  </style>
</head>
<body>
  <div class="mermaid">${escapeHtml(mermaidCode)}</div>
  <script>mermaid.initialize({ theme: 'dark', darkMode: true, securityLevel: 'loose', startOnLoad: true });</script>
</body>
</html>`, { waitUntil: "networkidle0", timeout: 20000 });
    await page.waitForSelector(".mermaid svg", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));
    const el = await page.$(".mermaid");
    if (!el) throw new Error("Mermaid element not found");
    const png = await el.screenshot({ type: "png" });
    return Buffer.from(png as ArrayBuffer);
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function generateDiagramForScene({
  userId,
  slideType,
  slideTitle,
  slidePoints,
  apiKey,
}: {
  userId: string;
  slideType: string;
  slideTitle: string;
  slidePoints: string[];
  apiKey: string;
}): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;

    const mermaidCode = await buildMermaidCode(slideType, slideTitle, slidePoints, apiKey);
    if (!mermaidCode) return null;

    const pngBuffer = await renderMermaidToPng(mermaidCode);

    const storagePath = `${userId}/diagrams/${randomUUID()}/diagram-${Date.now()}.png`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, pngBuffer, { contentType: "image/png", upsert: true });
    if (error) { console.error("[generate-diagram] upload error:", error); return null; }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (err) {
    console.error("[generate-diagram] error:", err);
    return null;
  }
}
