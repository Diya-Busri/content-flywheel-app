/**
 * PATCH /api/admin/creator-applications/[id]
 * Manually accept, waitlist, or reject an application.
 * Admin-only.
 *
 * Body: { status: "accepted" | "waitlisted" | "rejected"; reviewNote?: string }
 *
 * Sends a notification email to the applicant when status changes to "accepted" or "rejected".
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { creatorApplicationsTable } from "@/db/schema/creator-applications-schema";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import type { ApplicationStatus } from "@/db/schema/creator-applications-schema";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Content Flywheel <hello@contentflywheel.co.uk>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
const VALID_STATUSES: ApplicationStatus[] = ["accepted", "waitlisted", "rejected"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const status = typeof body.status === "string" ? body.status as ApplicationStatus : null;
  const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : null;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const [existing] = await db
      .select()
      .from(creatorApplicationsTable)
      .where(eq(creatorApplicationsTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Generate a fresh invite token when manually accepting
    const newInviteToken = status === "accepted" ? (existing.inviteToken ?? randomUUID()) : null;

    await db
      .update(creatorApplicationsTable)
      .set({
        status,
        inviteToken: status === "accepted" ? newInviteToken : existing.inviteToken,
        reviewNote: reviewNote ?? existing.reviewNote,
        reviewedAt: new Date(),
      })
      .where(eq(creatorApplicationsTable.id, id));

    // Send email notification when status changes
    if (existing.status !== status) {
      try {
        if (status === "accepted" && newInviteToken) {
          const signUpUrl = `${APP_URL}/sign-up?invite=${newInviteToken}`;
          await resend.emails.send({
            from: FROM,
            to: existing.email,
            subject: "🎉 You've been accepted into Content Flywheel!",
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
                <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">You're in, ${existing.name}! 🎉</h1>
                <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:16px">
                  Great news — your Content Flywheel application has been <strong>manually reviewed and accepted</strong>. We're excited to have you.
                </p>
                ${reviewNote ? `<p style="color:#555;font-size:14px;background:#f9f9f9;border-left:3px solid #f97316;padding:12px 16px;border-radius:4px;margin-bottom:16px">"${reviewNote}"</p>` : ""}
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
                <p style="color:#bbb;font-size:12px">Content Flywheel · contentflywheel.co.uk</p>
              </div>
            `,
          });
        } else if (status === "rejected") {
          await resend.emails.send({
            from: FROM,
            to: existing.email,
            subject: "Your Content Flywheel application",
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
                <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">Thanks for applying, ${existing.name}</h1>
                <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:16px">
                  After reviewing your application, we're not able to offer you a spot on Content Flywheel right now.
                </p>
                ${reviewNote ? `<p style="color:#555;font-size:14px;background:#f9f9f9;border-left:3px solid #e5e7eb;padding:12px 16px;border-radius:4px;margin-bottom:16px">"${reviewNote}"</p>` : ""}
                <p style="color:#888;font-size:13px;line-height:1.5">
                  You're welcome to reapply in the future as your audience grows. Keep creating!
                </p>
                <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
                <p style="color:#bbb;font-size:12px">Content Flywheel · contentflywheel.co.uk</p>
              </div>
            `,
          });
        }
      } catch (emailErr) {
        console.error("[admin/creator-applications/[id]] email send failed:", emailErr);
      }
    }

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("[admin/creator-applications/[id]]", err);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}
