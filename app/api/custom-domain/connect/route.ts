export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, and, ne } from "drizzle-orm";

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID; // optional — only needed for teams

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

    // Verify custom domain is unlocked for this user
    const [settings] = await db
      .select({ customDomainActive: storeSettingsTable.customDomainActive })
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.userId, userId))
      .limit(1);

    if (!settings?.customDomainActive) {
      return NextResponse.json({ error: "Custom domain not unlocked" }, { status: 403 });
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
