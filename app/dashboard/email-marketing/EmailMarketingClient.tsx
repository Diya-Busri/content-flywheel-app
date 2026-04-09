"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  Plus,
  Trash2,
  Send,
  Pencil,
  Mail,
  Users,
  Search,
  AlertTriangle,
  Upload,
  FlaskConical,
  Tag,
  X,
  Check,
  Copy,
  Link2,
  ExternalLink,
  Zap,
  Clock,
  CalendarClock,
  Bot,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Gift,
  Package,
  Megaphone,
} from "lucide-react";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Contact = {
  id: string;
  email: string;
  name: string | null;
  tags: string[];
  subscribedAt: string;
  unsubscribedAt: string | null;
};

type Campaign = {
  id: string;
  subject: string;
  previewText: string | null;
  bodyHtml: string;
  status: "draft" | "sent" | "scheduled";
  sentAt: string | null;
  scheduledFor: string | null;
  openCount: number;
  recipientCount: number;
  audienceTag: string | null;
  specificEmail: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  if (status === "sent") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        Sent
      </Badge>
    );
  }
  if (status === "scheduled") {
    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
        Scheduled
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
      Draft
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

const EMAIL_TEMPLATES = [
  {
    name: "Newsletter",
    subject: "Your [Month] Update",
    previewText: "Here's what's new this month",
    bodyHtml: `<h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 12px;">Hey [Name]! 👋</h2>
<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Here's a quick roundup of what's been happening this month — tips, updates, and things I've been working on.</p>

<h3 style="color:#f97316;font-size:16px;font-weight:700;margin:0 0 8px;">This month's highlight</h3>
<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">[Write your main update here]</p>

<h3 style="color:#f97316;font-size:16px;font-weight:700;margin:0 0 8px;">Quick tip</h3>
<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">[Share a valuable tip with your audience]</p>

<p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0;">That's it for this month. Hit reply and let me know what you think! 🙌</p>`,
  },
  {
    name: "Product Launch",
    subject: "🚀 [Product Name] is here!",
    previewText: "I've been building something for you",
    bodyHtml: `<h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 12px;">It's finally here! 🎉</h2>
<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">I've spent [time] building <strong>[Product Name]</strong> — and today it's officially live.</p>

<h3 style="color:#f97316;font-size:16px;font-weight:700;margin:0 0 8px;">What's inside?</h3>
<ul style="color:#374151;font-size:15px;line-height:1.8;margin:0 0 20px;padding-left:20px;">
  <li>[Feature / benefit 1]</li>
  <li>[Feature / benefit 2]</li>
  <li>[Feature / benefit 3]</li>
</ul>

<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">This is for you if [describe who it's for].</p>

<a href="[CHECKOUT_URL]" style="display:inline-block;padding:14px 28px;background:#f97316;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Get it now →</a>

<p style="color:#9ca3af;font-size:13px;line-height:1.7;margin:24px 0 0;">Early-bird pricing ends [date]. After that, price goes up.</p>`,
  },
  {
    name: "Announcement",
    subject: "Big news 📢",
    previewText: "Something exciting is happening",
    bodyHtml: `<h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 12px;">I have some exciting news 📢</h2>
<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">[Lead with your most exciting announcement — what's happening and why it matters to your readers]</p>

<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">[Add more context, background, or a story behind the announcement]</p>

<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;"><strong>Here's what this means for you:</strong> [Explain the benefit to your readers]</p>

<p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0;">Stay tuned — more details coming soon. As always, reply to this email if you have any questions.</p>`,
  },
  {
    name: "Value Email",
    subject: "How to [achieve outcome] in [timeframe]",
    previewText: "A quick tip you can use today",
    bodyHtml: `<h2 style="color:#111827;font-size:22px;font-weight:700;margin:0 0 12px;">Here's something that changed everything for me</h2>
<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">[Start with a hook — a story, a surprising stat, or a bold claim]</p>

<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;"><strong>Here's the thing most people get wrong about [topic]:</strong></p>
<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">[Explain the common mistake]</p>

<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;"><strong>What works instead:</strong></p>
<ol style="color:#374151;font-size:15px;line-height:1.8;margin:0 0 20px;padding-left:20px;">
  <li>[Step 1]</li>
  <li>[Step 2]</li>
  <li>[Step 3]</li>
</ol>

<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Try this today and let me know how it goes. Reply to this email — I read every response. 💬</p>`,
  },
];

// ---------------------------------------------------------------------------
// Campaign Composer Sheet
// ---------------------------------------------------------------------------

type CampaignFormState = {
  subject: string;
  previewText: string;
  bodyHtml: string;
  scheduledFor: string;
};

function CampaignSheet({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: Campaign | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<CampaignFormState>({
    subject: "",
    previewText: "",
    bodyHtml: "",
  });
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    if (open) {
      // Convert scheduledFor ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
      let scheduledFor = "";
      if (initial?.scheduledFor) {
        const d = new Date(initial.scheduledFor);
        scheduledFor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
      setForm({
        subject: initial?.subject ?? "",
        previewText: initial?.previewText ?? "",
        bodyHtml: initial?.bodyHtml ?? "",
        scheduledFor,
      });
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!form.subject.trim()) {
      toast({ title: "Subject is required", variant: "destructive" });
      return;
    }
    if (!form.bodyHtml.trim()) {
      toast({ title: "Email body is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let res: Response;
      const payload = {
        subject: form.subject,
        previewText: form.previewText,
        bodyHtml: form.bodyHtml,
        scheduledFor: form.scheduledFor || null,
      };
      if (initial) {
        res = await fetch(`/api/email/campaigns/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/email/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast({ title: initial ? "Campaign updated" : "Campaign created" });
      onSaved();
      onClose();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save campaign",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold text-gray-900 dark:text-white">
            {initial ? "Edit Campaign" : "New Campaign"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          {/* Template picker — only show for new campaigns */}
          {!initial && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Start from a template (optional)</p>
              <div className="flex flex-wrap gap-2">
                {EMAIL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      subject: f.subject || tpl.subject,
                      previewText: f.previewText || tpl.previewText,
                      bodyHtml: tpl.bodyHtml,
                    }))}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:border-orange-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="subject" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Subject <span className="text-orange-500">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="Your email subject line..."
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="previewText" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Preview Text{" "}
              <span className="text-gray-400 font-normal text-xs">(optional — shown in inbox preview)</span>
            </Label>
            <Input
              id="previewText"
              placeholder="A short preview that appears in the inbox..."
              value={form.previewText}
              onChange={(e) => setForm((f) => ({ ...f, previewText: e.target.value }))}
              className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bodyHtml" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Body <span className="text-orange-500">*</span>
            </Label>
            <Textarea
              id="bodyHtml"
              placeholder="Write your email content here... You can use HTML for formatting."
              value={form.bodyHtml}
              onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
              className="min-h-64 border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 font-mono text-sm resize-y"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              You can use HTML for formatting (e.g., &lt;b&gt;bold&lt;/b&gt;, &lt;a href=&quot;...&quot;&gt;links&lt;/a&gt;, &lt;br&gt; for line breaks).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheduledFor" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Schedule for later{" "}
              <span className="text-gray-400 font-normal text-xs">(optional — leave blank to save as draft)</span>
            </Label>
            <input
              id="scheduledFor"
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              className="flex h-9 w-full rounded-md border border-gray-200 dark:border-white/10 bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-2 flex-wrap">
            <Button
              onClick={handleSave}
              disabled={saving || testSending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.scheduledFor
                ? initial ? "Update Schedule" : "Schedule Campaign"
                : initial ? "Save Changes" : "Create Draft"}
            </Button>
            {initial && (
              <Button
                variant="outline"
                onClick={async () => {
                  setTestSending(true);
                  try {
                    // Save first so the test uses latest content
                    await handleSave();
                    const res = await fetch(`/api/email/campaigns/${initial.id}/test`, { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? "Failed");
                    toast({ title: "Test email sent!", description: `Check your inbox at ${data.sentTo}.` });
                  } catch (err) {
                    toast({ title: "Test failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
                  } finally {
                    setTestSending(false);
                  }
                }}
                disabled={saving || testSending}
              >
                {testSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                Send test to me
              </Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={saving || testSending}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Add Contact Dialog
// ---------------------------------------------------------------------------

function AddContactDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setTagsRaw("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!email.trim()) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }

    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await fetch("/api/email/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add contact");
      toast({ title: "Contact added" });
      onSaved();
      onClose();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add contact",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
            Add Contact
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email <span className="text-orange-500">*</span>
            </Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="subscriber@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Name <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </Label>
            <Input
              id="contactName"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contactTags" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tags <span className="text-gray-400 font-normal text-xs">(optional, comma-separated)</span>
            </Label>
            <Input
              id="contactTags"
              placeholder="vip, newsletter, product-launch"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Confirm Send Dialog
// ---------------------------------------------------------------------------

function ConfirmSendDialog({
  campaign,
  contacts,
  open,
  onClose,
  onConfirm,
  sending,
}: {
  campaign: Campaign | null;
  contacts: Contact[];
  open: boolean;
  onClose: () => void;
  onConfirm: (tagFilter: string) => void;
  sending: boolean;
}) {
  const [tagFilter, setTagFilter] = useState("");

  const activeContacts = contacts.filter((c) => !c.unsubscribedAt);
  const filteredCount = tagFilter.trim()
    ? activeContacts.filter((c) => c.tags.includes(tagFilter.trim())).length
    : activeContacts.length;

  // Collect all unique tags across active contacts
  const allTags = Array.from(new Set(activeContacts.flatMap((c) => c.tags))).sort();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setTagFilter(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Send Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4 text-sm text-gray-600 dark:text-gray-400">
          <p>
            Sending{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              &quot;{campaign?.subject}&quot;
            </span>{" "}
            to{" "}
            <span className="font-semibold text-orange-500">
              {filteredCount} subscriber{filteredCount !== 1 ? "s" : ""}
            </span>
            {tagFilter.trim() ? ` with tag "${tagFilter.trim()}"` : ""}.
          </p>
          {allTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Send to a specific tag (optional)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      tagFilter === tag
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:border-orange-300"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {tagFilter && (
                  <button
                    type="button"
                    onClick={() => setTagFilter("")}
                    className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3 inline" /> clear
                  </button>
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400">This action cannot be undone.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setTagFilter(""); }} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(tagFilter.trim())}
            disabled={sending || filteredCount === 0}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sending ? "Sending..." : `Send to ${filteredCount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EmailMarketingClient({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState<"subscribe" | "profile" | null>(null);

  const copyLink = (type: "subscribe" | "profile") => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = type === "subscribe" ? `${origin}/subscribe/${userId}` : `${origin}/c/${userId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(type);
      setTimeout(() => setCopiedLink(null), 2000);
    });
  };

  // --- Campaigns state ---
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [sendConfirmCampaign, setSendConfirmCampaign] = useState<Campaign | null>(null);
  const [sending, setSending] = useState(false);

  // --- Contacts state ---
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [editingTagsValue, setEditingTagsValue] = useState("");
  const [savingTagsId, setSavingTagsId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // --- Quick Blast state ---
  type AudienceType = "all" | "tag" | "specific" | "buyers";
  const [blastSubject, setBlastSubject] = useState("");
  const [blastBody, setBlastBody] = useState("");
  const [blastAudience, setBlastAudience] = useState<AudienceType>("all");
  const [blastTag, setBlastTag] = useState("");
  const [blastEmail, setBlastEmail] = useState("");
  const [blastBuyerProductId, setBlastBuyerProductId] = useState("all");
  const [blastTiming, setBlastTiming] = useState<"now" | "schedule">("now");
  const [blastScheduledFor, setBlastScheduledFor] = useState("");
  const [blastSending, setBlastSending] = useState(false);
  const [publishedProducts, setPublishedProducts] = useState<{ id: string; title: string }[]>([]);
  const [activeTab, setActiveTab] = useState("blast");

  // --- Automations state ---
  type Automation = { id: string; type: string; subject: string; bodyHtml: string; enabled: boolean };
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationsLoading, setAutomationsLoading] = useState(true);
  const [editingAutomation, setEditingAutomation] = useState<string | null>(null); // type string e.g. "welcome"
  const [automationDraft, setAutomationDraft] = useState<{ subject: string; bodyHtml: string }>({ subject: "", bodyHtml: "" });
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [togglingAutomation, setTogglingAutomation] = useState<string | null>(null);

  // Fetch published products for buyer audience picker
  useEffect(() => {
    fetch("/api/library?type=products")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPublishedProducts(data.filter((p: { isNativePublished?: boolean; title: string; id: string }) => p.isNativePublished).map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })));
        }
      })
      .catch(() => {});
  }, []);

  // Pre-fill Quick Blast from URL params (e.g. ?blast=buyers&product=xxx)
  const searchParams = useSearchParams();
  useEffect(() => {
    const blast = searchParams.get("blast");
    const product = searchParams.get("product");
    if (blast === "buyers") {
      setActiveTab("blast");
      setBlastAudience("buyers");
      if (product) setBlastBuyerProductId(product);
    }
  }, [searchParams]);

  // ---------------------------------------------------------------------------
  // Data fetchers
  // ---------------------------------------------------------------------------

  const fetchAutomations = useCallback(async () => {
    setAutomationsLoading(true);
    try {
      const res = await fetch("/api/email/automations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");
      setAutomations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setAutomationsLoading(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch("/api/email/campaigns");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load campaigns", variant: "destructive" });
    } finally {
      setCampaignsLoading(false);
    }
  }, [toast]);

  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const res = await fetch("/api/email/contacts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch");
      setContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load contacts", variant: "destructive" });
    } finally {
      setContactsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCampaigns();
    fetchContacts();
    fetchAutomations();
  }, [fetchCampaigns, fetchContacts, fetchAutomations]);

  // ---------------------------------------------------------------------------
  // Campaign actions
  // ---------------------------------------------------------------------------

  const handleOpenNew = () => {
    setEditingCampaign(null);
    setComposerOpen(true);
  };

  const handleEditCampaign = (c: Campaign) => {
    setEditingCampaign(c);
    setComposerOpen(true);
  };

  const handleDeleteCampaign = async (id: string) => {
    setDeletingCampaignId(id);
    try {
      const res = await fetch(`/api/email/campaigns/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      toast({ title: "Campaign deleted" });
      await fetchCampaigns();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const handleSendCampaign = async (tagFilter: string) => {
    if (!sendConfirmCampaign) return;
    setSending(true);
    try {
      const res = await fetch(`/api/email/campaigns/${sendConfirmCampaign.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagFilter: tagFilter || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? data.error ?? "Failed to send");
      toast({
        title: "Campaign sent!",
        description: `Successfully sent to ${data.sent} subscriber${data.sent !== 1 ? "s" : ""}.`,
      });
      setSendConfirmCampaign(null);
      await fetchCampaigns();
    } catch (err) {
      toast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Failed to send campaign",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleCsvImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) { toast({ title: "Empty file", variant: "destructive" }); return; }

      // Detect header row
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes("email") || firstLine.includes("name");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const contacts = dataLines.map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        // Try to detect which column is email
        const emailIdx = hasHeader
          ? firstLine.split(",").findIndex((h) => h.includes("email"))
          : 0;
        const nameIdx = hasHeader
          ? firstLine.split(",").findIndex((h) => h.includes("name"))
          : 1;
        return {
          email: cols[emailIdx >= 0 ? emailIdx : 0] ?? "",
          name: nameIdx >= 0 ? (cols[nameIdx] || undefined) : undefined,
        };
      }).filter((c) => c.email);

      const res = await fetch("/api/email/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      toast({ title: "Import complete", description: `${data.imported} added, ${data.skipped} skipped.` });
      await fetchContacts();
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const startEditTags = (contact: Contact) => {
    setEditingTagsId(contact.id);
    setEditingTagsValue(contact.tags.join(", "));
  };

  const saveEditTags = async (contactId: string) => {
    setSavingTagsId(contactId);
    try {
      const tags = editingTagsValue.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`/api/email/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setContacts((prev) => prev.map((c) => c.id === contactId ? { ...c, tags } : c));
      setEditingTagsId(null);
    } catch {
      toast({ title: "Could not save tags", variant: "destructive" });
    } finally {
      setSavingTagsId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Contact actions
  // ---------------------------------------------------------------------------

  const handleDeleteContact = async (id: string) => {
    setDeletingContactId(id);
    try {
      const res = await fetch(`/api/email/contacts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      toast({ title: "Contact removed" });
      await fetchContacts();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setDeletingContactId(null);
    }
  };

  const handleSendBlast = async () => {
    if (!blastSubject.trim()) { toast({ title: "Subject is required", variant: "destructive" }); return; }
    if (!blastBody.trim()) { toast({ title: "Message body is required", variant: "destructive" }); return; }
    if (blastAudience === "tag" && !blastTag.trim()) { toast({ title: "Please select a tag", variant: "destructive" }); return; }
    if (blastAudience === "specific" && !blastEmail.trim()) { toast({ title: "Please enter an email address", variant: "destructive" }); return; }
    if (blastTiming === "schedule" && !blastScheduledFor) { toast({ title: "Please pick a send time", variant: "destructive" }); return; }

    // Resolve the audienceTag to store on the campaign
    const resolvedAudienceTag =
      blastAudience === "tag" ? blastTag.trim() :
      blastAudience === "buyers" ? `buyers:${blastBuyerProductId}` :
      null;

    setBlastSending(true);
    try {
      // Create campaign
      const payload: Record<string, string | null> = {
        subject: blastSubject.trim(),
        bodyHtml: blastBody.trim(),
        scheduledFor: blastTiming === "schedule" ? blastScheduledFor : null,
        audienceTag: resolvedAudienceTag,
        specificEmail: blastAudience === "specific" ? blastEmail.trim() : null,
      };
      const createRes = await fetch("/api/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const campaign = await createRes.json();
      if (!createRes.ok) throw new Error(campaign.error ?? "Failed to create blast");

      if (blastTiming === "now") {
        // Send immediately (audienceTag already stored on campaign)
        const sendRes = await fetch(`/api/email/campaigns/${campaign.id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) throw new Error(sendData.detail ?? sendData.error ?? "Send failed");
        const recipientWord = blastAudience === "buyers" ? "customer" : "subscriber";
        toast({ title: "Blast sent! 🚀", description: `Delivered to ${sendData.sent} ${recipientWord}${sendData.sent !== 1 ? "s" : ""}.` });
      } else {
        toast({ title: "Blast scheduled! ⏰", description: `Will send on ${new Date(blastScheduledFor).toLocaleString()}.` });
      }

      // Reset form
      setBlastSubject(""); setBlastBody(""); setBlastAudience("all");
      setBlastTag(""); setBlastEmail(""); setBlastBuyerProductId("all");
      setBlastTiming("now"); setBlastScheduledFor("");
      await fetchCampaigns();
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setBlastSending(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    const q = contactSearch.toLowerCase();
    if (!q) return true;
    return (
      c.email.toLowerCase().includes(q) ||
      (c.name ?? "").toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const activeContactCount = contacts.filter((c) => !c.unsubscribedAt).length;

  // Build 30-day subscriber growth data
  const growthData = (() => {
    const days = 30;
    const now = new Date();
    const counts: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const count = contacts.filter((c) => {
        const subDate = new Date(c.subscribedAt);
        return subDate >= dayStart && subDate <= dayEnd;
      }).length;
      counts.push(count);
    }
    return counts;
  })();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="h-6 w-6 text-orange-500" />
            Email Marketing
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your subscriber list and send email campaigns
          </p>
        </div>
      </div>

      {/* Share Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { type: "subscribe" as const, label: "Subscribe page", desc: "Share with your audience to grow your list", path: `/subscribe/${userId}` },
          { type: "profile" as const, label: "Creator profile", desc: "Link-in-bio with all your products", path: `/c/${userId}` },
        ].map(({ type, label, desc, path }) => (
          <div key={type} className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <Link2 className="h-4 w-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
              <p className="text-xs text-gray-400 truncate">{desc}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a href={path} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-orange-500">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs border-gray-200 dark:border-white/10"
                onClick={() => copyLink(type)}
              >
                {copiedLink === type ? <Check className="h-3.5 w-3.5 mr-1 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copiedLink === type ? "Copied!" : "Copy link"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-100 dark:bg-white/5 rounded-xl p-1 mb-6">
          <TabsTrigger
            value="blast"
            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-orange-500 data-[state=active]:shadow-sm font-medium"
          >
            <Zap className="h-4 w-4 mr-1.5" />
            Quick Blast
          </TabsTrigger>
          <TabsTrigger
            value="automations"
            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-orange-500 data-[state=active]:shadow-sm font-medium"
          >
            <Bot className="h-4 w-4 mr-1.5" />
            Automations
          </TabsTrigger>
          <TabsTrigger
            value="campaigns"
            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-orange-500 data-[state=active]:shadow-sm font-medium"
          >
            <Mail className="h-4 w-4 mr-1.5" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-orange-500 data-[state=active]:shadow-sm font-medium"
          >
            <Users className="h-4 w-4 mr-1.5" />
            Contacts
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* Quick Blast Tab */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="blast" className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Compose panel */}
            <div className="lg:col-span-3 space-y-5">
              <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5 text-orange-500" />
                    Send a quick email
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Write, target, and send an email blast to your subscribers in seconds.
                  </p>
                </div>

                {/* Templates */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start from a template</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      {
                        icon: <Sparkles className="h-4 w-4 text-purple-500" />,
                        label: "Welcome",
                        subject: "Welcome — so glad you're here! 👋",
                        body: "Hey!\n\nJust wanted to personally say welcome and thank you for subscribing.\n\nI share [what you share — tips, products, updates] and I'm really glad to have you here.\n\nIf you ever have questions or just want to say hi, just reply to this email — I read every one.\n\nTalk soon,\n[Your name]",
                      },
                      {
                        icon: <Package className="h-4 w-4 text-blue-500" />,
                        label: "New Product",
                        subject: "Something new just dropped 🎉",
                        body: "Hey!\n\nExciting news — I just launched [product name]!\n\n[One or two sentences about what it is and who it's for.]\n\nHere's what you get:\n→ [Benefit 1]\n→ [Benefit 2]\n→ [Benefit 3]\n\nGrab it here: [link]\n\nAs always, reply if you have any questions.\n\n[Your name]",
                      },
                      {
                        icon: <Gift className="h-4 w-4 text-red-500" />,
                        label: "Discount",
                        subject: "Here's a little treat for you 🎁",
                        body: "Hey!\n\nI'm running a limited offer — [X]% off [product/everything in my store] for the next [timeframe].\n\nUse code: [CODE] at checkout.\n\nLink: [your store link]\n\nThis deal expires [date], so don't sleep on it!\n\n[Your name]",
                      },
                      {
                        icon: <Megaphone className="h-4 w-4 text-orange-500" />,
                        label: "Announcement",
                        subject: "Quick update from me 📣",
                        body: "Hey!\n\nI wanted to drop a quick note to let you know about [announcement].\n\n[2-3 sentences with the key details.]\n\n[Call to action — link, reply, etc.]\n\nThanks for being here.\n[Your name]",
                      },
                    ].map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => { setBlastSubject(tpl.subject); setBlastBody(tpl.body); }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-orange-50 dark:hover:bg-orange-500/5 transition-colors text-center"
                      >
                        {tpl.icon}
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{tpl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Subject <span className="text-orange-500">*</span>
                  </Label>
                  <Input
                    placeholder="What's this email about?"
                    value={blastSubject}
                    onChange={(e) => setBlastSubject(e.target.value)}
                    className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500"
                  />
                </div>

                {/* Body */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Message <span className="text-orange-500">*</span>
                  </Label>
                  <Textarea
                    placeholder="Write your message here... Plain text or HTML both work."
                    value={blastBody}
                    onChange={(e) => setBlastBody(e.target.value)}
                    className="min-h-48 border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 resize-y text-sm"
                  />
                  <p className="text-xs text-gray-400">
                    HTML supported — e.g. <code className="bg-gray-100 dark:bg-white/10 px-1 rounded">&lt;b&gt;bold&lt;/b&gt;</code>, <code className="bg-gray-100 dark:bg-white/10 px-1 rounded">&lt;a href=&quot;...&quot;&gt;&lt;/a&gt;</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Settings panel */}
            <div className="lg:col-span-2 space-y-4">
              {/* Audience */}
              <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-orange-500" />
                  Audience
                </h3>

                <div className="space-y-2">
                  {(["all", "tag", "buyers", "specific"] as const).map((opt) => {
                    const labels = { all: "All Subscribers", tag: "By Tag", buyers: "Product Buyers", specific: "Specific Email" };
                    const descs: Record<string, string> = {
                      all: `${contacts.filter((c) => !c.unsubscribedAt).length} subscriber${contacts.filter((c) => !c.unsubscribedAt).length !== 1 ? "s" : ""}`,
                      tag: "Send to a tagged segment",
                      buyers: "Email people who bought your products",
                      specific: "Send to one address",
                    };
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setBlastAudience(opt)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                          blastAudience === opt
                            ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10"
                            : "border-gray-200 dark:border-white/10 hover:border-orange-200 dark:hover:border-orange-500/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${blastAudience === opt ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"}`}>
                            {labels[opt]}
                          </span>
                          {blastAudience === opt && <Check className="h-4 w-4 text-orange-500" />}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{descs[opt]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tag picker */}
                {blastAudience === "tag" && (() => {
                  const allTags = Array.from(new Set(contacts.flatMap((c) => c.tags))).sort();
                  return (
                    <div className="space-y-2">
                      {allTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {allTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setBlastTag(blastTag === tag ? "" : tag)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                blastTag === tag
                                  ? "bg-orange-500 text-white border-orange-500"
                                  : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-orange-300"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No tags yet — add tags to contacts first.</p>
                      )}
                      {blastTag && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                          Sending to {contacts.filter((c) => !c.unsubscribedAt && c.tags.includes(blastTag)).length} subscriber{contacts.filter((c) => !c.unsubscribedAt && c.tags.includes(blastTag)).length !== 1 ? "s" : ""} with tag &quot;{blastTag}&quot;
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Product buyers picker */}
                {blastAudience === "buyers" && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Choose which product&apos;s customers to email:</p>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setBlastBuyerProductId("all")}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors text-sm ${
                          blastBuyerProductId === "all"
                            ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium"
                            : "border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-orange-200 dark:hover:border-orange-500/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>All Products</span>
                          {blastBuyerProductId === "all" && <Check className="h-4 w-4 text-orange-500" />}
                        </div>
                        <span className="text-xs text-gray-400">Everyone who has bought from you</span>
                      </button>
                      {publishedProducts.length > 0 ? publishedProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setBlastBuyerProductId(p.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors text-sm ${
                            blastBuyerProductId === p.id
                              ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium"
                              : "border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-orange-200 dark:hover:border-orange-500/30"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate pr-2">{p.title}</span>
                            {blastBuyerProductId === p.id && <Check className="h-4 w-4 text-orange-500 shrink-0" />}
                          </div>
                        </button>
                      )) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 px-1">No published products yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Specific email input */}
                {blastAudience === "specific" && (
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={blastEmail}
                    onChange={(e) => setBlastEmail(e.target.value)}
                    className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 text-sm"
                  />
                )}
              </div>

              {/* Timing */}
              <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-orange-500" />
                  When to send
                </h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setBlastTiming("now")}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      blastTiming === "now"
                        ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10"
                        : "border-gray-200 dark:border-white/10 hover:border-orange-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${blastTiming === "now" ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"}`}>
                        Send now
                      </span>
                      {blastTiming === "now" && <Check className="h-4 w-4 text-orange-500" />}
                    </div>
                    <span className="text-xs text-gray-400">Goes out immediately</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlastTiming("schedule")}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      blastTiming === "schedule"
                        ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10"
                        : "border-gray-200 dark:border-white/10 hover:border-orange-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${blastTiming === "schedule" ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"}`}>
                        Schedule for later
                      </span>
                      {blastTiming === "schedule" && <Check className="h-4 w-4 text-orange-500" />}
                    </div>
                    <span className="text-xs text-gray-400">Pick a date &amp; time</span>
                  </button>
                </div>

                {blastTiming === "schedule" && (
                  <input
                    type="datetime-local"
                    value={blastScheduledFor}
                    onChange={(e) => setBlastScheduledFor(e.target.value)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    className="flex h-9 w-full rounded-md border border-gray-200 dark:border-white/10 bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 dark:text-white"
                  />
                )}
              </div>

              {/* Send button */}
              <Button
                onClick={handleSendBlast}
                disabled={blastSending}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-11 text-sm font-semibold"
              >
                {blastSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : blastTiming === "schedule" ? (
                  <CalendarClock className="mr-2 h-4 w-4" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {blastSending ? "Sending..." : blastTiming === "schedule" ? "Schedule blast" : "Send blast now"}
              </Button>
            </div>
          </div>

          {/* Blast history */}
          {campaigns.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-orange-400" />
                Recent blasts &amp; campaigns
              </h3>
              <div className="space-y-2">
                {campaigns.slice(0, 5).map((c) => (
                  <div key={c.id} className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.subject}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                        <StatusBadge status={c.status} />
                        {c.status === "sent" && <span>{c.recipientCount} sent · {formatDate(c.sentAt)}</span>}
                        {c.status === "scheduled" && <span><CalendarClock className="h-3 w-3 inline mr-0.5" />{formatDate(c.scheduledFor)}</span>}
                        {c.audienceTag && <span className="text-orange-500">tag: {c.audienceTag}</span>}
                        {c.specificEmail && <span className="text-orange-500">{c.specificEmail}</span>}
                      </div>
                    </div>
                    {c.status === "sent" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs border-gray-200 dark:border-white/10 hover:border-orange-300 hover:text-orange-600 flex-shrink-0"
                        onClick={() => setViewingCampaign(c)}
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    )}
                    {c.status === "scheduled" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                        onClick={() => handleDeleteCampaign(c.id)}
                        disabled={deletingCampaignId === c.id}
                      >
                        {deletingCampaignId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Automations Tab */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="automations" className="space-y-6">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-orange-500" />
              Email Automations
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Set up emails that send automatically — no manual work needed.
            </p>
          </div>

          {automationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Welcome Email card */}
              {(() => {
                const welcomeAuto = automations.find((a) => a.type === "welcome");
                const isEditing = editingAutomation === "welcome";
                return (
                  <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                          <Sparkles className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">Welcome Email</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Automatically sent to new subscribers when they sign up to your list.
                          </p>
                          {welcomeAuto && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Subject: <span className="text-gray-600 dark:text-gray-300 italic">{welcomeAuto.subject}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {welcomeAuto && (
                          <button
                            type="button"
                            disabled={togglingAutomation === "welcome"}
                            onClick={async () => {
                              setTogglingAutomation("welcome");
                              try {
                                const res = await fetch("/api/email/automations", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ type: "welcome", enabled: !welcomeAuto.enabled }),
                                });
                                if (!res.ok) throw new Error("Failed");
                                await fetchAutomations();
                                toast({ title: welcomeAuto.enabled ? "Welcome email paused" : "Welcome email activated! 🎉" });
                              } catch {
                                toast({ title: "Failed to update", variant: "destructive" });
                              } finally {
                                setTogglingAutomation(null);
                              }
                            }}
                            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                          >
                            {togglingAutomation === "welcome" ? (
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            ) : welcomeAuto.enabled ? (
                              <ToggleRight className="h-7 w-7 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-7 w-7 text-gray-400" />
                            )}
                            <span className={welcomeAuto.enabled ? "text-green-500" : "text-gray-400"}>
                              {welcomeAuto.enabled ? "On" : "Off"}
                            </span>
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-gray-200 dark:border-white/10"
                          onClick={() => {
                            setEditingAutomation(isEditing ? null : "welcome");
                            setAutomationDraft({
                              subject: welcomeAuto?.subject ?? "Welcome — so glad you're here! 👋",
                              bodyHtml: welcomeAuto?.bodyHtml ?? "Hey!\n\nThank you so much for subscribing. I'm really glad to have you here.\n\nI'll be sharing [what you share], and I can't wait to get started.\n\nIf you ever have questions, just hit reply — I read every email.\n\nTalk soon,\n[Your name]",
                            });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          {welcomeAuto ? "Edit" : "Set up"}
                        </Button>
                      </div>
                    </div>

                    {/* Edit form */}
                    {isEditing && (
                      <div className="border-t border-gray-100 dark:border-white/5 pt-4 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subject line</Label>
                          <Input
                            value={automationDraft.subject}
                            onChange={(e) => setAutomationDraft((d) => ({ ...d, subject: e.target.value }))}
                            placeholder="Welcome — so glad you're here! 👋"
                            className="border-gray-200 dark:border-white/10 focus-visible:ring-orange-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email body</Label>
                          <p className="text-xs text-gray-400">Write naturally — line breaks become paragraphs. HTML supported.</p>
                          <Textarea
                            value={automationDraft.bodyHtml}
                            onChange={(e) => setAutomationDraft((d) => ({ ...d, bodyHtml: e.target.value }))}
                            className="min-h-48 border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 resize-y text-sm"
                            placeholder="Hey!\n\nThank you for subscribing..."
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                            disabled={savingAutomation}
                            onClick={async () => {
                              if (!automationDraft.subject.trim() || !automationDraft.bodyHtml.trim()) {
                                toast({ title: "Subject and body are required", variant: "destructive" });
                                return;
                              }
                              setSavingAutomation(true);
                              try {
                                const res = await fetch("/api/email/automations", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ type: "welcome", subject: automationDraft.subject, bodyHtml: automationDraft.bodyHtml, enabled: welcomeAuto?.enabled ?? true }),
                                });
                                if (!res.ok) throw new Error("Failed");
                                await fetchAutomations();
                                setEditingAutomation(null);
                                toast({ title: "Welcome email saved! 🎉", description: "New subscribers will receive this email automatically." });
                              } catch {
                                toast({ title: "Failed to save", variant: "destructive" });
                              } finally {
                                setSavingAutomation(false);
                              }
                            }}
                          >
                            {savingAutomation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Save & Activate
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs text-gray-400" onClick={() => setEditingAutomation(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {!welcomeAuto && !isEditing && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">No custom welcome email set. A default email is sent. Click <strong>Set up</strong> to personalise it.</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Coming soon cards */}
              {[
                { icon: <Package className="h-5 w-5 text-blue-400" />, bg: "bg-blue-500/10 border-blue-500/20", title: "New Product Announcement", desc: "Auto-email your list when you publish a new product to your store." },
                { icon: <Gift className="h-5 w-5 text-red-400" />, bg: "bg-red-500/10 border-red-500/20", title: "Re-engagement Campaign", desc: "Automatically reach out to subscribers who haven't opened an email in 30 days." },
              ].map((card) => (
                <div key={card.title} className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-6 opacity-60">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${card.bg}`}>
                      {card.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">{card.title}</p>
                        <Badge className="text-[10px] bg-gray-100 dark:bg-white/5 text-gray-500 border border-gray-200 dark:border-white/10 hover:bg-gray-100">Coming soon</Badge>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{card.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Campaigns Tab */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
            </p>
            <Button
              onClick={handleOpenNew}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Campaign
            </Button>
          </div>

          {campaignsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-card p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mx-auto">
                <Mail className="h-6 w-6 text-orange-500" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">No campaigns yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create your first email campaign to reach your subscribers.
              </p>
              <Button
                onClick={handleOpenNew}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl mt-2"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4 hover:border-orange-200 dark:hover:border-orange-500/30 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {campaign.subject}
                      </h3>
                      <StatusBadge status={campaign.status} />
                    </div>
                    {campaign.previewText && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {campaign.previewText}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                      {campaign.status === "sent" ? (
                        <>
                          <span>Sent {formatDate(campaign.sentAt)}</span>
                          <span>·</span>
                          <span>{campaign.recipientCount} recipient{campaign.recipientCount !== 1 ? "s" : ""}</span>
                          {campaign.recipientCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-orange-500 font-medium">
                                {Math.round((campaign.openCount / campaign.recipientCount) * 100)}% opened
                              </span>
                            </>
                          )}
                        </>
                      ) : campaign.status === "scheduled" && campaign.scheduledFor ? (
                        <span>Scheduled for {formatDate(campaign.scheduledFor)}</span>
                      ) : (
                        <span>Created {formatDate(campaign.createdAt)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {campaign.status === "sent" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs border-gray-200 dark:border-white/10 hover:border-orange-300 hover:text-orange-600"
                        onClick={() => setViewingCampaign(campaign)}
                      >
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    )}
                    {(campaign.status === "draft" || campaign.status === "scheduled") && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs border-gray-200 dark:border-white/10 hover:border-orange-300 hover:text-orange-600"
                          onClick={() => handleEditCampaign(campaign)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => setSendConfirmCampaign(campaign)}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Send now
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      disabled={deletingCampaignId === campaign.id}
                    >
                      {deletingCampaignId === campaign.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Contacts Tab */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-orange-500">{activeContactCount}</span>{" "}
              subscriber{activeContactCount !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-9 h-9 w-52 border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 rounded-xl text-sm"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => csvInputRef.current?.click()}
                disabled={importing}
                className="h-9 rounded-xl border-gray-200 dark:border-white/10 text-sm"
              >
                {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                Import CSV
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvImport(file);
                }}
              />
              <Button
                onClick={() => setAddContactOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-9"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Contact
              </Button>
            </div>
          </div>

          {/* Growth sparkline */}
          {!contactsLoading && contacts.length > 0 && growthData.some((v) => v > 0) && (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">New subscribers — last 30 days</p>
              <div className="flex items-end gap-0.5 h-12">
                {growthData.map((val, i) => {
                  const max = Math.max(...growthData, 1);
                  const height = Math.max((val / max) * 100, val > 0 ? 8 : 2);
                  return (
                    <div
                      key={i}
                      title={`${val} subscriber${val !== 1 ? "s" : ""}`}
                      style={{ height: `${height}%` }}
                      className={`flex-1 rounded-sm transition-all ${
                        val > 0
                          ? "bg-orange-400 dark:bg-orange-500"
                          : "bg-gray-100 dark:bg-white/5"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {contactsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-card p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mx-auto">
                <Users className="h-6 w-6 text-orange-500" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white">No contacts yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add your first subscriber to start building your list.
              </p>
              <Button
                onClick={() => setAddContactOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl mt-2"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Contact
              </Button>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-card p-10 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No contacts match &quot;{contactSearch}&quot;
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {/* Avatar placeholder */}
                    <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                        {(contact.name ?? contact.email)[0].toUpperCase()}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {contact.name && (
                          <span className="font-medium text-sm text-gray-900 dark:text-white">
                            {contact.name}
                          </span>
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {contact.email}
                        </span>
                        {contact.unsubscribedAt && (
                          <Badge variant="outline" className="text-xs text-gray-400 border-gray-200">
                            Unsubscribed
                          </Badge>
                        )}
                      </div>
                      {editingTagsId === contact.id ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Input
                            value={editingTagsValue}
                            onChange={(e) => setEditingTagsValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditTags(contact.id);
                              if (e.key === "Escape") setEditingTagsId(null);
                            }}
                            placeholder="tag1, tag2"
                            className="h-6 text-xs px-2 py-0 border-gray-200 dark:border-white/10 focus-visible:ring-orange-500 w-40"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                            onClick={() => saveEditTags(contact.id)}
                            disabled={savingTagsId === contact.id}
                          >
                            {savingTagsId === contact.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                            onClick={() => setEditingTagsId(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {contact.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs px-1.5 py-0 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-500/20"
                            >
                              {tag}
                            </Badge>
                          ))}
                          <button
                            type="button"
                            onClick={() => startEditTags(contact)}
                            className="text-gray-300 dark:text-gray-600 hover:text-orange-400 dark:hover:text-orange-400 transition-colors"
                            title="Edit tags"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                            Added {formatDate(contact.subscribedAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex-shrink-0"
                      onClick={() => handleDeleteContact(contact.id)}
                      disabled={deletingContactId === contact.id}
                    >
                      {deletingContactId === contact.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------ */}
      {/* Modals / Sheets */}
      {/* ------------------------------------------------------------------ */}
      <CampaignSheet
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        initial={editingCampaign}
        onSaved={fetchCampaigns}
      />

      <AddContactDialog
        open={addContactOpen}
        onClose={() => setAddContactOpen(false)}
        onSaved={fetchContacts}
      />

      <ConfirmSendDialog
        campaign={sendConfirmCampaign}
        contacts={contacts}
        open={!!sendConfirmCampaign}
        onClose={() => setSendConfirmCampaign(null)}
        onConfirm={handleSendCampaign}
        sending={sending}
      />

      {/* View Campaign Dialog */}
      <Dialog open={!!viewingCampaign} onOpenChange={() => setViewingCampaign(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{viewingCampaign?.subject}</DialogTitle>
            {viewingCampaign?.previewText && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{viewingCampaign.previewText}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-400 pt-1">
              <span>Sent {formatDate(viewingCampaign?.sentAt)}</span>
              <span>·</span>
              <span>{viewingCampaign?.recipientCount ?? 0} recipient{(viewingCampaign?.recipientCount ?? 0) !== 1 ? "s" : ""}</span>
              {(viewingCampaign?.recipientCount ?? 0) > 0 && (
                <>
                  <span>·</span>
                  <span className="text-orange-500 font-medium">
                    {Math.round(((viewingCampaign?.openCount ?? 0) / (viewingCampaign?.recipientCount ?? 1)) * 100)}% opened
                  </span>
                </>
              )}
            </div>
          </DialogHeader>
          <div className="border-t border-gray-100 dark:border-white/10 pt-4 mt-2">
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: viewingCampaign?.bodyHtml ?? "" }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
