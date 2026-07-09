"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type CreatableSelectFieldProps = {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: readonly Option[];
  /** Merged into the list (e.g. values from AI) so the Select can show a value not in `options`. */
  extraOptions?: readonly Option[];
  storageKey: string;
  addPlaceholder: string;
};

function uniqueOptions(options: Option[]): Option[] {
  const seen = new Set<string>();
  const out: Option[] = [];
  for (const option of options) {
    const normalized = option.value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(option);
  }
  return out;
}

export function CreatableSelectField({
  label,
  value,
  onValueChange,
  options,
  extraOptions = [],
  storageKey,
  addPlaceholder,
}: CreatableSelectFieldProps) {
  const [customOptions, setCustomOptions] = useState<Option[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const restored = parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => ({ value: item, label: item }));
      setCustomOptions(uniqueOptions(restored));
    } catch {
      // ignore malformed local storage
    }
  }, [storageKey]);

  const allOptions = useMemo(() => {
    const base = uniqueOptions([...options, ...extraOptions, ...customOptions]);
    const v = value.trim();
    if (v && !base.some((opt) => opt.value === v)) {
      return [...base, { value: v, label: v }];
    }
    return base;
  }, [options, extraOptions, customOptions, value]);

  const saveCustomOptions = (nextCustom: Option[]) => {
    setCustomOptions(nextCustom);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(nextCustom.map((opt) => opt.value))
      );
    } catch {
      // ignore storage errors
    }
  };

  const addOption = () => {
    const next = draft.trim();
    if (!next) return;
    const exists = allOptions.some(
      (opt) => opt.value.trim().toLowerCase() === next.toLowerCase()
    );
    if (exists) {
      onValueChange(allOptions.find((opt) => opt.value.trim().toLowerCase() === next.toLowerCase())?.value ?? next);
      setDraft("");
      return;
    }
    const nextCustom = uniqueOptions([...customOptions, { value: next, label: next }]);
    saveCustomOptions(nextCustom);
    onValueChange(next);
    setDraft("");
  };

  const current = value.trim();
  const placeholderLabel =
    allOptions.length === 0
      ? "No saved topics yet — type below and Save"
      : "Choose a saved topic or add one below";

  return (
    <div className="space-y-2">
      <Label htmlFor={`creatable-select-${storageKey.replace(/[^a-z0-9]/gi, "-")}`}>{label}</Label>
      <select
        id={`creatable-select-${storageKey.replace(/[^a-z0-9]/gi, "-")}`}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
          "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        value={current}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="">{placeholderLabel}</option>
        {allOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={addPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addOption}>
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Add your own option and it will be saved for future sessions.
      </p>
    </div>
  );
}
