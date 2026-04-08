import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, gte, lt, and, isNotNull } from "drizzle-orm";
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAudienceFilter(audience: string) {
  const now = new Date();
  const day7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  switch (audience) {
    case "active_7d":
      return and(eq(profilesTable.membership, "pro"), gte(profilesTable.lastActiveAt, day7));
    case "active_30d":
      return and(eq(profilesTable.membership, "pro"), gte(profilesTable.lastActiveAt, day30));
    case "inactive_30d":
      return and(eq(profilesTable.membership, "pro"), lt(profilesTable.lastActiveAt, day30), isNotNull(profilesTable.lastActiveAt));
    default:
      return eq(profilesTable.membership, "pro");
  }
}

/** Build a map of email → first name from Clerk */
async function buildNameMap(emails: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ limit: 500 });
    for (const u of data) {
      const email = u.emailAddresses?.[0]?.emailAddress;
      if (email) {
        const name = u.firstName?.trim() || u.username?.trim() || email.split("@")[0];
        map.set(email.toLowerCase(), name);
      }
    }
  } catch {
    // Fall back to email-derived names
    for (const email of emails) {
      const part = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      map.set(email.toLowerCase(), part);
    }
  }
  return map;
}

/** Convert plain-text/markdown body to a clean HTML email */
function buildHtml(rawBody: string, name: string): string {
  const personalised = rawBody.replace(/\{\{name\}\}/gi, name);

  // Convert markdown-ish syntax to HTML
  const html = personalised
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#f97316;text-decoration:none;">$1</a>')
    .split("\n")
    .map(line => {
      if (line.startsWith("# "))  return `<h1 style="font-size:22px;font-weight:700;margin:20px 0 8px;">${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2 style="font-size:18px;font-weight:600;margin:16px 0 6px;">${line.slice(3)}</h2>`;
      if (line.trim() === "")     return `<div style="height:12px;"></div>`;
      return `<p style="margin:0 0 6px;line-height:1.6;">${line}</p>`;
    })
    .join("");

  const from = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f0f0f;padding:24px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#f97316;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-weight:700;font-size:14px;">CF</span>
                </td>
                <td style="padding-left:12px;color:#ffffff;font-weight:600;font-size:16px;">Content Flywheel</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;color:#1f2937;font-size:15px;">
            ${html}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #e5e7eb;background:#fafafa;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Content Flywheel · You're receiving this because you signed up for an account.<br>
              <a href="${from}/unsubscribe" style="color:#f97316;text-decoration:none;">Unsubscribe</a>
              &nbsp;·&nbsp;
              <a href="${from}/privacy" style="color:#9ca3af;text-decoration:none;">Privacy Policy</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// GET — preview recipient count
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const audience = searchParams.get("audience") ?? "all";

  const users = await db.select({ email: profilesTable.email }).from(profilesTable).where(getAudienceFilter(audience));
  const emails = users.map((u) => u.email).filter(Boolean);
  return NextResponse.json({ count: emails.length, audience });
}

// POST — send the blast
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    htmlBody?: string;
    audience?: string;
    targetEmail?: string;
  };
  const { subject, htmlBody, audience = "all", targetEmail } = body;

  if (!subject || !htmlBody) return NextResponse.json({ error: "subject and htmlBody are required" }, { status: 400 });

  let emails: string[] = [];
  if (audience === "specific") {
    if (!targetEmail) return NextResponse.json({ error: "targetEmail required for specific audience" }, { status: 400 });
    emails = [targetEmail];
  } else {
    const rows = await db.select({ email: profilesTable.email }).from(profilesTable).where(getAudienceFilter(audience));
    emails = rows.map((u) => u.email).filter(Boolean) as string[];
  }

  if (emails.length === 0) return NextResponse.json({ sent: 0 });

  const nameMap = await buildNameMap(emails);
  const from = process.env.RESEND_FROM_EMAIL ?? "Content Flywheel <hello@contentflywheel.co.uk>";

  let sent = 0;
  const errors: string[] = [];
  const BATCH = 50;

  for (let i = 0; i < emails.length; i += BATCH) {
    const chunk = emails.slice(i, i + BATCH);
    const messages = chunk.map(email => {
      const name = nameMap.get(email.toLowerCase()) ?? email.split("@")[0];
      return { from, to: email, subject, html: buildHtml(htmlBody, name) };
    });
    try {
      await resend.batch.send(messages);
      sent += chunk.length;
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return NextResponse.json({ sent, total: emails.length, ...(errors.length > 0 ? { errors } : {}) });
}
