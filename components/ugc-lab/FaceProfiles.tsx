"use client";

import { useState, useCallback, useRef } from "react";
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
import { User, Upload, Loader2, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const CROP_SIZE = 512;

export type FaceProfile = {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  createdAt: string;
};

type FaceProfilesProps = {
  profiles: FaceProfile[];
  onRefresh: () => void;
  selectedProfileId?: string | null;
  onSelectProfile?: (id: string | null) => void;
};

export function FaceProfiles({ profiles, onRefresh, selectedProfileId, onSelectProfile }: FaceProfilesProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [name, setName] = useState("");
  const [step, setStep] = useState<"upload" | "crop" | "validate">("upload");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setCropOffset({ x: 0, y: 0 });
    setZoom(1);
    setName("");
    setStep("upload");
    setValidationError(null);
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast({ title: "Invalid format", description: "Use JPEG, PNG, or WebP.", variant: "destructive" });
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      toast({ title: "File too large", description: "Max 5MB.", variant: "destructive" });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep("crop");
    setValidationError(null);
  };

  const getCroppedBlob = useCallback(async (): Promise<Blob | null> => {
    if (!imgRef.current || !file || !canvasRef.current) return null;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const size = Math.min(w, h);
    const s = size / zoom;
    const maxOffset = Math.max(0, size - s) / 2;
    const sx = (w - s) / 2 + cropOffset.x * maxOffset;
    const sy = (h - s) / 2 + cropOffset.y * maxOffset;

    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), Math.min(s, w), Math.min(s, h), 0, 0, CROP_SIZE, CROP_SIZE);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        file.type === "image/png" ? "image/png" : "image/jpeg",
        0.95
      );
    });
  }, [file, zoom, cropOffset]);

  const checkSingleFaceClient = async (blob: Blob): Promise<{ ok: boolean; error?: string }> => {
    if (typeof window === "undefined" || !("FaceDetector" in window)) return { ok: true };
    try {
      const fd = (window as unknown as { FaceDetector: new () => { detect: (img: HTMLImageElement) => Promise<unknown[]> } }).FaceDetector;
      const detector = new fd();
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });
      const faces = await detector.detect(img);
      URL.revokeObjectURL(img.src);
      if (faces.length === 0) return { ok: false, error: "No face detected. Use a clear front-facing photo." };
      if (faces.length > 1) return { ok: false, error: "Multiple faces detected. Use a photo with only one person." };
      return { ok: true };
    } catch {
      return { ok: true };
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    setLoading(true);
    setValidationError(null);
    try {
      const blob = await getCroppedBlob();
      if (!blob) throw new Error("Could not crop image");

      const clientCheck = await checkSingleFaceClient(blob);
      if (!clientCheck.ok) {
        setValidationError(clientCheck.error ?? "Validation failed");
        toast({ title: "Validation failed", description: clientCheck.error, variant: "destructive" });
        setLoading(false);
        return;
      }

      const fd = new FormData();
      fd.append("file", blob, file.name);
      const res = await fetch("/api/ugc-lab/face-validate", { method: "POST", body: fd });
      const data = await res.json();
      if (data.valid) {
        setStep("validate");
        toast({ title: "Image valid", description: data.message });
      } else {
        setValidationError(data.error ?? "Validation failed");
        toast({ title: "Validation failed", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Validation failed");
      toast({ title: "Error", description: "Could not validate image", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!file || !name.trim()) return;
    setLoading(true);
    try {
      const blob = await getCroppedBlob();
      if (!blob) throw new Error("Could not crop image");
      const fd = new FormData();
      fd.append("file", blob, file.name);
      fd.append("name", name.trim());
      const res = await fetch("/api/ugc-lab/face-profiles", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      toast({ title: "Profile saved", description: `${name} added to your profiles.` });
      reset();
      onRefresh();
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <User className="w-4 h-4" />
          Face Profiles
        </CardTitle>
        <CardDescription className="text-xs">
          Upload, validate, crop & save. Reusable across projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {step === "upload" && (
          <label className="block">
            <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-600 p-6 text-center cursor-pointer transition-colors">
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">Upload face photo</p>
              <p className="text-xs text-slate-500 mt-1">JPEG, PNG, WebP · Max 5MB · Single face</p>
              <input
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </label>
        )}

        {(step === "crop" || step === "validate") && previewUrl && (
          <div className="space-y-3">
            <div className="relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 aspect-square max-h-[200px]">
              <img
                ref={imgRef}
                src={previewUrl}
                alt="Crop preview"
                className="w-full h-full object-cover"
                style={{
                  transform: `scale(${zoom}) translate(${cropOffset.x * 10}px, ${cropOffset.y * 10}px)`,
                }}
                crossOrigin="anonymous"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            {step === "crop" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Zoom</Label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">X</Label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={cropOffset.x}
                      onChange={(e) => setCropOffset((p) => ({ ...p, x: Number(e.target.value) }))}
                      className="w-full h-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Y</Label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={cropOffset.y}
                      onChange={(e) => setCropOffset((p) => ({ ...p, y: Number(e.target.value) }))}
                      className="w-full h-2"
                    />
                  </div>
                </div>
              </>
            )}
            {validationError && (
              <p className="text-xs text-red-600 dark:text-red-400">{validationError}</p>
            )}
            <div className="flex gap-2">
              {step === "crop" && (
                <>
                  <Button size="sm" variant="outline" onClick={reset} disabled={loading}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleValidate} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Validate
                  </Button>
                </>
              )}
              {step === "validate" && (
                <>
                  <Input
                    placeholder="Profile name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleSave} disabled={loading || !name.trim()}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {profiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Saved profiles</Label>
            <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProfile?.(selectedProfileId === p.id ? null : p.id)}
                  className={`rounded-lg border overflow-hidden text-left transition-colors ${
                    selectedProfileId === p.id
                      ? "border-orange-500 ring-2 ring-orange-200 dark:ring-orange-800"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-full aspect-square object-cover"
                  />
                  <p className="text-[10px] truncate px-1 py-0.5 text-slate-600 dark:text-slate-400">
                    {p.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
