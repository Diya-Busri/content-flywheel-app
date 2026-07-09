/**
 * POST /api/template-studio/animation-prompts
 * Generates a batch of AI animation video prompts (for Kling AI / Pika / Runway).
 * Each prompt includes:
 *  - caption: the text overlay shown on screen (the "POV: ..." hook)
 *  - animationPrompt: full copy-paste prompt for the AI video generator
 *  - mood: suggested background music vibe
 *
 * Body: { characterName, characterDescription, videoStyle, count }
 * Response: { prompts: AnimationPrompt[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

export type AnimationPrompt = {
  caption: string;
  animationPrompt: string;
  mood: string;
  engagementHook: string;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const aiRl = checkAiRateLimit(userId);
    if (aiRl) return aiRl;

    const body = await request.json().catch(() => ({}));
    const b = body as {
      characterName?: string;
      characterDescription?: string;
      videoStyle?: string;
      count?: number;
    };

    const characterName = typeof b.characterName === "string" ? b.characterName.trim() : "the character";
    const characterDescription = typeof b.characterDescription === "string" ? b.characterDescription.trim() : "";
    const videoStyle = typeof b.videoStyle === "string" ? b.videoStyle.trim() : "relatable comedy";
    const count = typeof b.count === "number" && b.count >= 1 && b.count <= 20 ? b.count : 10;

    if (!characterDescription) {
      return NextResponse.json({ error: "characterDescription is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });

    const prompt = `You are a viral short-form video strategist who specialises in 3D animated character content (like @meetquack on TikTok). You deeply understand what makes people stop scrolling, comment, and tag their friends.

Character name: ${characterName}
Character description: ${characterDescription}
Video style / vibe: ${videoStyle}

Generate exactly ${count} video ideas engineered for maximum engagement. Every idea MUST use one of these proven high-engagement formats — spread them across the batch:

FORMAT A — "POV:" (viewer IS the character)
The caption puts the viewer in the scene. Hyper-specific, painful accuracy.
Examples: "POV: you finished the last snack they were saving", "POV: you said 'on my way' and haven't left yet"

FORMAT B — "When you…" reaction
One character reacts to a universally relatable situation with exaggerated emotion. No explanation needed.
Examples: "When he says 5 minutes… 45 minutes later", "When you accidentally open the front camera"

FORMAT C — "Me vs them" contrast
Two characters with completely opposite energy about the same thing. Drives "which one are you?" comments.
Examples: "Me on payday vs me 3 days later", "Her: fine. Also her:"

FORMAT D — "That moment when…" called-out feeling
Captures a specific feeling everyone has had but never put into words. Makes people feel seen.
Examples: "That moment when the vibe shifts and you don't know why", "When you clean your room and feel like a new person"

FORMAT E — Silent storytelling (no caption explanation needed)
The character's expression and action tells the whole story in 2 seconds. Built to loop.
Examples: Character frantically hiding snacks when they hear footsteps, Character checking the time every 2 seconds waiting for food delivery

ENGAGEMENT RULES — every idea must follow these:
- Caption is under 12 words, punchy, NO filler words
- The scenario must make someone immediately think "this is literally me" or "this is literally my partner/friend"
- Designed to be tagworthy — someone should want to tag another person in the comments
- Loopable — action should feel satisfying to watch more than once
- Emotion must be readable in a single freeze-frame (the character's face/body tells the story)
- Avoid generic scenarios — be painfully specific (not "when you're tired" but "when it's 11pm and someone suggests 'one more episode'")

For each idea provide:
1. caption: The exact text overlay for the screen — punchy, under 12 words, uses one of the format hooks above
2. animationPrompt: A detailed copy-paste prompt for Kling AI / Pika / Runway. Single paragraph, 60-100 words. Must include:
   - Character's exact appearance (from description above)
   - Precise scene/setting with props and environment
   - The specific action AND facial expression/emotion
   - Camera angle and movement (e.g. slow zoom in, close-up on face, wide shot)
   - 3D Pixar-style animation, lighting mood
   - Secondary character if the format needs one (describe them briefly)
3. mood: 2-4 words for background music (be specific — not just "upbeat" but "chaotic kitchen chaos", "dramatic slow-mo", "tense silence then drop")
4. engagementHook: ONE sentence explaining exactly why this will make people comment or tag someone (e.g. "Couples will tag each other because both will claim they're the innocent one")

Return ONLY a valid JSON array, no markdown:
[{"caption":"...","animationPrompt":"...","mood":"...","engagementHook":"..."},...]`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a viral content strategist. Return only a valid JSON array. No markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "AI request failed. Try again." }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    raw = raw.replace(/^```json\n?/, "").replace(/^```\n?/, "").replace(/\n?```$/, "").trim();

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "Could not parse prompts" }, { status: 500 });
    }

    const parsed = JSON.parse(match[0]) as Array<{
      caption?: string;
      animationPrompt?: string;
      mood?: string;
      engagementHook?: string;
    }>;

    const prompts: AnimationPrompt[] = parsed.slice(0, count).map((item) => ({
      caption: typeof item.caption === "string" ? item.caption.trim() : "",
      animationPrompt: typeof item.animationPrompt === "string" ? item.animationPrompt.trim() : "",
      mood: typeof item.mood === "string" ? item.mood.trim() : "upbeat",
      engagementHook: typeof item.engagementHook === "string" ? item.engagementHook.trim() : "",
    })).filter((p) => p.caption && p.animationPrompt);

    return NextResponse.json({ prompts });
  } catch (err) {
    console.error("[template-studio/animation-prompts]", err);
    return NextResponse.json({ error: "Failed to generate prompts" }, { status: 500 });
  }
}
