"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { REFUND_POLICY_TEXT, CONSENT_CHECKBOX_TEXT } from "@/lib/refund-policy";

export function BundleBuyButton({ bundleId }: { bundleId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Required pre-payment consent checkbox — must never default to checked.
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const handleBuy = async () => {
    if (!consentChecked) {
      setConsentError(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bundles/${bundleId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div>
      <label
        className="flex items-start gap-2.5 mb-3 p-3 rounded-lg border cursor-pointer text-left"
        style={{ background: consentError ? "#fef2f2" : "#f9fafb", borderColor: consentError ? "#fca5a5" : "#e5e7eb" }}
      >
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => { setConsentChecked(e.target.checked); if (e.target.checked) setConsentError(false); }}
          required
          className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0"
        />
        <span className="text-xs leading-relaxed text-gray-600">{CONSENT_CHECKBOX_TEXT}</span>
      </label>
      {consentError && (
        <p className="text-red-600 text-xs font-semibold mb-2">Please check the box above to continue.</p>
      )}

      <Button
        size="lg"
        onClick={handleBuy}
        disabled={loading || !consentChecked}
        className="w-full max-w-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          "Buy Bundle Now"
        )}
      </Button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

      <p className="text-[11px] leading-relaxed text-gray-500 mt-3 max-w-xs">{REFUND_POLICY_TEXT}</p>
    </div>
  );
}
