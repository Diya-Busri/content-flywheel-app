"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FolderOpen, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export type UGCCampaign = {
  id: string;
  userId: string;
  projectType: string;
  campaignName: string;
  createdAt: string;
};

type CampaignSelectorProps = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function CampaignSelector({ selectedId, onSelect }: CampaignSelectorProps) {
  const [campaigns, setCampaigns] = useState<UGCCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<"affiliate" | "brand">("affiliate");
  const [createLoading, setCreateLoading] = useState(false);
  const { toast } = useToast();

  const fetchCampaigns = () => {
    setLoading(true);
    fetch("/api/ugc-lab/campaigns")
      .then((r) => r.json())
      .then((d) => (d.campaigns ? setCampaigns(d.campaigns) : setCampaigns([])))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/ugc-lab/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignName: name, projectType: createType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      setCreateName("");
      setCreateOpen(false);
      fetchCampaigns();
      onSelect(data.campaign?.id ?? null);
      toast({ title: "Campaign created" });
    } catch (err) {
      toast({
        title: "Create failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Campaign
        </CardTitle>
        <CardDescription className="text-xs">
          Optional. Multi-product campaigns enable comparison angles.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className="flex gap-2">
          <select
            value={selectedId ?? ""}
            onChange={(e) => onSelect(e.target.value || null)}
            className="flex-1 h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
            disabled={loading}
          >
            <option value="">No campaign (single product)</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.campaignName} ({c.projectType})
              </option>
            ))}
          </select>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" className="flex-shrink-0 h-10 w-10">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create campaign</DialogTitle>
                <DialogDescription>
                  Create a multi-product campaign for comparison or stacked UGC.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Name</label>
                  <Input
                    placeholder="e.g. Skincare Summer Launch"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Type</label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value as "affiliate" | "brand")}
                    className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm"
                  >
                    <option value="affiliate">Affiliate</option>
                    <option value="brand">Brand</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createLoading}>
                  {createLoading ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
