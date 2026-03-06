"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export type SaveAsTemplateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  formatType: string;
  defaultTitle?: string;
  onSuccess?: () => void;
};

export function SaveAsTemplateModal({
  open,
  onOpenChange,
  content,
  formatType,
  defaultTitle = "",
  onSuccess,
}: SaveAsTemplateModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setTags("");
    }
  }, [open, defaultTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      toast({ title: "Enter a title", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/saved-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          content,
          formatType,
          tags: tags.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not save template",
          description: data.error ?? "Something went wrong",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Template saved" });
      setTitle("");
      setTags("");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Give this template a name and optional tags so you can find it later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-title">Title</Label>
              <Input
                id="template-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. YouTube description template"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-tags">Tags (optional)</Label>
              <Input
                id="template-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. youtube, tutorial, cta"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save template"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
