"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { SaveAsTemplateModal } from "@/components/save-as-template-modal";

export type SaveAsTemplateButtonProps = {
  content: string;
  formatType: string;
  defaultTitle?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
};

export function SaveAsTemplateButton({
  content,
  formatType,
  defaultTitle,
  variant = "outline",
  size = "sm",
  className,
  children,
}: SaveAsTemplateButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children ?? (
          <>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save as Template
          </>
        )}
      </Button>
      <SaveAsTemplateModal
        open={open}
        onOpenChange={setOpen}
        content={content}
        formatType={formatType}
        defaultTitle={defaultTitle}
      />
    </>
  );
}
