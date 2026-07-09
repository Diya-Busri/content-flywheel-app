"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function BundleBuyButton({ bundleId }: { bundleId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bundles/${bundleId}/buy`, { method: "POST" });
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
      <Button
        size="lg"
        onClick={handleBuy}
        disabled={loading}
        className="w-full max-w-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base gap-2"
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
    </div>
  );
}
