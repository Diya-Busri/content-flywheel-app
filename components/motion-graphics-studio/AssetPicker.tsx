"use client";

/**
 * Small reusable control: pick an uploaded asset (by kind) from the Asset
 * Library, or paste a URL directly. Used throughout the Scene Editor for
 * backgrounds, element images/video, voiceover audio, music, and SFX.
 */

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssetKind, MotionGraphicsAsset } from "@/lib/motion-graphics/types";

export const AssetPicker: React.FC<{
  kind: AssetKind;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}> = ({ kind, value, onChange, placeholder }) => {
  const [assets, setAssets] = useState<MotionGraphicsAsset[]>([]);

  useEffect(() => {
    fetch(`/api/admin/motion-graphics/assets?kind=${kind}`)
      .then((r) => r.json())
      .then((d) => setAssets(d.assets || []))
      .catch(() => {});
  }, [kind]);

  return (
    <div className="flex gap-2">
      <Select value={assets.some((a) => a.url === value) ? value : undefined} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={`Choose from Asset Library…`} />
        </SelectTrigger>
        <SelectContent>
          {assets.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No {kind} assets uploaded yet</div>
          )}
          {assets.map((a) => (
            <SelectItem key={a.id} value={a.url}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "or paste a URL"}
        className="flex-1"
      />
    </div>
  );
};
