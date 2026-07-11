/**
 * POST /api/academy/community/posts/[id]/ai-reply
 * ─────────────────────────────────────────────────
 * Called internally (via waitUntil) after a new community post is created.
 * Generates an AI reply using Claude and inserts it as a comment with
 * isAiReply: true — displayed with a "CF AI" badge in the UI.
 *
 * Security: protected by a shared secret header so it can only be called
 * from our own server, not by users directly.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { academyCommunityPostsTable } from "@/db/schema/academy-schema";
import { eq } from "drizzle-orm";
import { getCommunityPost, listComments, insertAiComment } from "@/db/queries/academy-queries";

const CF_AI_SYSTEM_PROMPT = `You are the Content Flywheel Community Manager — a friendly, knowledgeable AI assistant inside the Content Flywheel Academy community.

Content Flywheel is a platform that helps creators build and sell digital products (ebooks, guides, planners, workbooks, spreadsheets, journals, cookbooks, etc.).

Key platform features you know well:
- **Launch with AI**: Full agentic pipeline — user enters a goal, AI does market research, identifies product opportunities, writes all content, designs the cover + back cover with niche-matched palette, generates a 3D mockup, social preview, Instagram carousel, and sets up the store listing. Takes 5–10 minutes.
- **Digital Product Editor**: Drag-and-drop canvas (800×1100px) to edit ebook pages — text, images, icons, graphics. Has cover concepts (6 AI-designed styles), product palette system (one-click cohesive branding across front cover, back cover, and accent colour), and PDF export.
- **Design Studio**: Create social media posts, carousels, and thumbnails.
- **My Store**: Creator storefront with custom subdomain (yourname.contentflywheel.co.uk) or custom domain. Set up profile, bio, banner, product layout. Stripe payments built in — creators keep 100% of revenue.
- **Marketplace**: Public marketplace for product discovery.
- **Email Marketing**: Built-in email list — collect subscribers, send broadcast emails.
- **Academy**: This learning platform. Courses, lessons, XP, community (where you are now).
- **AI Coach**: Chat-based AI for strategy, pricing, niche advice, and guidance.
- **Video Credits**: For AI-generated video content.

Common questions you can answer:
- How to create a digital product (use Launch with AI or create manually)
- How to set up and customise their store
- How to publish and price products
- How to design covers and use the palette system
- How Stripe payments work (connect in Settings → Billing)
- How to grow their email list
- What formats are supported (ebook, guide, planner, journal, workbook, spreadsheet, cookbook)

Your reply style:
- Friendly, direct, practical — like a knowledgeable teammate
- Under 150 words
- Don't start with "Great question!" or similar filler
- If it's a question you genuinely can't answer, say "I'm not 100% sure on that one — try reaching out via the Help button in the bottom-left corner of the dashboard"
- If someone shares a win, celebrate it briefly and ask a follow-up question to keep the conversation going
- If it's feedback, acknowledge it and say the team will look into it`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate internal secret so this can't be called by users
    const secret = req.headers.get("x-ai-reply-secret");
    const expected = process.env.AI_COMMUNITY_SECRET ?? "";
    if (!expected || secret !== expected) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: postId } = await params;

    // Fetch post — abort if not found or already replied to
    const post = await getCommunityPost(postId);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (post.aiRepliedAt) return NextResponse.json({ ok: true, skipped: "already_replied" });

    // Fetch existing comments (shouldn't be any yet, but be safe)
    const existingComments = await listComments(postId);
    const alreadyReplied = existingComments.some((c) => (c as { isAiReply?: boolean }).isAiReply);
    if (alreadyReplied) return NextResponse.json({ ok: true, skipped: "already_replied" });

    const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "";
    if (!apiKey) {
      console.error("[ai-reply] No API key configured");
      return NextResponse.json({ error: "No AI key" }, { status: 500 });
    }

    // Build the user message — post title + content + category context
    const categoryLabel: Record<string, string> = {
      questions: "question",
      wins: "win/celebration",
      feedback: "feedback",
      product_showcase: "product showcase",
      marketing: "marketing question",
      general: "general message",
      admin: "announcement",
    };
    const category = categoryLabel[post.category] ?? post.category;

    const userMessage = `Community post (${category}):

Title: ${post.title}

${post.content}`;

    // Call Claude (Haiku — fast + cheap for community replies)
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: CF_AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[ai-reply] Claude error:", err.slice(0, 300));
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    const replyText = data.content?.find((b) => b.type === "text")?.text?.trim();

    if (!replyText) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    // Insert as a comment with isAiReply: true
    await insertAiComment(postId, replyText);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ai-reply] Failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
