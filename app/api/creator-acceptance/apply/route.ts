/**
 * POST /api/creator-acceptance/apply
 * Submit a creator acceptance application.
 *
 * Body: { name, email, platform, niche, followerCount, goal, referrerUserId? }
 *
 * Auto-screening rule:
 *   followerCount >= 10 000  →  status = "accepted"  (sends acceptance email)
 *   followerCount  < 10 000  →  status = "waitlisted" (sends waitlist email)
 *
 * Returns: { status: ApplicationStatus; id: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { creatorApplicationsTable } from "@/db/schema/creator-applications-schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Content Flywheel <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
const MIN_FOLLOWERS = 10_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const platform = typeof body.platform === "string" ? body.platform.trim() : "";
    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const followerCount = typeof body.followerCount === "number" ? Math.max(0, Math.floor(body.followerCount)) : 0;
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const referrerUserId = typeof body.referrerUserId === "string" ? body.referrerUserId.trim() : null;

    if (!name || !email || !platform || !niche || !goal) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Duplicate check — one application per email
    const [existing] = await db
      .select({ id: creatorApplicationsTable.id, status: creatorApplicationsTable.status })
      .from(creatorApplicationsTable)
      .where(eq(creatorApplicationsTable.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json({ status: existing.status, id: existing.id, duplicate: true });
    }

    // Auto-screen
    const status = followerCount >= MIN_FOLLOWERS ? "accepted" : "waitlisted";
    const inviteToken = status === "accepted" ? randomUUID() : null;

    const [inserted] = await db
      .insert(creatorApplicationsTable)
      .values({
        name,
        email,
        platform,
        niche,
        followerCount,
        goal,
        status,
        inviteToken,
        referrerUserId: referrerUserId ?? null,
        reviewedAt: new Date(), // auto-reviewed on insert
      })
      .returning({ id: creatorApplicationsTable.id });

    // Send email (best-effort — don't fail the request if email fails)
    try {
      if (status === "accepted" && inviteToken) {
        const signUpUrl = `${APP_URL}/sign-up?invite=${inviteToken}`;
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: "🎉 You've been accepted into Content Flywheel!",
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
              <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Welcome, ${name}! You're in. 🎉</h1>
              <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:16px">
                Your application to Content Flywheel has been <strong>accepted</strong>. We reviewed your profile and you're exactly the kind of creator we built this platform for.
              </p>
              <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:24px">
                Use the button below to create your account and set your password. <strong>This link is unique to you</strong> — don't share it.
              </p>
              <a href="${signUpUrl}" style="display:inline-block;background:#f97316;color:#fff;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px">
                Create your account →
              </a>
              <p style="color:#888;font-size:13px;line-height:1.5">
                If you ever need to reset your password, email us at <a href="mailto:contentflywheel@gmail.com" style="color:#f97316">contentflywheel@gmail.com</a> and we'll sort it for you.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
              <p style="color:#bbb;font-size:12px">You received this because you applied at contentflywheel.co.uk</p>
            </div>
          `,
        });
      } else {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: "Your Content Flywheel application — we'll be in touch",
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
              <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Thanks for applying, ${name}</h1>
              <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:16px">
                We've received your application and you're on our <strong>priority waitlist</strong>. As we open up more spots, accepted creators are notified first.
              </p>
              <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:24px">
                In the meantime, keep growing your audience — the sooner you hit <strong>10,000 followers</strong>, the sooner you'll be fast-tracked in.
              </p>
              <p style="color:#888;font-size:13px;line-height:1.5">
                We'll email you the moment a spot opens for you. No need to reapply.
              </p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
              <p style="color:#bbb;font-size:12px">You received this because you applied at contentflywheel.co.uk</p>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("[creator-acceptance/apply] email send failed:", emailErr);
    }

    return NextResponse.json({ status, id: inserted?.id ?? "" });
  } catch (err) {
    console.error("[creator-acceptance/apply]", err);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
