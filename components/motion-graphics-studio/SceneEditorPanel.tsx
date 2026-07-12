"use client";

/**
 * Template Builder — Scene Editor.
 *
 * Edits every field the product spec calls out: text, images, video, icons,
 * colours, fonts, timing, duration, transition, background, camera
 * movement, sound, voiceover, captions — for the currently selected scene.
 *
 * Note on scope: the per-element animation picker offers "wrapper" and
 * "particle" kind animations (from the Animation Library registry) for
 * every element type, plus "textContent" kind animations (typewriter, word/
 * character reveal) for text elements specifically — these map directly
 * onto a single SceneElement. The five "composite" animations (card stack,
 * carousel, logo reveal, CTA ending, timeline progress) are richer,
 * multi-field building blocks; MotionGraphicsComposition already knows how
 * to render them from a JSON-encoded element.content (see
 * src/remotion/motion-graphics/MotionGraphicsComposition.tsx), but a
 * dedicated visual editor for their extra fields is a natural v2 follow-up
 * rather than in-scope for this first pass of the Scene Editor.
 */

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AssetPicker } from "./AssetPicker";
import { useVoiceOptions } from "./useVoiceOptions";
import { Plus, Trash2, Type, Image as ImageIcon, Video as VideoIcon, Shapes, ChevronDown, ChevronUp, Mic, Loader2 } from "lucide-react";
import { ANIMATION_REGISTRY, ANIMATION_IDS } from "@/src/remotion/motion-graphics/animations";
import type {
  AnimationId,
  CameraMovement,
  Scene,
  SceneBackgroundType,
  SceneElement,
  SceneElementType,
} from "@/lib/motion-graphics/types";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`);

const TRANSITION_OPTIONS = ANIMATION_IDS.filter((id) => ANIMATION_REGISTRY[id].kind === "wrapper");
const ELEMENT_ANIMATION_OPTIONS = (elementType: SceneElementType): AnimationId[] =>
  ANIMATION_IDS.filter((id) => {
    const kind = ANIMATION_REGISTRY[id].kind;
    if (kind === "wrapper" || kind === "particle") return true;
    if (kind === "textContent" && elementType === "text") return true;
    return false;
  });

const CAMERA_OPTIONS: { id: CameraMovement; label: string }[] = [
  { id: "none", label: "None" },
  { id: "zoomIn", label: "Zoom In" },
  { id: "zoomOut", label: "Zoom Out" },
  { id: "panLeft", label: "Pan Left" },
  { id: "panRight", label: "Pan Right" },
  { id: "panUp", label: "Pan Up" },
  { id: "panDown", label: "Pan Down" },
];

const GRADIENT_PRESETS = [
  "linear-gradient(160deg, #0f0c29 0%, #302b63 55%, #24243e 100%)",
  "linear-gradient(160deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)",
  "linear-gradient(160deg, #c05621 0%, #F89520 50%, #f6ad55 100%)",
  "linear-gradient(160deg, #0d1117 0%, #161b22 55%, #1c2128 100%)",
];

function updateScene(scene: Scene, patch: Partial<Scene>): Scene {
  return { ...scene, ...patch };
}

const ElementEditor: React.FC<{
  element: SceneElement;
  onChange: (el: SceneElement) => void;
  onDelete: () => void;
}> = ({ element, onChange, onDelete }) => {
  const [open, setOpen] = useState(false);
  const animationOptions = ELEMENT_ANIMATION_OPTIONS(element.type);

  const patch = (p: Partial<SceneElement>) => onChange({ ...element, ...p });

  const icon =
    element.type === "text" ? <Type size={13} /> : element.type === "image" ? <ImageIcon size={13} /> : element.type === "video" ? <VideoIcon size={13} /> : <Shapes size={13} />;

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
      >
        {icon}
        <span className="text-xs font-medium truncate flex-1">
          {element.type} — {element.content?.slice(0, 28) || "(empty)"}
        </span>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-2.5 border-t pt-2.5">
          {element.type === "text" ? (
            <Textarea value={element.content} onChange={(e) => patch({ content: e.target.value })} placeholder="Text content" className="min-h-[60px] text-sm" />
          ) : element.type === "icon" ? (
            <Input value={element.content} onChange={(e) => patch({ content: e.target.value })} placeholder="lucide-react icon name, e.g. Zap" />
          ) : (
            <AssetPicker kind={element.type === "image" ? "image" : "video"} value={element.content} onChange={(v) => patch({ content: v })} />
          )}

          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px]">X %</Label>
              <Input type="number" value={element.x} onChange={(e) => patch({ x: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-[10px]">Y %</Label>
              <Input type="number" value={element.y} onChange={(e) => patch({ y: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-[10px]">W %</Label>
              <Input type="number" value={element.width} onChange={(e) => patch({ width: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-[10px]">H %</Label>
              <Input type="number" value={element.height} onChange={(e) => patch({ height: Number(e.target.value) })} />
            </div>
          </div>

          {element.type === "text" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Color</Label>
                <Input type="color" value={element.color || "#ffffff"} onChange={(e) => patch({ color: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px]">Font size</Label>
                <Input type="number" value={element.fontSize || 42} onChange={(e) => patch({ fontSize: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-[10px]">Font family</Label>
                <Input value={element.fontFamily || ""} onChange={(e) => patch({ fontFamily: e.target.value })} placeholder="Inter" />
              </div>
              <div>
                <Label className="text-[10px]">Align</Label>
                <Select value={element.textAlign || "center"} onValueChange={(v) => patch({ textAlign: v as SceneElement["textAlign"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label className="text-[10px]">Entrance animation</Label>
            <Select
              value={element.animationIn?.animationId || "__none"}
              onValueChange={(v) =>
                patch({
                  animationIn:
                    v === "__none"
                      ? undefined
                      : {
                          animationId: v as AnimationId,
                          durationInFrames: element.animationIn?.durationInFrames || 20,
                          delayFrames: element.animationIn?.delayFrames || 0,
                        },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {animationOptions.map((id) => (
                  <SelectItem key={id} value={id}>
                    {ANIMATION_REGISTRY[id].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {element.animationIn && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Delay (frames)</Label>
                <Input
                  type="number"
                  value={element.animationIn.delayFrames}
                  onChange={(e) => patch({ animationIn: { ...element.animationIn!, delayFrames: Number(e.target.value) } })}
                />
              </div>
              <div>
                <Label className="text-[10px]">Duration (frames)</Label>
                <Input
                  type="number"
                  value={element.animationIn.durationInFrames}
                  onChange={(e) => patch({ animationIn: { ...element.animationIn!, durationInFrames: Number(e.target.value) } })}
                />
              </div>
            </div>
          )}

          <Button size="sm" variant="ghost" className="text-destructive w-full" onClick={onDelete}>
            <Trash2 size={12} className="mr-1.5" />
            Delete element
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Voiceover script editor: text, a manual audio URL fallback (AssetPicker),
 * an ElevenLabs voice picker, and a "Generate voice" button that calls
 * POST /api/admin/motion-graphics/voice/generate and writes the resulting
 * R2 URL straight into scene.voiceover.audioAssetUrl.
 */
const VoiceoverEditor: React.FC<{
  text: string;
  audioAssetUrl?: string;
  onChange: (next: { text: string; audioAssetUrl?: string }) => void;
}> = ({ text, audioAssetUrl, onChange }) => {
  const { voices, error: voicesError } = useVoiceOptions();
  const [voiceId, setVoiceId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVoiceId((current) => current || voices[0]?.id || "");
  }, [voices]);

  const handleGenerate = async () => {
    if (!text.trim() || !voiceId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/motion-graphics/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voice generation failed");
      onChange({ text, audioAssetUrl: data.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <Label>Voiceover script</Label>
      <Textarea
        value={text}
        onChange={(e) => onChange({ text: e.target.value, audioAssetUrl })}
        placeholder="Spoken line for this scene (also drives captions)"
        className="mt-1 min-h-[70px]"
      />

      <div className="mt-2 flex gap-2">
        <Select value={voiceId} onValueChange={setVoiceId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choose a voice" />
          </SelectTrigger>
          <SelectContent>
            {voices.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
                {v.category ? ` — ${v.category}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="secondary" disabled={generating || !text.trim() || !voiceId} onClick={handleGenerate}>
          {generating ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Mic size={13} className="mr-1.5" />}
          Generate voice
        </Button>
      </div>

      {(error || voicesError) && <p className="text-xs text-destructive mt-1.5">{error || voicesError}</p>}

      {audioAssetUrl && (
        <audio controls src={audioAssetUrl} className="w-full mt-2 h-9">
          Your browser does not support audio playback.
        </audio>
      )}

      <div className="mt-1.5">
        <AssetPicker kind="audio" value={audioAssetUrl || ""} onChange={(v) => onChange({ text, audioAssetUrl: v })} placeholder="Or paste a voiceover audio URL" />
      </div>
    </div>
  );
};

