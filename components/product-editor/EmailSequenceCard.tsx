"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, RefreshCw, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Email = {
  subject: string;
  preview: string;
  body: string;
};

const EMAIL_LABELS = ["Day 0 — Welcome", "Day 2 — Value", "Day 4 — Pitch"];
const EMAIL_COLORS = [
  "border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20",
  "border-violet-200 bg-violet-50/60 dark:border-violet-900/40 dark:bg-violet-950/20",
  "border-orange-200 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/20",
];

function EmailCard({ email, index, productId }: { email: Email; index: number; productId: string }) {
  const [open, setOpen] = useState(index === 0);
  const { toast } = useToast();

  const copyAll = () => {
    const full = `Subject: ${email.subject}\nPreview: ${email.preview}\n\n${email.body}`;
    navigator.clipboard.writeText(full).then(() => toast({ title: "Email copied!" }));
  };

  return (
    <div className={`rounded-lg border ${EMAIL_COLORS[index % EMAIL_COLORS.length]}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
              {EMAIL_LABELS[index] ?? `Email ${index + 1}`}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{email.subject}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{email.preview}</p>
        </div>
        <div className="flex items-center gap-1 ml-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/50"
            onClick={(e) => { e.stopPropagation(); copyAll(); }}
          >
            <Copy className="w-3 h-3" />
          </Button>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-current/10">
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed pt-3">
            {email.body}
          </p>
        </div>
      )}
    </div>
  );
}

export function EmailSequenceCard({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/email-sequence`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to generate email sequence");
      setEmails((data.emails as Email[]) ?? []);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    const full = emails
      .map((e, i) => `=== ${EMAIL_LABELS[i] ?? `Email ${i + 1}`} ===\nSubject: ${e.subject}\nPreview: ${e.preview}\n\n${e.body}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(full).then(() => toast({ title: "All 3 emails copied!" }));
  };

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-orange-500" />
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Email Launch Sequence</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {emails.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={copyAll}>
                <Copy className="w-3 h-3" /> Copy All
              </Button>
            )}
            <Button
              size="sm"
              variant={emails.length > 0 ? "ghost" : "outline"}
              className="h-7 gap-1.5 text-xs border-gray-200"
              onClick={generate}
              disabled={loading}
              type="button"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : emails.length > 0 ? <RefreshCw className="w-3 h-3" /> : null}
              {loading ? "Generating…" : emails.length > 0 ? "Regenerate" : "Generate Sequence"}
            </Button>
          </div>
        </div>
        {!loading && emails.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            3-email sequence: welcome → value → pitch. Ready to paste into Mailchimp, ConvertKit, or Beehiiv.
          </p>
        )}
      </CardHeader>

      {emails.length > 0 && (
        <CardContent className="px-4 pb-4 space-y-2">
          {emails.map((email, i) => (
            <EmailCard key={i} email={email} index={i} productId={productId} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
