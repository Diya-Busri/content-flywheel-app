/**
 * Single source of truth for the digital-product refund / cancellation policy
 * and the pre-payment consent checkbox.
 *
 * IMPORTANT: Never edit REFUND_POLICY_TEXT or CONSENT_CHECKBOX_TEXT in place
 * once they've been shown to a live buyer. If the wording needs to change,
 * bump CURRENT_POLICY_VERSION and add a new entry to POLICY_VERSIONS below,
 * keeping the old entry intact. Orders store the exact version + text that
 * applied at the moment of purchase, so historical consent records must
 * never be rewritten by a later copy change.
 */

export const CURRENT_POLICY_VERSION = "2026-07-v1";

/** Refund / cancellation policy shown on product pages, checkout, FAQ, and emails. */
export const REFUND_POLICY_TEXT =
  "Due to the instant-access nature of digital products, refunds are not offered for change of mind once the product has been accessed or downloaded. If the product is faulty, inaccessible, or materially different from its description, please contact us so the issue can be resolved in accordance with your statutory rights.";

/** Required, unticked-by-default checkbox shown before payment on every checkout flow. */
export const CONSENT_CHECKBOX_TEXT =
  "I consent to receiving immediate access to this digital product and understand that once access or downloading begins, I lose my right to cancel, except where the product is faulty, inaccessible, or not as described.";

/**
 * Historical map of policy versions -> exact text shown at that version.
 * Look up by consentPolicyVersion when displaying what a specific past order
 * actually agreed to (e.g. in admin/support tooling). Add new versions here;
 * never mutate an existing one.
 */
export const POLICY_VERSIONS: Record<string, { refundPolicyText: string; consentCheckboxText: string }> = {
  [CURRENT_POLICY_VERSION]: {
    refundPolicyText: REFUND_POLICY_TEXT,
    consentCheckboxText: CONSENT_CHECKBOX_TEXT,
  },
};

export function resolvePolicyText(version: string | null | undefined): { refundPolicyText: string; consentCheckboxText: string } {
  if (version && POLICY_VERSIONS[version]) return POLICY_VERSIONS[version];
  // Fall back to current policy if the version is missing/unrecognized (e.g. legacy orders).
  return POLICY_VERSIONS[CURRENT_POLICY_VERSION];
}
