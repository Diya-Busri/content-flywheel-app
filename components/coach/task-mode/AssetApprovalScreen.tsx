"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { TaskRunDTO } from "@/hooks/useTaskRun";
import type { ContentAssetType, ProposedAsset } from "@/db/schema/jarvis-schema";
import { ASSET_TYPE_META, assetLabel } from "./asset-meta";
import { CampaignSummary } from "./CampaignSummary";

function AssetPreview({ asset }: { asset: ProposedAsset }) {
  if (asset.type === "video_script") {
    return (
      <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
        <p><span className="font-medium text-gray-800 dark:text-gray-200">Hook:</span> {asset.hook}</p>
        <p className="line-clamp-3 whitespace-pre-wrap">{asset.script}</p>
        <p><span className="font-medium text-gray-800 dark:text-gray-200">CTA:</span> {asset.cta}</p>
      </div>
    );
  }
  if (asset.type === "carousel") {
    return (
      <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
        <ol className="list-decimal space-y-0.5 pl-4">
          {asset.slides.slice(0, 4).map((s, i) => <li key={i}>{s}</li>)}
          {asset.slides.length > 4 && <li className="text-gray-400">+{asset.slides.length - 4} more slides</li>}
        </ol>
        {asset.hashtags.length > 0 && (
          <p className="text-xs text-gray-400">{asset.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
      <p className="font-medium text-gray-800 dark:text-gray-200">{asset.subject}</p>
      <p className="line-clamp-2">{asset.previewText}</p>
    </div>
  );
}

function AssetEditor({
  asset,
  onSave,
  onCancel,
  saving,
}: {
  asset: ProposedAsset;
  onSave: (patch: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<ProposedAsset>(asset);

  if (draft.type === "video_script") {
    return (
      <div className="space-y-2">
        <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
        <Input value={draft.hook} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} placeholder="Hook" />
        <Textarea value={draft.script} onChange={(e) => setDraft({ ...draft, script: e.target.value })} placeholder="Script" rows={5} />
        <Input value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} placeholder="CTA" />
        <EditorActions
          saving={saving}
          onCancel={onCancel}
          onSave={() => onSave({ title: draft.title, hook: draft.hook, script: draft.script, cta: draft.cta })}
        />
      </div>
    );
  }
  if (draft.type === "carousel") {
    return (
      <div className="space-y-2">
        <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
        <Textarea
          value={draft.slides.join("\n")}
          onChange={(e) => setDraft({ ...draft, slides: e.target.value.split("\n").filter((s) => s.trim().length > 0) })}
          placeholder="One slide per line"
          rows={6}
        />
        <Textarea value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} placeholder="Caption" rows={2} />
        <Input
          value={draft.hashtags.join(" ")}
          onChange={(e) => setDraft({ ...draft, hashtags: e.target.value.split(/\s+/).map((h) => h.replace(/^#/, "")).filter(Boolean) })}
          placeholder="Hashtags (space separated)"
        />
        <EditorActions
          saving={saving}
          onCancel={onCancel}
          onSave={() => onSave({ title: draft.title, slides: draft.slides, caption: draft.caption, hashtags: draft.hashtags })}
        />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Subject" />
      <Input value={draft.previewText} onChange={(e) => setDraft({ ...draft, previewText: e.target.value })} placeholder="Preview text" />
      <Textarea value={draft.bodyHtml} onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })} placeholder="Body (HTML)" rows={6} />
      <EditorActions
        saving={saving}
        onCancel={onCancel}
        onSave={() => onSave({ subject: draft.subject, previewText: draft.previewText, bodyHtml: draft.bodyHtml })}
      />
    </div>
  );
}

function EditorActions({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button type="button" size="sm" onClick={onSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Save changes
      </Button>
    </div>
  );
}

const TYPE_ORDER: ContentAssetType[] = ["video_script", "carousel", "email"];

/**
 * Approval gate 2: every generated asset shown for review before anything
 * is saved. Deselected assets are never sent to the approve endpoint (and
 * are marked "rejected" server-side, not silently dropped). Edits persist
 * immediately via PATCH so a refresh never loses them and approval always
 * saves the latest edited content.
 *
 * Assets are grouped by channel (video / carousel / email) under one
 * campaign summary, rather than shown as one flat grid of unrelated cards —
 * the point is to review a single campaign, not a pile of separate files.
 */
export function AssetApprovalScreen({
  run,
  onApprove,
  onEditAsset,
  pending,
}: {
  run: TaskRunDTO;
  onApprove: (approvedAssetIds: string[]) => void;
  onEditAsset: (assetId: string, patch: Record<string, unknown>) => Promise<string | null>;
  pending: boolean;
}) {
  const assets = run.assets;
  const [selected, setSelected] = useState<Set<string>>(() => new Set(assets.map((a) => a.id)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const selectedCount = useMemo(() => assets.filter((a) => selected.has(a.id)).length, [assets, selected]);

  const groups = useMemo(() => {
    return TYPE_ORDER.map((type) => ({ type, items: assets.filter((a) => a.type === type) })).filter(
      (g) => g.items.length > 0,
    );
  }, [assets]);

  const totalCounts = useMemo(() => {
    const counts: Partial<Record<ContentAssetType, number>> = {};
    for (const a of assets) counts[a.type] = (counts[a.type] ?? 0) + 1;
    return counts;
  }, [assets]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSaveEdit(assetId: string, patch: Record<string, unknown>) {
    setSavingEdit(true);
    setEditError(null);
    const err = await onEditAsset(assetId, patch);
    setSavingEdit(false);
    if (err) setEditError(err);
    else setEditingId(null);
  }

  return (
    <div className="space-y-4">
      <CampaignSummary
        eyebrow="Ready for review"
        headline="Your campaign is ready to review"
        subtext="Nothing is saved to your library until you approve it below. Edit anything that doesn't sound right first."
        counts={totalCounts}
      />

      {editError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {editError}
        </div>
      )}

      {groups.map((group) => {
        const meta = ASSET_TYPE_META[group.type];
        const GroupIcon = meta.icon;
        return (
          <div key={group.type} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <GroupIcon className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {assetLabel(group.type, group.items.length)}
              </h3>
              <Badge variant="outline" className="text-[10px] py-0">{group.items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.items.map((asset) => {
                const isEditing = editingId === asset.id;
                return (
                  <div
                    key={asset.id}
                    className={`rounded-lg border bg-white p-4 transition-opacity dark:bg-[#141414] ${
                      selected.has(asset.id)
                        ? "border-gray-200 dark:border-gray-800"
                        : "border-gray-100 opacity-60 dark:border-gray-800/60"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Checkbox
                          checked={selected.has(asset.id)}
                          onCheckedChange={() => toggle(asset.id)}
                          disabled={pending}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {asset.edited && <Badge variant="outline" className="text-[10px] py-0 border-blue-200 text-blue-600 dark:border-blue-900 dark:text-blue-400">Edited</Badge>}
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {asset.type === "email" ? asset.subject : asset.title}
                          </p>
                        </div>
                      </div>
                      {!isEditing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 shrink-0"
                          onClick={() => setEditingId(asset.id)}
                          disabled={pending}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <AssetEditor
                        asset={asset}
                        saving={savingEdit}
                        onCancel={() => setEditingId(null)}
                        onSave={(patch) => void handleSaveEdit(asset.id, patch)}
                      />
                    ) : (
                      <AssetPreview asset={asset} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex flex-col-reverse items-stretch gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {selectedCount} of {assets.length} selected — unselected assets will not be saved.
        </p>
        <Button
          onClick={() => onApprove(Array.from(selected))}
          disabled={pending || selectedCount === 0}
          size="lg"
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {pending ? "Saving campaign…" : `Approve & save campaign · ${selectedCount}`}
        </Button>
      </div>
    </div>
  );
}
