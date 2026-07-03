export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, and, ne } from "drizzle-orm";
import { Resend } from "resend";

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID; // optional — only needed for teams
const resend = new Resend(process.env.RESEND_API_KEY);

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * POST /api/custom-domain/connect
 * Body: { domain: "mybrand.com" }
 *
 * 1. Validates the domain
 * 2. Checks uniqueness against DB
 * 3. Registers domain with Vercel project via API
 * 4. Saves to store_settings
 * 5. Returns DNS instructions
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch user once — need email for both admin check and setup email
    const clerkUser = await currentUser();
    const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";

    // Verify custom domain is unlocked for this user (admin always gets access)
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
    const isAdmin = adminEmail ? userEmail.trim().toLowerCase() === adminEmail : false;

    if (!isAdmin) {
      const [settings] = await db
        .select({ customDomainActive: storeSettingsTable.customDomainActive })
        .from(storeSettingsTable)
        .where(eq(storeSettingsTable.userId, userId))
        .limit(1);

      if (!settings?.customDomainActive) {
        return NextResponse.json({ error: "Custom domain not unlocked" }, { status: 403 });
      }
    }

    const body = await req.json() as { domain?: string };
    const domain = body.domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

    // Validate format
    if (!DOMAIN_REGEX.test(domain)) {
      return NextResponse.json({ error: "Invalid domain format. Example: mybrand.com" }, { status: 400 });
    }

    // Block platform subdomains — those use the free subdomain flow instead
    if (domain.endsWith(".contentflywheel.co.uk")) {
      return NextResponse.json({ error: "Use the subdomain field for contentflywheel.co.uk addresses." }, { status: 400 });
    }

    // Check uniqueness — no two stores can share a domain
    const [existing] = await db
      .select({ userId: storeSettingsTable.userId })
      .from(storeSettingsTable)
      .where(
        and(
          eq(storeSettingsTable.customDomain, domain),
          ne(storeSettingsTable.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "This domain is already connected to another store." },
        { status: 409 }
      );
    }

    // Register domain with Vercel so it routes to this project
    if (VERCEL_API_TOKEN && VERCEL_PROJECT_ID) {
      const url = new URL(`https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains`);
      if (VERCEL_TEAM_ID) url.searchParams.set("teamId", VERCEL_TEAM_ID);

      const vercelRes = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VERCEL_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: domain }),
      });

      if (!vercelRes.ok) {
        const err = await vercelRes.json() as { error?: { code?: string; message?: string } };
        const code = err?.error?.code ?? "";
        // Already registered to this project = fine; already taken by another Vercel project = conflict
        if (code === "domain_already_in_use" || code === "domain_already_exists") {
          // continue — domain is already registered, just save to DB
        } else if (code === "forbidden") {
          return NextResponse.json(
            { error: "Domain belongs to another Vercel account. The owner must remove it first." },
            { status: 409 }
          );
        } else {
          console.error("[custom-domain/connect] Vercel error:", err);
          return NextResponse.json(
            { error: "Could not register domain with hosting provider. Please try again." },
            { status: 502 }
          );
        }
      }
    } else {
      console.warn("[custom-domain/connect] VERCEL_API_TOKEN or VERCEL_PROJECT_ID not set — skipping Vercel registration");
    }

    // Persist to DB
    await db
      .insert(storeSettingsTable)
      .values({ userId, customDomain: domain, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: storeSettingsTable.userId,
        set: { customDomain: domain, updatedAt: new Date() },
      });

    // Send setup instructions email — fire and forget, don't block the response
    if (userEmail && process.env.RESEND_API_KEY) {
      resend.emails.send({
        from: "hello@contentflywheel.co.uk",
        to: userEmail,
        subject: `Connect ${domain} to your store — 3 quick steps`,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px; }
  .card { background: #fff; border-radius: 12px; max-width: 520px; margin: 0 auto; padding: 36px 32px; border: 1px solid #e5e7eb; }
  h1 { font-size: 20px; color: #111; margin: 0 0 6px; }
  .sub { font-size: 14px; color: #6b7280; margin: 0 0 28px; }
  .record { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .record-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .record-cell { flex: 1; min-width: 100px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 4px; }
  .value { font-family: monospace; font-size: 14px; font-weight: 700; color: #111; }
  .step { display: flex; gap: 14px; margin-bottom: 18px; }
  .num { width: 24px; height: 24px; border-radius: 50%; background: #16a34a; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .step-text { font-size: 14px; color: #374151; line-height: 1.5; }
  .btn { display: inline-block; margin-top: 24px; background: #16a34a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; }
  .footer { font-size: 12px; color: #9ca3af; margin-top: 28px; }
  code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; font-family: monospace; }
</style></head>
<body>
<div class="card">
  <h1>Almost there! 🎉</h1>
  <p class="sub">You've connected <strong>${domain}</strong> to your Content Flywheel store. One last step — add this DNS record at your domain registrar so traffic gets routed to your store.</p>

  <p style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">Your DNS record:</p>
  <div class="record">
    <div class="record-row">
      <div class="record-cell"><div class="label">Type</div><div class="value">CNAME</div></div>
      <div class="record-cell"><div class="label">Name / Host</div><div class="value">@</div></div>
      <div class="record-cell"><div class="label">Value / Points to</div><div class="value">cname.vercel-dns.com</div></div>
    </div>
  </div>

  <p style="font-size:14px;font-weight:600;color:#374151;margin:24px 0 16px;">If you bought your domain on Namecheap:</p>

  <div class="step">
    <div class="num">1</div>
    <div class="step-text">Go to <a href="https://ap.www.namecheap.com/domains/list/" style="color:#16a34a;font-weight:600;">Namecheap → Domain List</a> and click <strong>Manage</strong> next to <strong>${domain}</strong>.</div>
  </div>
  <div class="step">
    <div class="num">2</div>
    <div class="step-text">Click the <strong>Advanced DNS</strong> tab. Under "Host Records" click <strong>Add New Record</strong>.</div>
  </div>
  <div class="step">
    <div class="num">3</div>
    <div class="step-text">Set Type to <code>CNAME Record</code>, Host to <code>@</code>, Value to <code>cname.vercel-dns.com</code>. Hit the green tick to save.</div>
  </div>

  <p style="font-size:13px;color:#6b7280;margin-top:8px;">Used GoDaddy, 123-Reg, or another registrar? The steps are the same — just look for <strong>DNS Management</strong> in your domain settings.</p>

  <a href="https://ap.www.namecheap.com/domains/list/" class="btn">Open Namecheap →</a>

  <p class="footer">DNS changes can take up to 24 hours to propagate. Your store goes live automatically once they do — you don't need to do anything else.<br/><br/>Any trouble? Reply to this email and we'll help you sort it.</p>
</div>
</body></html>`,
      }).catch((e) => console.error("[custom-domain/connect] email error:", e));
    }

    return NextResponse.json({
      domain,
      dns: {
        type: "CNAME",
        name: "@",
        value: "cname.vercel-dns.com",
      },
    });
  } catch (err) {
    console.error("[custom-domain/connect]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/custom-domain/connect
 * Removes the custom domain from the store (reverts to subdomain / /c/userId).
 */
export async function DELETE(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db
      .update(storeSettingsTable)
      .set({ customDomain: null, updatedAt: new Date() })
      .where(eq(storeSettingsTable.userId, userId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custom-domain/connect DELETE]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
