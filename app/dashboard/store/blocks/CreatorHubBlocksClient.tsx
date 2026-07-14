"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  GripVertical, ChevronDown, ChevronUp, Trash2, Plus, Star, ShoppingBag,
  Share2, Video, Mail, Hammer, Layers,
} from "lucide-react";
import {
  SECTION_LABELS,
  type SectionType,
  type FeaturedProductConfig,
  type FeaturedContentConfig,
  type FeaturedContentItem,
  type NewsletterConfig,
  type CurrentlyBuildingConfig,
  type CustomConfig,
} from "@/lib/creator-hub-types";

type Section = {
  id: string;
  userId: string;
  type: string;
  order: number;
  visible: boolean;
  config: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const SECTION_ICONS: Record<SectionType, React.ElementType> = {
  featured_product: Star,
  products: ShoppingBag,
  social_links: Share2,
  featured_content: Video,
  newsletter: Mail,
  currently_building: Hammer,
  custom: Layers,
};

async function patchSection(id: string, body: Record<string, unknown>) {
  await fetch(`/api/creator-hub/sections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function CreatorHubBlocksClient({
  userId,
  initialSections,
  products,
}: {
  userId: string;
  initialSections: Section[];
  products: { id: string; title: string }[];
}) {
  const [sections, setSections] = useState<Section[]>(
    [...initialSections].sort((a, b) => a.order - b.order)
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      void fetch("/api/creator-hub/sections/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((s) => s.id) }),
      });
      return next;
    });
  }

  function toggleVisible(id: string, visible: boolean) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, visible } : s)));
    void patchSection(id, { visible });
  }

  function saveConfig(id: string, config: Record<string, unknown>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, config } : s)));
    void patchSection(id, { config });
  }

  async function handleAddCustom() {
    setAdding(true);
    try {
      const res = await fetch("/api/creator-hub/sections", { method: "POST" });
      const { section } = await res.json();
      if (section) {
        setSections((prev) => [...prev, section]);
        setExpandedId(section.id);
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/creator-hub/sections/${id}`, { method: "DELETE" });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Creator Hub</h1>
        <p className="mt-1 text-sm text-slate-500">
          Build your public page. Drag blocks to reorder, toggle them on or off, and edit their content. Your photo, banner, name and bio live in{" "}
          <Link href="/dashboard/store/customize" className="text-orange-600 font-medium hover:underline">
            Profile settings
          </Link>
          .
        </p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sections.map((section) => (
              <SortableBlock
                key={section.id}
                section={section}
                products={products}
                expanded={expandedId === section.id}
                onToggleExpand={() => setExpandedId(expandedId === section.id ? null : section.id)}
                onToggleVisible={(v) => toggleVisible(section.id, v)}
                onSaveConfig={(config) => saveConfig(section.id, config)}
                onDelete={() => handleDelete(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        className="mt-4 w-full border-dashed"
        onClick={handleAddCustom}
        disabled={adding}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add custom section
      </Button>

      <div className="mt-6 text-center">
        <Link href={`/c/${userId}`} target="_blank" className="text-sm text-slate-500 hover:text-orange-600">
          Preview your page →
        </Link>
      </div>
    </div>
  );
}

function SortableBlock({
  section,
  products,
  expanded,
  onToggleExpand,
  onToggleVisible,
  onSaveConfig,
  onDelete,
}: {
  section: Section;
  products: { id: string; title: string }[];
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleVisible: (v: boolean) => void;
  onSaveConfig: (config: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const type = section.type as SectionType;
  const Icon = SECTION_ICONS[type] ?? Layers;
  const title = type === "custom" ? ((section.config as CustomConfig)?.title || "Custom section") : SECTION_LABELS[type];

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-slate-300 hover:text-slate-500"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Icon className="h-4 w-4 text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
          {!section.visible && <Badge variant="secondary" className="mt-0.5 text-[10px]">Hidden</Badge>}
        </div>
        <Switch checked={section.visible} onCheckedChange={onToggleVisible} />
        <button onClick={onToggleExpand} className="text-slate-400 hover:text-slate-700 p-1">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
          <SectionEditor type={type} config={section.config} products={products} onSave={onSaveConfig} />
          {type === "custom" && (
            <Button variant="ghost" size="sm" className="mt-3 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete section
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function SectionEditor({
  type,
  config,
  products,
  onSave,
}: {
  type: SectionType;
  config: Record<string, unknown>;
  products: { id: string; title: string }[];
  onSave: (config: Record<string, unknown>) => void;
}) {
  if (type === "featured_product") {
    const c = config as FeaturedProductConfig;
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product to feature</label>
        <select
          className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={c.productId ?? ""}
          onChange={(e) => onSave({ productId: e.target.value || null })}
        >
          <option value="">None selected</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400">Shown as a spotlight card above your full product list.</p>
      </div>
    );
  }

  if (type === "products") {
    return (
      <p className="text-sm text-slate-500">
        Your published products, styled using your{" "}
        <Link href="/dashboard/store/customize" className="text-orange-600 hover:underline">theme and layout settings</Link>.
      </p>
    );
  }

  if (type === "social_links") {
    return (
      <p className="text-sm text-slate-500">
        Managed in{" "}
        <Link href="/dashboard/store/customize" className="text-orange-600 hover:underline">Profile settings</Link>{" "}
        — add your Twitter, Instagram, YouTube, TikTok, LinkedIn or website links there.
      </p>
    );
  }

  if (type === "featured_content") {
    const c = config as FeaturedContentConfig;
    const items = c.items ?? [];

    function update(next: FeaturedContentItem[]) {
      onSave({ items: next });
    }

    return (
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
            <select
              className="h-9 rounded-md border border-slate-200 px-2 text-sm sm:w-32"
              value={item.platform}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...item, platform: e.target.value as FeaturedContentItem["platform"] };
                update(next);
              }}
            >
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
            <Input
              placeholder="Paste video/post URL"
              value={item.url}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...item, url: e.target.value };
                update(next);
              }}
              className="flex-1"
            />
            <Button variant="ghost" size="icon" onClick={() => update(items.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => update([...items, { id: crypto.randomUUID(), platform: "youtube", url: "" }])}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add content
        </Button>
      </div>
    );
  }

  if (type === "newsletter") {
    const c = config as NewsletterConfig;
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Headline</label>
          <Input
            placeholder="Stay in the loop"
            defaultValue={c.headline ?? ""}
            onBlur={(e) => onSave({ ...c, headline: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subtext</label>
          <Input
            placeholder="Get notified about new drops and offers."
            defaultValue={c.subtext ?? ""}
            onBlur={(e) => onSave({ ...c, subtext: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (type === "currently_building") {
    const c = config as CurrentlyBuildingConfig;
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">What are you working on right now?</label>
        <Textarea
          rows={3}
          placeholder="A new course on..."
          defaultValue={c.text ?? ""}
          onBlur={(e) => onSave({ text: e.target.value })}
        />
      </div>
    );
  }

  // custom
  const c = config as CustomConfig;
  const links = c.links ?? [];

  function updateLinks(next: { label: string; url: string }[]) {
    onSave({ ...c, links: next });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</label>
        <Input defaultValue={c.title ?? ""} onBlur={(e) => onSave({ ...c, title: e.target.value })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Text</label>
        <Textarea rows={3} defaultValue={c.body ?? ""} onBlur={(e) => onSave({ ...c, body: e.target.value })} />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Links (optional)</label>
        {links.map((link, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="Label"
              value={link.label}
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...link, label: e.target.value };
                updateLinks(next);
              }}
              className="w-1/3"
            />
            <Input
              placeholder="https://"
              value={link.url}
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...link, url: e.target.value };
                updateLinks(next);
              }}
              className="flex-1"
            />
            <Button variant="ghost" size="icon" onClick={() => updateLinks(links.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => updateLinks([...links, { label: "", url: "" }])}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add link
        </Button>
      </div>
    </div>
  );
}
