export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type CarouselSlide = {
  heading: string;
  body: string;
};

export type DropDay = {
  day: number;
  phase: "teaser" | "reveal" | "hype" | "urgency" | "drop";
  phaseLabel: string;
  // Faceless text-on-screen video
  facelessHook: string;
  facelessScript: string[]; // 5-6 lines that appear one at a time on dark screen
  facelessVideoIdea: string; // one-line description of what visuals/AI images to use
  // Caption
  instagramCaption: string;
  hashtags: string[];
  // Carousel (for reveal, hype, drop days)
  carousel?: CarouselSlide[];
  // Story
  storyIdea: string;
};

export type DropCampaign = {
  productName: string;
  brandName: string;
  niche: string;
  dropDate: string;
  days: DropDay[];
  launchEmail: {
    subject: string;
    body: string;
  };
  discountCode: string;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiRl = await checkApiRateLimit(userId);
  if (apiRl) return apiRl;
  const rl = checkAiRateLimit(userId);
  if (rl) return rl;

  const { productName, brandName, niche, dropDate, price } = await req.json() as {
    productName?: string;
    brandName?: string;
    niche?: string;
    dropDate?: string;
    price?: string;
  };

  const brand = brandName || "the brand";
  const product = productName || "new product";
  const nicheCtx = niche || "streetwear";
  const drop = dropDate || "this week";
  const priceCtx = price ? `priced at ${price}` : "";

  const prompt = `You are writing viral faceless TikTok scripts for a ${nicheCtx} brand called "${brand}" dropping "${product}" ${priceCtx} on ${drop}.

BRAND VOICE: Dark, minimal, confident. This brand speaks to people who build quietly — no clout-chasing, no hype, just the work. The audience is someone who creates or builds something in silence and doesn't care about vanity metrics. Speak DIRECTLY to that person.

FACELESS FORMAT: Dark screen, text appears one line at a time. No filming. Think cinematic text-on-screen like a Nike ad, not a generic countdown teaser.

THE GOLDEN RULE FOR facelessScript:
- Line 1 (hook) MUST make the specific target person feel "that's me" — NOT "something big is coming"
- Write TO a specific person. "You build in silence." "You don't post for likes." "You create because you have to."
- NEVER use vague hype: no "something big", no "stay curious", no "the void whispers"
- Each line builds on the last — identity → tension → product → action
- CTA must name the brand or give a real instruction: "Follow @${brand}" or "Drop date: ${drop}"

BAD example (do NOT write like this):
"Something big is coming. The void whispers secrets. Darkness hides the treasure. Anticipate the unexpected. Stay tuned."

GOOD example (write like this):
"You don't build for attention. You build because it's in you. ${brand} was made for people like you. ${product}. Dropping ${drop}. Follow @${brand}."

Generate a 7-day drop campaign. Return ONLY valid JSON:

{
  "productName": "${product}",
  "brandName": "${brand}",
  "niche": "${nicheCtx}",
  "dropDate": "${drop}",
  "discountCode": "LAUNCH20",
  "days": [
    {
      "day": 1,
      "phase": "teaser",
      "phaseLabel": "Teaser",
      "facelessHook": "Max 8 words — speaks to the audience's IDENTITY, not hype. E.g. 'You build in silence.' or 'Most people scroll. You create.'",
      "facelessScript": [
        "Line 1: identity hook — makes target person feel seen (4-7 words)",
        "Line 2: deepen the identity — what they stand for (4-7 words)",
        "Line 3: introduce tension or contrast (4-7 words)",
        "Line 4: brand/product hint without being vague (4-7 words)",
        "Line 5: specific CTA — follow @brand or drop date (4-7 words)"
      ],
      "facelessVideoIdea": "Specific AI image prompt for dark cinematic background (e.g. 'extreme close-up of black premium hoodie fabric, studio lighting, dark background')",
      "instagramCaption": "2-3 sentences that speak to the audience's identity, not generic hype. End with clear CTA.",
      "hashtags": ["#${brand.replace(/\s/g,'')}","#Streetwear","#NewDrop","#LimitedEdition","#Fashion","#OOTD","#HypeBeast","#Drip"],
      "storyIdea": "Specific Instagram Story idea using polls, countdown timer, or question sticker — identity-driven, no filming required",
      "carousel": null
    }
  ],
  "launchEmail": {
    "subject": "subject line that speaks to the audience's identity",
    "body": "3 short paragraphs — personal, direct, identity-first"
  }
}

Day phases:
- Day 1: phase="teaser" — speak to WHO the audience is, not what's coming. carousel=null
- Day 2: phase="teaser" — deepen the identity, hint at the product category. carousel=null
- Day 3: phase="reveal" — first look. carousel with 4 slides: slide 1=bold identity headline, slide 2=product name + key detail, slide 3=who it's for specifically, slide 4=drop date + follow CTA
- Day 4: phase="reveal" — show the product in context. carousel=null
- Day 5: phase="hype" — why THIS person needs this product. carousel with 5 slides: identity hook, quality detail, design story, limited availability, price + CTA
- Day 6: phase="urgency" — last chance framing tied to identity. carousel with 3 slides: "Dropping Tomorrow", discount code reveal, "Link in bio — don't miss it"
- Day 7: phase="drop" — it's live. carousel with 4 slides: "It's here", product shot description, discount code, "Shop now — link in bio"

facelessScript rules: 5 lines, each 4-7 words. Identity → tension → brand → CTA arc. NEVER generic hype.
facelessVideoIdea: specific AI image prompt — dark, cinematic, related to the product or emotion.
carousel slides: heading is 2-5 bold words, body is 1 sharp supporting sentence.

Tone: dark, minimal, confident. Speaks directly to one specific person. No cringe. No generic marketing.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.85,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw) as DropCampaign;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[drop-campaign]", err);
    return NextResponse.json({ error: "Failed to generate campaign" }, { status: 500 });
  }
}
