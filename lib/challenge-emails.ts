/**
 * Email templates for the 100 Product Challenge submission system.
 * Wording follows the challenge's core rule: this is not a competition —
 * every eligible submission is queued for production, never "selected" or
 * "shortlisted". Keep that language intact if you edit these.
 */

const WRAP_OPEN = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827;">`;
const WRAP_CLOSE = `</div>`;
const BUTTON = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#f97316;color:#fff;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;text-decoration:none;margin:8px 0 24px;">${label}</a>`;
const FOOTER = `
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;"/>
  <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
    Follow Content Flywheel so you don't miss upcoming challenge episodes.
  </p>`;

export function buildChallengeConfirmationEmail(params: {
  firstName: string;
  productName: string;
  reference: string;
  featureType: "public" | "anonymous";
}): { subject: string; html: string } {
  const { firstName, productName, reference, featureType } = params;

  const featureNote =
    featureType === "public"
      ? `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
          You do not need to create a Content Flywheel Store yet. Once your submission passes the eligibility review,
          you will receive another email asking you to create a listing for the product you submitted and reply with
          the Content Flywheel Store link.
        </p>`
      : `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
          You will not be required to create a Content Flywheel account or store. Your identifying details will be
          removed or blurred before the case study is published.
        </p>`;

  const html = `${WRAP_OPEN}
    <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#111827;">Your 100 Product Challenge submission has been received</h1>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Thank you for submitting <strong>${productName}</strong> to the Content Flywheel 100 Product Challenge.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Your submission has been received and will now go through a basic eligibility review.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Every eligible submission will be added to the challenge production queue. Publishing may take time depending
      on the number of products currently waiting, and products may not be published in submission order.
    </p>
    ${featureNote}
    <p style="color:#6b7280;font-size:13px;margin:0 0 4px;">Your submission reference</p>
    <p style="color:#111827;font-size:18px;font-weight:700;font-family:monospace;margin:0 0 16px;">${reference}</p>
    ${FOOTER}
  ${WRAP_CLOSE}`;

  return { subject: "Your 100 Product Challenge submission has been received", html };
}

export function buildChallengePublicEligibleEmail(params: {
  firstName: string;
  productName: string;
  reference: string;
  storeUrl: string;
}): { subject: string; html: string } {
  const { firstName, productName, reference, storeUrl } = params;

  const html = `${WRAP_OPEN}
    <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#111827;">Your product has joined the 100 Product Challenge queue — ${reference}</h1>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Your submission for <strong>${productName}</strong> has passed the eligibility review and has now been added to
      the Content Flywheel 100 Product Challenge production queue.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Because you chose a public feature, viewers will need somewhere to discover your product.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Please create a listing for the exact product you submitted inside your Content Flywheel Store, then reply
      directly to this email with the product page link.
    </p>
    ${BUTTON(storeUrl, "Create or access your Content Flywheel Store")}
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      You only need to add the product being featured. You do not need to add your entire product collection.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Once we receive and verify your Content Flywheel Store link, your submission will be marked as ready for
      production.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Publishing times will depend on the current queue, and publication order may change based on the content
      schedule.
    </p>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 4px;">Submission reference</p>
    <p style="color:#111827;font-size:18px;font-weight:700;font-family:monospace;margin:0 0 16px;">${reference}</p>
    ${FOOTER}
  ${WRAP_CLOSE}`;

  return { subject: `Your product has joined the 100 Product Challenge queue — ${reference}`, html };
}

export function buildChallengeAnonymousEligibleEmail(params: {
  firstName: string;
  productName: string;
  reference: string;
}): { subject: string; html: string } {
  const { firstName, productName, reference } = params;

  const html = `${WRAP_OPEN}
    <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#111827;">Your anonymous product has joined the challenge queue — ${reference}</h1>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Your anonymous submission for <strong>${productName}</strong> has passed the eligibility review and has now
      been added to the Content Flywheel 100 Product Challenge production queue.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      You do not need to create a Content Flywheel account or store.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Your product will be used as an anonymous marketing case study. Identifying names, links, logos, usernames and
      other revealing details will be removed or blurred before publication.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      The case study may still discuss the general product type, audience, problem, marketing challenges, strategy,
      improvements and lessons learned.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Please reply to this email if there are any additional details, images, words or sections that must not appear
      publicly.
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Publishing times will depend on the current queue.
    </p>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 4px;">Submission reference</p>
    <p style="color:#111827;font-size:18px;font-weight:700;font-family:monospace;margin:0 0 16px;">${reference}</p>
    ${FOOTER}
  ${WRAP_CLOSE}`;

  return { subject: `Your anonymous product has joined the challenge queue — ${reference}`, html };
}

export function buildChallengeMoreInfoRequiredEmail(params: {
  firstName: string;
  productName: string;
  reference: string;
  message: string;
}): { subject: string; html: string } {
  const { firstName, productName, reference, message } = params;

  const html = `${WRAP_OPEN}
    <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#111827;">A quick question about your 100 Product Challenge submission — ${reference}</h1>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Thanks for submitting <strong>${productName}</strong> to the Content Flywheel 100 Product Challenge. Before it
      can move through the eligibility review, I need a bit more information:
    </p>
    <p style="color:#111827;font-size:15px;line-height:1.7;margin:0 0 16px;background:#f9fafb;border-radius:8px;padding:16px;white-space:pre-wrap;">${message}</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Just reply directly to this email with the details above and your submission will continue through the
      eligibility review. Every eligible submission is still added to the production queue — this is only to confirm
      a detail before that review can be completed.
    </p>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 4px;">Submission reference</p>
    <p style="color:#111827;font-size:18px;font-weight:700;font-family:monospace;margin:0 0 16px;">${reference}</p>
    ${FOOTER}
  ${WRAP_CLOSE}`;

  return { subject: `A quick question about your 100 Product Challenge submission — ${reference}`, html };
}

export function buildChallengeIneligibleEmail(params: {
  firstName: string;
  productName: string;
  reference: string;
  reason: string;
}): { subject: string; html: string } {
  const { firstName, productName, reference, reason } = params;

  const html = `${WRAP_OPEN}
    <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#111827;">Your 100 Product Challenge submission — ${reference}</h1>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${firstName},</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      Thanks for submitting <strong>${productName}</strong> to the Content Flywheel 100 Product Challenge. After
      review, this submission did not pass the eligibility check, so it hasn't been added to the production queue.
    </p>
    <p style="color:#111827;font-size:15px;line-height:1.7;margin:0 0 16px;background:#f9fafb;border-radius:8px;padding:16px;">${reason}</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">
      A submission is only ever marked ineligible if it's incomplete, unsafe, unlawful, fraudulent, inappropriate, or
      outside the challenge scope, or submitted by someone who doesn't own or have permission to use the product. If
      you believe this doesn't apply here, reply to this email and I'll take another look.
    </p>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 4px;">Submission reference</p>
    <p style="color:#111827;font-size:18px;font-weight:700;font-family:monospace;margin:0 0 16px;">${reference}</p>
    ${FOOTER}
  ${WRAP_CLOSE}`;

  return { subject: `Your 100 Product Challenge submission — ${reference}`, html };
}
