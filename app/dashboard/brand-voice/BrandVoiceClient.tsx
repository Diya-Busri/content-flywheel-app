"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

type BrandVoiceData = {
  brandName?: string;
  tone?: string;
  targetAudience?: string;
  writingStyle?: string;
  examplePhrases?: string;
};

export default function BrandVoiceClient() {
  const [data, setData] = useState<BrandVoiceData>({
    brandName: "",
    tone: "",
    targetAudience: "",
    writingStyle: "",
    examplePhrases: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brand-voice");
        if (res.status === 404) {
          if (!cancelled) setData((prev) => prev);
          return;
        }
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        if (!cancelled) {
          setData({
            brandName: json.brandName ?? "",
            tone: json.tone ?? "",
            targetAudience: json.targetAudience ?? "",
            writingStyle: json.writingStyle ?? "",
            examplePhrases: json.examplePhrases ?? "",
          });
        }
      } catch (e) {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Could not load brand voice settings",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/brand-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: data.brandName || null,
          tone: data.tone || null,
          targetAudience: data.targetAudience || null,
          writingStyle: data.writingStyle || null,
          examplePhrases: data.examplePhrases || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save");
      }
      toast({
        title: "Saved",
        description: "Brand voice settings have been updated.",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Your brand voice</CardTitle>
          <CardDescription>
            Fill in what best describes your brand. AI will use this when generating titles, descriptions, and scripts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand name</Label>
            <Input
              id="brandName"
              placeholder="e.g. Acme Co"
              value={data.brandName}
              onChange={(e) =>
                setData((prev) => ({ ...prev, brandName: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Input
              id="tone"
              placeholder="e.g. Friendly, professional, witty"
              value={data.tone}
              onChange={(e) =>
                setData((prev) => ({ ...prev, tone: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target audience</Label>
            <Input
              id="targetAudience"
              placeholder="e.g. Small business owners, 25–45"
              value={data.targetAudience}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  targetAudience: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="writingStyle">Writing style</Label>
            <Input
              id="writingStyle"
              placeholder="e.g. Short sentences, action-oriented, no jargon"
              value={data.writingStyle}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  writingStyle: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="examplePhrases">Example phrases</Label>
            <Textarea
              id="examplePhrases"
              placeholder="One phrase per line or comma-separated. e.g. Let's go! / Keep it simple / You've got this"
              value={data.examplePhrases}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  examplePhrases: e.target.value,
                }))
              }
              rows={4}
              className="resize-none"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