export const SceneEditorPanel: React.FC<{
  scene: Scene | null;
  fps: number;
  onChange: (scene: Scene) => void;
}> = ({ scene, fps, onChange }) => {
  if (!scene) {
    return <p className="text-sm text-muted-foreground p-4">Select a scene to edit its properties.</p>;
  }

  const addElement = (type: SceneElementType) => {
    const el: SceneElement = {
      id: uid(),
      type,
      content: type === "text" ? "New text" : type === "icon" ? "Sparkles" : "",
      x: 10,
      y: 40,
      width: 80,
      height: 20,
      color: "#ffffff",
      textAlign: "center",
      zIndex: scene.elements.length,
    };
    onChange(updateScene(scene, { elements: [...scene.elements, el] }));
  };

  const updateElement = (id: string, next: SceneElement) => {
    onChange(updateScene(scene, { elements: scene.elements.map((e) => (e.id === id ? next : e)) }));
  };

  const deleteElement = (id: string) => {
    onChange(updateScene(scene, { elements: scene.elements.filter((e) => e.id !== id) }));
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="scene">
        <TabsList className="w-full">
          <TabsTrigger value="scene" className="flex-1">
            Scene
          </TabsTrigger>
          <TabsTrigger value="elements" className="flex-1">
            Elements ({scene.elements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scene" className="space-y-4 mt-4">
          <div>
            <Label>Scene name</Label>
            <Input value={scene.name} onChange={(e) => onChange(updateScene(scene, { name: e.target.value }))} className="mt-1" />
          </div>

          <div>
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              step="0.1"
              value={(scene.durationInFrames / fps).toFixed(1)}
              onChange={(e) => onChange(updateScene(scene, { durationInFrames: Math.max(Math.round(Number(e.target.value) * fps), fps) }))}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Background</Label>
            <Select
              value={scene.background.type}
              onValueChange={(v) => onChange(updateScene(scene, { background: { type: v as SceneBackgroundType, value: scene.background.value } }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="color">Solid color</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="animated">Animated background</SelectItem>
              </SelectContent>
            </Select>

            <div className="mt-2">
              {scene.background.type === "color" && (
                <Input
                  type="color"
                  value={scene.background.value || "#111111"}
                  onChange={(e) => onChange(updateScene(scene, { background: { ...scene.background, value: e.target.value } }))}
                  className="h-9"
                />
              )}
              {scene.background.type === "gradient" && (
                <div className="space-y-2">
                  <Input
                    value={scene.background.value}
                    onChange={(e) => onChange(updateScene(scene, { background: { ...scene.background, value: e.target.value } }))}
                    placeholder="linear-gradient(...)"
                  />
                  <div className="flex gap-2">
                    {GRADIENT_PRESETS.map((g) => (
                      <button
                        key={g}
                        className="w-8 h-8 rounded border"
                        style={{ background: g }}
                        onClick={() => onChange(updateScene(scene, { background: { ...scene.background, value: g } }))}
                      />
                    ))}
                  </div>
                </div>
              )}
              {(scene.background.type === "image" || scene.background.type === "video") && (
                <AssetPicker
                  kind={scene.background.type}
                  value={scene.background.value}
                  onChange={(v) => onChange(updateScene(scene, { background: { ...scene.background, value: v } }))}
                />
              )}
              {scene.background.type === "animated" && (
                <Select value={scene.background.value || "gradientShift"} onValueChange={(v) => onChange(updateScene(scene, { background: { ...scene.background, value: v } }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gradientShift">Gradient Shift</SelectItem>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="waves">Waves</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div>
            <Label>Camera movement</Label>
            <Select value={scene.cameraMovement} onValueChange={(v) => onChange(updateScene(scene, { cameraMovement: v as CameraMovement }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMERA_OPTIONS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Transition in</Label>
              <Select value={scene.transitionIn} onValueChange={(v) => onChange(updateScene(scene, { transitionIn: v as AnimationId }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSITION_OPTIONS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {ANIMATION_REGISTRY[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transition out</Label>
              <Select value={scene.transitionOut} onValueChange={(v) => onChange(updateScene(scene, { transitionOut: v as AnimationId }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSITION_OPTIONS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {ANIMATION_REGISTRY[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Captions enabled</Label>
            <Switch
              checked={scene.captions.enabled}
              onCheckedChange={(v) => onChange(updateScene(scene, { captions: { ...scene.captions, enabled: v } }))}
            />
          </div>
          {scene.captions.enabled && (
            <Select value={scene.captions.style} onValueChange={(v) => onChange(updateScene(scene, { captions: { ...scene.captions, style: v as Scene["captions"]["style"] } }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wordByWord">Word by word</SelectItem>
                <SelectItem value="karaoke">Karaoke</SelectItem>
                <SelectItem value="block">Block</SelectItem>
              </SelectContent>
            </Select>
          )}

          <VoiceoverEditor
            text={scene.voiceover?.text || ""}
            audioAssetUrl={scene.voiceover?.audioAssetUrl}
            onChange={(next) => onChange(updateScene(scene, { voiceover: next }))}
          />

          <div>
            <Label>Background music</Label>
            <AssetPicker kind="music" value={scene.sound?.musicAssetUrl || ""} onChange={(v) => onChange(updateScene(scene, { sound: { ...scene.sound, musicAssetUrl: v } }))} />
            {scene.sound?.musicAssetUrl && (
              <div className="mt-2">
                <Label className="text-[10px]">Music volume</Label>
                <Slider
                  value={[Math.round((scene.sound.musicVolume ?? 0.4) * 100)]}
                  onValueChange={([v]) => onChange(updateScene(scene, { sound: { ...scene.sound, musicVolume: v / 100 } }))}
                  max={100}
                />
              </div>
            )}
          </div>

          <div>
            <Label>Sound effect (SFX)</Label>
            <AssetPicker kind="sfx" value={scene.sound?.sfxAssetUrl || ""} onChange={(v) => onChange(updateScene(scene, { sound: { ...scene.sound, sfxAssetUrl: v } }))} />
          </div>
        </TabsContent>

        <TabsContent value="elements" className="space-y-3 mt-4">
          <div className="grid grid-cols-4 gap-1.5">
            <Button size="sm" variant="outline" onClick={() => addElement("text")}>
              <Type size={12} className="mr-1" />
              Text
            </Button>
            <Button size="sm" variant="outline" onClick={() => addElement("image")}>
              <ImageIcon size={12} className="mr-1" />
              Image
            </Button>
            <Button size="sm" variant="outline" onClick={() => addElement("video")}>
              <VideoIcon size={12} className="mr-1" />
              Video
            </Button>
            <Button size="sm" variant="outline" onClick={() => addElement("icon")}>
              <Shapes size={12} className="mr-1" />
              Icon
            </Button>
          </div>

          {scene.elements.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No elements yet — add text, an image, video, or icon.</p>
          ) : (
            <div className="space-y-2">
              {scene.elements.map((el) => (
                <ElementEditor key={el.id} element={el} onChange={(next) => updateElement(el.id, next)} onDelete={() => deleteElement(el.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
