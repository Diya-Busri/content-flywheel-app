"use client";

import { Label } from "@/components/ui/label";

export type AvatarItem = {
  id: string;
  name: string;
  gender?: string;
  previewImageUrl?: string;
  previewVideoUrl?: string;
  premium?: boolean;
};

type AvatarSelectionGridProps = {
  avatars: AvatarItem[];
  selectedAvatarId: string | null;
  onSelect: (avatarId: string) => void;
  isLoading?: boolean;
  label?: string;
};

export function AvatarSelectionGrid({
  avatars,
  selectedAvatarId,
  onSelect,
  isLoading = false,
  label = "Avatar",
}: AvatarSelectionGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 h-[120px] place-items-center">
          <div className="col-span-full text-sm text-slate-500">Loading avatars...</div>
        </div>
      </div>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-sm text-slate-500">No avatars available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-[220px] overflow-y-auto pr-1">
        {avatars.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className={`relative rounded-lg border-2 overflow-hidden transition-all shrink-0 aspect-square ${
              selectedAvatarId === a.id
                ? "border-orange-500 ring-2 ring-orange-200 dark:ring-orange-800"
                : "border-slate-200 dark:border-slate-700 hover:border-orange-300"
            }`}
            title={a.name}
          >
            {a.previewImageUrl ? (
              <img
                src={a.previewImageUrl}
                alt={a.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500 truncate px-1 text-center">
                {a.name}
              </div>
            )}
            {a.premium && (
              <span className="absolute top-0.5 right-0.5 bg-amber-500 text-white text-[10px] px-1 rounded">
                Pro
              </span>
            )}
          </button>
        ))}
      </div>
      {selectedAvatarId && (
        <p className="text-xs text-slate-500">
          Selected: {avatars.find((a) => a.id === selectedAvatarId)?.name ?? "—"}
        </p>
      )}
    </div>
  );
}
