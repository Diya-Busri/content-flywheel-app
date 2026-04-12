import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

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

  const prompt = `You are a faceless content strategist for a ${nicheCtx} brand called "${brand}" dropping "${product}" ${priceCtx} on ${drop}.

This brand is FACELESS — no filming, no face on camera. All content is AI-generated visuals, text-on-screen videos (dark background, lines appear one at a time), and designed carousel slides.

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
      "facelessHook": "The first line that appears on screen — maximum 8 words, must stop the scroll",
      "facelessScript": [
        "Line 1 (hook)",
        "Line 2",
        "Line 3",
        "Line 4",
        "Line 5 (CTA or cliffhanger)"
      ],
      "facelessVideoIdea": "One sentence describing what AI-generated image or visual to use as background (e.g. 'dark cinematic close-up of premium black fabric texture')",
      "instagramCaption": "2-3 sentence caption with CTA",
      "hashtags": ["#VoidHours", "#Streetwear", "#NewDrop", "#LimitedEdition", "#Fashion", "#OOTD", "#HypeBeast", "#Drip"],
      "storyIdea": "Specific story idea using polls, countdown timer, or question sticker — no filming required",
      "carousel": null
    }
  ],
  "launchEmail": {
    "subject": "subject line",
    "body": "3 short paragraphs"
  }
}

Day phases:
- Day 1: phase="teaser" — mystery, don't reveal the product. carousel=null
- Day 2: phase="teaser" — more anticipation, hint at something. carousel=null
- Day 3: phase="reveal" — first look text video. carousel with 4 slides: slide 1=bold reveal headline, slide 2=product name + key detail, slide 3=who it's for, slide 4=drop date CTA
- Day 4: phase="reveal" — show the product worn (use AI lifestyle mockup image as background). carousel=null
- Day 5: phase="hype" — why people want this. carousel with 5 slides: hook, quality detail, design story, limited availability, price + CTA
- Day 6: phase="urgency" — dropping tomorrow. carousel with 3 slides: "Dropping Tomorrow", discount code reveal, "Link in bio"
- Day 7: phase="drop" — it's live. carousel with 4 slides: "It's here", product shot, discount code, "Shop now"

facelessScript: each line is 4-7 words max. Should build tension line by line. Think: cinematic, minimal, powerful.
facelessVideoIdea: describe a specific AI image prompt suitable for the background (dark, moody, cinematic).
carousel slides: heading is 2-5 bold words, body is 1 supporting sentence.

Tone: dark, minimal, premium streetwear. No cringe. No generic marketing.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
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
