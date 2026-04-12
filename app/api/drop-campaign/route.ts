import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type DropDay = {
  day: number;
  phase: "teaser" | "reveal" | "hype" | "urgency" | "drop";
  phaseLabel: string;
  tiktokHook: string;
  tiktokScript: string[];
  instagramCaption: string;
  hashtags: string[];
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

  const prompt = `You are a social media growth strategist for a ${nicheCtx} brand called "${brand}". They are dropping a new product: "${product}" ${priceCtx} on ${drop}.

Generate a 7-day drop campaign to build hype and drive sales. Return ONLY valid JSON with this exact structure:

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
      "tiktokHook": "one sentence hook that stops the scroll",
      "tiktokScript": ["line 1", "line 2", "line 3", "line 4", "line 5"],
      "instagramCaption": "2-3 sentences caption",
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8"],
      "storyIdea": "one sentence story idea"
    }
  ],
  "launchEmail": {
    "subject": "email subject line",
    "body": "3-4 paragraph email body"
  }
}

Day phases:
- Day 1: phase="teaser", phaseLabel="Teaser" — mystery, something is coming, don't show the product yet
- Day 2: phase="teaser", phaseLabel="Teaser" — build more anticipation, hint at details
- Day 3: phase="reveal", phaseLabel="Reveal" — first look, show the product
- Day 4: phase="reveal", phaseLabel="Reveal" — show it being worn, lifestyle angle
- Day 5: phase="hype", phaseLabel="Hype" — social proof, why people want this
- Day 6: phase="urgency", phaseLabel="Urgency" — limited stock, dropping tomorrow
- Day 7: phase="drop", phaseLabel="Drop Day" — it's live, buy now, discount code

TikTok scripts should be faceless text-on-screen style (dark background, lines appear one at a time). Each line is short (5-8 words max), punchy, and builds tension. 5 lines per day.

Make everything feel like a real streetwear/fashion brand. Tone: confident, mysterious, minimal. NO generic marketing speak.`;

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
