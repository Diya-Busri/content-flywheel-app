"use client";

import { useState, useEffect, useCallback } from "react";
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
  recipientCount: number;
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
// Campaign Composer Sheet
// ---------------------------------------------------------------------------

type CampaignFormState = {
  subject: string;
  previewText: string;
  bodyHtml: string;
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

  useEffect(() => {
    if (open) {
      setForm({
        subject: initial?.subject ?? "",
        previewText: initial?.previewText ?? "",
        bodyHtml: initial?.bodyHtml ?? "",
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
      if (initial) {
        res = await fetch(`/api/email/campaigns/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch("/api/email/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
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
              You can use HTML for formatting (e.g., &lt;b&gt;bold&lt;/b&gt;, &lt;a href="..."&gt;links&lt;/a&gt;, &lt;br&gt; for line breaks).
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initial ? "Save Changes" : "Create Campaign"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
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
  contactCount,
  open,
  onClose,
  onConfirm,
  sending,
}: {
  campaign: Campaign | null;
  contactCount: number;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Send Campaign
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            You are about to send{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              &quot;{campaign?.subject}&quot;
            </span>{" "}
            to{" "}
            <span className="font-semibold text-orange-500">
              {contactCount} subscriber{contactCount !== 1 ? "s" : ""}
            </span>
            .
          </p>
          <p>This action cannot be undone.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={sending}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {sending ? "Sending..." : "Send Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EmailMarketingClient() {
  const { toast } = useToast();

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

  // ---------------------------------------------------------------------------
  // Data fetchers
  // ---------------------------------------------------------------------------

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
  }, [fetchCampaigns, fetchContacts]);

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

  const handleSendCampaign = async () => {
    if (!sendConfirmCampaign) return;
    setSending(true);
    try {
      const res = await fetch(`/api/email/campaigns/${sendConfirmCampaign.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
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

      {/* Tabs */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="bg-gray-100 dark:bg-white/5 rounded-xl p-1 mb-6">
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
                          <span>
                            {campaign.recipientCount} recipient{campaign.recipientCount !== 1 ? "s" : ""}
                          </span>
                        </>
                      ) : (
                        <span>Created {formatDate(campaign.createdAt)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {campaign.status === "draft" && (
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
                          Send
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
                onClick={() => setAddContactOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-9"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Contact
              </Button>
            </div>
          </div>

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
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                          Added {formatDate(contact.subscribedAt)}
                        </span>
                      </div>
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
        contactCount={activeContactCount}
        open={!!sendConfirmCampaign}
        onClose={() => setSendConfirmCampaign(null)}
        onConfirm={handleSendCampaign}
        sending={sending}
      />
    </div>
  );
}
