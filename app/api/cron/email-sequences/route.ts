import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { emailSequenceEnrollmentsTable } from "@/db/schema/email-sequence-enrollments-schema";
import { emailSequenceStepsTable } from "@/db/schema/email-sequences-schema";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { lte, eq, and } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/email-sequences
 * Invoked by a Vercel/external cron on a schedule (e.g. every hour).
 * Sends pending drip emails and advances enrollment state.
 * Protected by a shared CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Fetch all pending enrollments due to send
  const due = await db
    .select()
    .from(emailSequenceEnrollmentsTable)
    .where(
      and(
        eq(emailSequenceEnrollmentsTable.completed, false),
        lte(emailSequenceEnrollmentsTable.nextSendAt, now)
      )
    )
    .limit(100);

  if (due.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const enrollment of due) {
    try {
      // Fetch the current step to send
      const [step] = await db
        .select()
        .from(emailSequenceStepsTable)
        .where(
          and(
            eq(emailSequenceStepsTable.sequenceId, enrollment.sequenceId),
            eq(emailSequenceStepsTable.stepNumber, enrollment.nextStepNumber)
          )
        )
        .limit(1);

      if (!step) {
        // Step missing — mark enrollment complete
        await db
          .update(emailSequenceEnrollmentsTable)
          .set({ completed: true })
          .where(eq(emailSequenceEnrollmentsTable.id, enrollment.id));
        continue;
      }

      // Fetch creator brand name for from field
      let fromName = "Content Flywheel";
      let productTitle = "your product";
      try {
        const [bv] = await db
          .select({ brandName: brandVoiceTable.brandName })
          .from(brandVoiceTable)
          .where(eq(brandVoiceTable.userId, enrollment.creatorUserId))
          .limit(1);
        if (bv?.brandName?.trim()) fromName = bv.brandName.trim();

        const [prod] = await db
          .select({ title: productsTable.title })
          .from(productsTable)
          .where(eq(productsTable.id, enrollment.productId))
          .limit(1);
        if (prod?.title) productTitle = prod.title;
      } catch {
        // ignore — use defaults
      }

      // Build HTML from body text
      const bodyHtml = step.body.includes("<")
        ? step.body
        : step.body
            .split(/\n\n+/)
            .map((p) => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
            .join("");

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";
      const productUrl = `${appUrl}/product/${enrollment.productId}`;
      const htmlBody = bodyHtml.replace(/\[PRODUCT_LINK\]/g, productUrl);

      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#0B0B0F;padding:16px 32px;text-align:center;">
          <img src="${appUrl}/logo.png" alt="${fromName}" width="130" style="display:inline-block;height:auto;"/>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#1a1a1a;font-size:16px;line-height:1.7;">${htmlBody}</td></tr>
        <tr><td style="background:#F5C97A;padding:20px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#0B0B0F;">From ${fromName} · <a href="${productUrl}" style="color:#0B0B0F;">${productTitle}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

      await resend.emails.send({
        from: `${fromName} <hello@contentflywheel.co.uk>`,
        to: enrollment.buyerEmail,
        subject: step.subject,
        html,
      });

      sent++;

      // Find next step
      const allSteps = await db
        .select({ stepNumber: emailSequenceStepsTable.stepNumber, delayDays: emailSequenceStepsTable.delayDays })
        .from(emailSequenceStepsTable)
        .where(eq(emailSequenceStepsTable.sequenceId, enrollment.sequenceId))
        .orderBy(emailSequenceStepsTable.stepNumber);

      const currentIndex = allSteps.findIndex((s) => s.stepNumber === enrollment.nextStepNumber);
      const nextStep = allSteps[currentIndex + 1];

      if (nextStep) {
        const nextSendAt = new Date(enrollment.enrolledAt.getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000);
        await db
          .update(emailSequenceEnrollmentsTable)
          .set({ nextStepNumber: nextStep.stepNumber, nextSendAt })
          .where(eq(emailSequenceEnrollmentsTable.id, enrollment.id));
      } else {
        await db
          .update(emailSequenceEnrollmentsTable)
          .set({ completed: true })
          .where(eq(emailSequenceEnrollmentsTable.id, enrollment.id));
      }
    } catch (err) {
      console.error("[cron/email-sequences] Error for enrollment", enrollment.id, err);
      failed++;
    }
  }

  console.log(`[cron/email-sequences] sent=${sent} failed=${failed} total=${due.length}`);
  return NextResponse.json({ sent, failed, total: due.length });
}
