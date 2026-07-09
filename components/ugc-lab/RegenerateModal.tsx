"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, FileText, Sparkles } from "lucide-react";

export type RegenerateMode = "video_only" | "script" | "angle_and_script";

type RegenerateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  hookPreview: string;
  productContext?: string;
  onRegenerate: (mode: RegenerateMode) => void;
  loading?: boolean;
};

export function RegenerateModal({
  open,
  onOpenChange,
  jobId,
  hookPreview,
  productContext,
  onRegenerate,
  loading = false,
}: RegenerateModalProps) {
  const handleSelect = (mode: RegenerateMode) => {
    onRegenerate(mode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Regenerate variation</DialogTitle>
          <DialogDescription>
            Create a new job. Previous versions stay in history.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
          &ldquo;{hookPreview}&rdquo;
        </p>
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={() => handleSelect("video_only")}
            disabled={loading}
          >
            <Video className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <p className="font-medium">Regenerate Video Only</p>
              <p className="text-xs text-slate-500">Keep same script and angle</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={() => handleSelect("script")}
            disabled={loading}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <p className="font-medium">Regenerate Script</p>
              <p className="text-xs text-slate-500">Keep same angle, new script</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={() => handleSelect("angle_and_script")}
            disabled={loading}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <p className="font-medium">Generate New Angle + New Script</p>
              <p className="text-xs text-slate-500">Fresh marketing angle and script</p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
