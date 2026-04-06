import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { emailContactsTable } from "@/db/schema/email-marketing-schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/email/unsubscribe?id={contactId}
 * One-click unsubscribe — no auth required.
 */
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get("id");
  if (!contactId) {
    return NextResponse.redirect(new URL("/unsubscribed?error=missing", req.url));
  }

  try {
    const [contact] = await db
      .select({ id: emailContactsTable.id, unsubscribedAt: emailContactsTable.unsubscribedAt })
      .from(emailContactsTable)
      .where(eq(emailContactsTable.id, contactId))
      .limit(1);

    if (!contact) {
      return NextResponse.redirect(new URL("/unsubscribed?error=notfound", req.url));
    }

    if (!contact.unsubscribedAt) {
      await db
        .update(emailContactsTable)
        .set({ unsubscribedAt: new Date() })
        .where(eq(emailContactsTable.id, contactId));
    }

    return NextResponse.redirect(new URL("/unsubscribed", req.url));
  } catch (e) {
    console.error("[unsubscribe] error:", e);
    return NextResponse.redirect(new URL("/unsubscribed?error=server", req.url));
  }
}
