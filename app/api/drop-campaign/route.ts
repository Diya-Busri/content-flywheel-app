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
  // Reel: specific filming directions
  reelHook: string;
  reelDirections: string[]; // 4-5 specific shot/filming instructions
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

  const prompt = `You are a social media strategist for a ${nicheCtx} brand called "${brand}" dropping "${product}" ${priceCtx} on ${drop}.

Generate a 7-day drop campaign that ACTUALLY CONVERTS — with real Reel filming directions and carousel slides, not just text posts. Return ONLY valid JSON:

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
      "reelHook": "One punchy sentence to say at the very start of the Reel (spoken or text overlay)",
      "reelDirections": [
        "Shot 1: specific camera direction (e.g. extreme close-up of fabric texture, hand pulling hoodie out of box)",
        "Shot 2: another specific shot",
        "Shot 3: another specific shot",
        "Shot 4: transition or ending shot",
        "Edit tip: specific edit/audio suggestion (e.g. use slow-motion on the reveal, add deep bass sound effect)"
      ],
      "instagramCaption": "2-3 sentence caption with strong CTA",
      "hashtags": ["#VoidHours", "#Streetwear", "#NewDrop", "#LimitedEdition", "#Fashion", "#OOTD", "#HypeBeast", "#Drip"],
      "storyIdea": "Specific story idea with interaction (poll, question sticker, countdown timer, etc.)",
      "carousel": null
    }
  ],
  "launchEmail": {
    "subject": "subject line",
    "body": "3 paragraphs"
  }
}

Day phases and what content to include:
- Day 1: phase="teaser" — NO product shown. Film mysterious details: hands, fabric close-up, packaging. Build intrigue. carousel=null
- Day 2: phase="teaser" — More hints. Film shadow silhouette of hoodie, partial logo. carousel=null
- Day 3: phase="reveal" — FIRST LOOK. Full product reveal Reel. Also include carousel with 4 slides: slide 1=bold reveal headline, slide 2=product name + key detail, slide 3=who it's for, slide 4=drop date CTA
- Day 4: phase="reveal" — WORN. Film yourself (or a model) wearing it: walking, styling, fit check. carousel=null
- Day 5: phase="hype" — WHY IT SELLS. carousel with 5 slides: slide 1=bold hook, slide 2=material/quality detail, slide 3=the design story, slide 4=limited availability, slide 5=price + where to get it
- Day 6: phase="urgency" — TOMORROW. Last chance content. carousel with 3 slides: slide 1="Dropping Tomorrow", slide 2=discount code reveal, slide 3="Link in bio"
- Day 7: phase="drop" — IT'S LIVE. Reel of putting it on for the first time. carousel with 4 slides: slide 1="It's here", slide 2=product shot, slide 3=discount code, slide 4=shop now CTA

reelDirections MUST be specific filming instructions (not vague). Tell them EXACTLY what to film: camera angle, movement, what's in frame, how long the clip should be, any transitions or audio.

Carousel slides: heading is short bold text (3-6 words), body is 1-2 supporting sentences.

Tone: dark, minimal, confident. This is a premium streetwear brand. No cringe, no generic hype.`;

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
