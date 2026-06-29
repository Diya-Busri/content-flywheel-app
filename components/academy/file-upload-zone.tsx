"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { uploadFile, formatFileSize } from "./upload-helpers";

export function FileUploadZone({
  value,
  fileName,
  onChange,
}: {
  value?: string;
  fileName?: string;
  onChange: (url: string, meta: { name: string; fileType: string }) => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState(fileName ?? "");
  const [size, setSize] = useState<string | null>(null);

  async function handleFile(file: File) {
    setProgress(0);
    setName(file.name);
    setSize(formatFileSize(file.size));
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    try {
      const { url } = await uploadFile(file, "academy-downloads", "lessons", setProgress);
      onChange(url, { name: file.name, fileType: ext });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setProgress(null);
    }
  }

  if (value && progress === null) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{name || "File"}</p>
          {size && <p className="text-xs text-muted-foreground">{size}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange("", { name: "", fileType: "" })}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (progress !== null) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading… {progress}%
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={`flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center ${dragging ? "bg-primary/5" : "bg-card"}`}
    >
      <FileText className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Drag &amp; drop file here</p>
      <p className="text-xs text-muted-foreground">or</p>
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="mr-1.5 h-4 w-4" /> Click to upload
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
