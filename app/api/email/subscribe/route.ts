import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildWelcomeHtml(creatorName: string | null): string {
  const displayName = creatorName ?? "our newsletter";
  const greeting = creatorName
    ? `Thanks for subscribing to <strong>${creatorName}</strong>!`
    : "Thanks for subscribing to our newsletter!";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're subscribed!</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header band -->
          <tr>
            <td style="background:linear-gradient(135deg,#f97316 0%,#fb923c 100%);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:36px;">🎉</p>
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.3px;">
                You&rsquo;re subscribed!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                ${greeting}
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.7;">
                You&rsquo;ll receive updates, offers, and exclusive content directly to your inbox. We&rsquo;re really glad to have you here.
              </p>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />

              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">
                If you ever change your mind, you can
                <a href="https://contentflywheel.com/unsubscribe" style="color:#f97316;text-decoration:underline;">unsubscribe here</a>
                at any time.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#d1d5db;font-size:12px;">
                Powered by <strong style="color:#f97316;">Content Flywheel</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, userId } = body;

    // --- Validate inputs ---
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // --- Check userId exists in profiles ---
    const profiles = await db
      .select({ userId: profilesTable.userId, email: profilesTable.email })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    const creatorProfile = profiles[0];

    // --- Check for duplicate ---
    const existing = await db
      .select({ id: emailContactsTable.id })
      .from(emailContactsTable)
      .where(
        and(
          eq(emailContactsTable.userId, userId),
          eq(emailContactsTable.email, email.toLowerCase().trim())
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "You are already subscribed!" },
        { status: 409 }
      );
    }

    // --- Insert contact ---
    await db.insert(emailContactsTable).values({
      userId,
      email: email.toLowerCase().trim(),
      name: name ? String(name).trim() : null,
      tags: [],
    });

    // --- Send welcome email via Resend ---
    // Use the creator's name from their profile email as a display hint if available.
    // For now we pass null so the email says "our newsletter" unless a creatorName is added later.
    const creatorName: string | null = null;

    try {
      await resend.emails.send({
        from: "Content Flywheel <onboarding@resend.dev>",
        to: email.toLowerCase().trim(),
        subject: "You're subscribed! 🎉",
        html: buildWelcomeHtml(creatorName),
      });
    } catch (emailErr) {
      // Log but don't fail the whole request — contact is already saved.
      console.error("Welcome email send error:", emailErr);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Subscribe POST error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
