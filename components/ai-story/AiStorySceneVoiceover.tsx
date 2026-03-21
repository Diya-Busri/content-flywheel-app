"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { toSpeakable } from "@/lib/to-speakable";

/**
 * Voiceover controls from Template Studio AI Story scene cards: `/api/ai-coach/voice-over` + native audio player.
 */
export function AiStorySceneVoiceover({
  voiceId,
  dialogueLine,
  audioUrl,
  onAudioUrl,
  maxDurationSeconds,
}: {
  voiceId: string;
  /** If it contains "Name:", the part after the first colon is spoken (same as AI Story). */
  dialogueLine: string;
  audioUrl?: string | null;
  onAudioUrl: (url: string) => void;
  maxDurationSeconds: number;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const scriptText = dialogueLine.includes(":")
    ? dialogueLine.slice(dialogueLine.indexOf(":") + 1).trim()
    : dialogueLine;
  const speakableText = toSpeakable(scriptText);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={!voiceId || loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await fetch("/api/ai-coach/voice-over", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                script: speakableText,
                voiceId,
                maxDurationSeconds,
              }),
            });
            const data = (await res.json()) as { url?: string; error?: string; publicUrl?: string; audioUrl?: string };
            if (!res.ok) throw new Error(data?.error ?? "Failed");
            const voUrl =
              typeof data.url === "string"
                ? data.url
                : typeof data.publicUrl === "string"
                  ? data.publicUrl
                  : typeof data.audioUrl === "string"
                    ? data.audioUrl
                    : "";
            if (!voUrl.trim()) throw new Error("No audio URL returned");
            onAudioUrl(voUrl.trim());
          } catch (e) {
            toast({
              title: "Voiceover failed",
              description: e instanceof Error ? e.message : "Something went wrong",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Generate Voiceover
      </Button>
      {audioUrl ? <audio src={audioUrl} controls className="w-full mt-2" /> : null}
    </>
  );
}
