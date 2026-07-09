"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  setTemplatePrefill,
  getEditorPathForFormatType,
} from "@/lib/template-prefill";
import { FileText, Loader2 } from "lucide-react";

type TemplateItem = {
  id: string;
  title: string;
  formatType: string;
  tags?: string;
  createdAt?: string;
};

const FORMAT_LABELS: Record<string, string> = {
  copy_writer: "Copy / Description",
  script: "Script",
  seo: "SEO",
  ebook: "Ebook",
  planner: "Planner",
  workbook: "Workbook",
  spreadsheet: "Spreadsheet",
  notion: "Notion",
  course: "Course",
  checklist: "Checklist",
  journal: "Journal",
  marketing: "Marketing",
  other: "Other",
};

function formatLabel(formatType: string): string {
  return FORMAT_LABELS[formatType] ?? formatType;
}

export default function TemplatesClient() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-templates");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({
        title: "Error",
        description: "Could not load templates",
        variant: "destructive",
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleUseTemplate = async (id: string) => {
    setUsingId(id);
    try {
      const res = await fetch(`/api/saved-templates/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Error",
          description: data.error ?? "Template not found",
          variant: "destructive",
        });
        return;
      }
      setTemplatePrefill({
        content: data.content ?? "",
        formatType: data.formatType ?? "other",
        title: data.title ?? "",
        templateId: data.id,
      });
      const path = getEditorPathForFormatType(data.formatType ?? "other");
      router.push(path);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setUsingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">
            Use &quot;Save as Template&quot; on any generated output (Copy Writer, Marketing copy, etc.) to save it here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <Card key={t.id} className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base truncate" title={t.title}>
              {t.title}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs">
                {formatLabel(t.formatType)}
              </span>
              {t.tags?.trim() && (
                <span className="text-xs text-muted-foreground truncate">
                  {t.tags}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 mt-auto">
            <Button
              size="sm"
              className="w-full"
              onClick={() => handleUseTemplate(t.id)}
              disabled={usingId !== null}
            >
              {usingId === t.id ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : null}
              Use Template
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
