/**
 * POST /api/research/create-script
 * Converts research insights into a Video Guide draft:
 *   1. GPT-4o-mini generates hook/body/cta + 5 scene prompts from the insight text
 *   2. Saves a scripts row (platform="video-guide") with the full VideoGuideData JSON
 *   3. Returns { libraryScriptId } — caller navigates to /dashboard/digital-products/video-guide?libraryScriptId=...
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { db } from "@/db/db";
import { scriptsTable } from "@/db/schema/library-schema";

export const dynamic = "force-dynamic";

// ── Types ──────────────────────────────────────────────────────────────────

type ScenePrompt = { scene: string; timing: string; prompt: string };

type AiScene = {
  scene: string;
  timing: string;
  visualDirection?: { aiPrompt?: string };
  textOverlay?: { exactText?: string };
  transition?: { toNextScene?: string; effects?: string; pacing?: string };
  audio?: { mood?: string };
};

type AiScriptResponse = {
  productName?: string;
  hook: string;
  body: string;
  cta: string;
  storytellingFramework?: string;
  frameworkRationale?: string;
  engagementTriggers?: string[];
  scenes: AiScene[];
};

// ── Main handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const aiRl = checkAiRateLimit(userId);
    if (aiRl) return aiRl;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const insights: string[] = Array.isArray(body.insights) ? body.insights.map(String) : [];
    const query: string = typeof body.query === "string" ? body.query.trim() : "";

    if (!insights.length) {
      return NextResponse.json({ error: "No insights provided" }, { status: 400 });
    }

    const topic = query || insights[0].slice(0, 120);
    const insightText = insights.join("\n\n");

    // ── GPT-4o-mini: generate script + scenes ─────────────────────────────

    const aiKey = process.env.OPENAI_API_KEY;
    let guideData: AiScriptResponse | null = null;

    if (aiKey) {
      const prompt = `You are an expert short-form video scriptwriter and creative director.
Convert the following research insight into a complete video guide.

Research topic: "${topic}"

Research insight:
${insightText.slice(0, 2000)}

Generate a viral short-form video script (TikTok/Instagram Reels style, ~30s) from this insight.
Then generate a 5-scene creative brief to film it.

Return ONLY this JSON object (no markdown, no code fences):
{
  "productName": "Short descriptive title for this video (5-8 words)",
  "hook": "The first 1-2 sentences that stop the scroll — pattern interrupt, surprising stat, or provocative question",
  "body": "2-3 sentences that deliver the core insight value — specific, concrete, actionable",
  "cta": "One clear call to action — save, follow, share, or comment",
  "storytellingFramework": "Pain Point Angle" | "Story Angle" | "Value Bomb Angle",
  "frameworkRationale": "1-2 sentences why this framework fits this topic",
  "engagementTriggers": [
    "First frame must work as thumbnail — [specific to this insight]",
    "Text readable in 0.5 seconds",
    "Open loop: [specific example for this script]",
    "CTA creates FOMO: [specific suggestion]"
  ],
  "scenes": [
    {
      "scene": "Scene 1 - Pattern Interrupt",
      "timing": "0-3s",
      "visualDirection": {
        "aiPrompt": "Photorealistic medium shot of [specific subject matching the hook topic], [clothing and expression], [environment with specific props], soft studio lighting, camera at eye level, cinematic style, muted warm tones, focused mood, vertical 9:16, 8k ultra detailed sharp focus"
      },
      "textOverlay": { "exactText": "Hook text here" },
      "transition": { "toNextScene": "quick cut", "effects": "zoom in slowly", "pacing": "fast (0.5-1s)" },
      "audio": { "mood": "curious" }
    },
    {
      "scene": "Scene 2 - Agitate / Context",
      "timing": "3-8s",
      "visualDirection": { "aiPrompt": "..." },
      "textOverlay": { "exactText": "..." },
      "transition": { "toNextScene": "fade", "effects": "none", "pacing": "medium (1-2s)" },
      "audio": { "mood": "tense" }
    },
    {
      "scene": "Scene 3 - The Insight / Solution",
      "timing": "8-18s",
      "visualDirection": { "aiPrompt": "..." },
      "textOverlay": { "exactText": "..." },
      "transition": { "toNextScene": "quick cut", "effects": "Ken Burns", "pacing": "medium (1-2s)" },
      "audio": { "mood": "uplifting" }
    },
    {
      "scene": "Scene 4 - Proof / Value",
      "timing": "18-25s",
      "visualDirection": { "aiPrompt": "..." },
      "textOverlay": { "exactText": "..." },
      "transition": { "toNextScene": "dissolve", "effects": "none", "pacing": "medium (1-2s)" },
      "audio": { "mood": "uplifting" }
    },
    {
      "scene": "Scene 5 - CTA",
      "timing": "25-30s",
      "visualDirection": { "aiPrompt": "..." },
      "textOverlay": { "exactText": "Save this + Follow for more" },
      "transition": { "toNextScene": "fade", "effects": "none", "pacing": "slow (2-3s)" },
      "audio": { "mood": "urgent" }
    }
  ]
}

Be specific to the research topic — every scene should reflect the actual insight content.
Output ONLY the JSON object.`;

      try {
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${aiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.8,
            max_tokens: 2000,
          }),
        });

        if (aiRes.ok) {
          const aiJson = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
          const raw = aiJson.choices?.[0]?.message?.content ?? "";
          guideData = JSON.parse(raw) as AiScriptResponse;
        }
      } catch {
        // fall through to fallback
      }
    }

    // ── Fallback: build a minimal guide from the raw insight text ────────

    if (!guideData || !guideData.hook || !Array.isArray(guideData.scenes)) {
      const words = insightText.split(/\s+/);
      const fallbackHook = words.slice(0, 15).join(" ");
      const fallbackBody = words.slice(15, 60).join(" ") || insightText.slice(0, 200);
      guideData = {
        productName: topic.slice(0, 60),
        hook: fallbackHook,
        body: fallbackBody,
        cta: "Save this + Follow for more insights",
        storytellingFramework: "Value Bomb Angle",
        frameworkRationale: "Research-backed insight works best as a value bomb to educate and engage.",
        engagementTriggers: [
          "First frame must work as thumbnail",
          "Text readable in 0.5 seconds",
          "CTA creates FOMO: Save this before it disappears",
        ],
        scenes: [
          {
            scene: "Scene 1 - Hook",
            timing: "0-3s",
            visualDirection: { aiPrompt: `Photorealistic close-up of a person looking surprised and engaged, modern minimal background, soft studio lighting, camera at eye level, cinematic style, vertical 9:16, 8k ultra detailed sharp focus` },
            textOverlay: { exactText: fallbackHook.slice(0, 60) },
            transition: { toNextScene: "quick cut", effects: "zoom in slowly", pacing: "fast (0.5-1s)" },
            audio: { mood: "curious" },
          },
          {
            scene: "Scene 2 - Context",
            timing: "3-10s",
            visualDirection: { aiPrompt: `Photorealistic medium shot of a person at a desk with research notes and a laptop, warm studio lighting, focused expression, vertical 9:16, 8k ultra detailed sharp focus` },
            textOverlay: { exactText: fallbackBody.slice(0, 80) },
            transition: { toNextScene: "fade", effects: "none", pacing: "medium (1-2s)" },
            audio: { mood: "tense" },
          },
          {
            scene: "Scene 3 - Insight",
            timing: "10-20s",
            visualDirection: { aiPrompt: `Photorealistic close-up of hands highlighting key text on a document, warm lamplight, shallow depth of field, editorial photography style, vertical 9:16, 8k ultra detailed sharp focus` },
            textOverlay: { exactText: insightText.slice(60, 140) || fallbackBody },
            transition: { toNextScene: "quick cut", effects: "Ken Burns", pacing: "medium (1-2s)" },
            audio: { mood: "uplifting" },
          },
          {
            scene: "Scene 4 - Value",
            timing: "20-26s",
            visualDirection: { aiPrompt: `Photorealistic overhead shot of a clean workspace with a notebook showing key insights, neutral tones, bright natural light, vertical 9:16, 8k ultra detailed sharp focus` },
            textOverlay: { exactText: "Here's what this means for you" },
            transition: { toNextScene: "dissolve", effects: "none", pacing: "medium (1-2s)" },
            audio: { mood: "uplifting" },
          },
          {
            scene: "Scene 5 - CTA",
            timing: "26-30s",
            visualDirection: { aiPrompt: `Photorealistic portrait of a person smiling confidently, clean bright background, studio lighting, vertical 9:16, 8k ultra detailed sharp focus` },
            textOverlay: { exactText: "Save this + Follow for more" },
            transition: { toNextScene: "fade", effects: "none", pacing: "slow (2-3s)" },
            audio: { mood: "urgent" },
          },
        ],
      };
    }

    // ── Build VideoGuideData ───────────────────────────────────────────────

    const productName = guideData.productName || topic;
    const scenes = guideData.scenes ?? [];

    // scenePrompts: the simplified array required by VideoGuideData
    const scenePrompts: ScenePrompt[] = scenes.map((s) => ({
      scene: s.scene,
      timing: s.timing,
      prompt: s.visualDirection?.aiPrompt ?? "",
    }));

    const videoGuideData = {
      productName,
      productDescription: insightText.slice(0, 500),
      script: {
        hook: guideData.hook,
        body: guideData.body,
        cta: guideData.cta,
      },
      scenePrompts,
      scenes,
      storytellingFramework: guideData.storytellingFramework,
      frameworkRationale: guideData.frameworkRationale,
      engagementTriggers: guideData.engagementTriggers ?? [],
      videoFormat: { aspectRatio: "9:16", orientation: "vertical", resolution: "1080×1920" },
      exportSettings: { resolution: "1080×1920", fps: 30, format: "MP4", aspectRatio: "9:16" },
      editingSteps: {
        CapCut: [
          "Open CapCut and create a new project (9:16 vertical)",
          "Import your images/clips in scene order",
          "Add text overlays per the scene brief",
          "Add transitions and effects per scene direction",
          "Export as MP4 1080×1920 at 30fps",
        ],
      },
    };

    // ── Save to scripts table ─────────────────────────────────────────────

    const title = `Video Guide: ${productName.slice(0, 100)}`;
    const [inserted] = await db.insert(scriptsTable).values({
      userId,
      title,
      content: JSON.stringify(videoGuideData),
      platform: "video-guide",
      status: "draft",
      metadata: { source: "research", query, insights: insights.slice(0, 5) },
    }).returning({ id: scriptsTable.id });

    if (!inserted?.id) {
      return NextResponse.json({ error: "Failed to save script" }, { status: 500 });
    }

    return NextResponse.json({ libraryScriptId: inserted.id });
  } catch (err) {
    console.error("[create-script]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
