"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 120;

/**
 * Animate Scene control from Template Studio AI Story cards: `/api/content-studio/ai-story/animate` + status polling.
 */
export function AiStoryAnimateSceneBlock({
  imageUrl,
  motionPrompt,
  videoUrl,
  onVideoUrl,
  onAnimationStateChange,
  videoClassName = "w-full rounded-md mt-2 aspect-[9/16] object-cover",
}: {
  imageUrl: string;
  motionPrompt: string;
  videoUrl?: string | null;
  onVideoUrl: (url: string) => void;
  onAnimationStateChange?: (isAnimating: boolean) => void;
  /** Class for the preview video element (e.g. 16:9 in Video Guide). */
  videoClassName?: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const pollCountRef = useRef(0);
  const onVideoUrlRef = useRef(onVideoUrl);
  onVideoUrlRef.current = onVideoUrl;
  const onAnimationStateChangeRef = useRef(onAnimationStateChange);
  onAnimationStateChangeRef.current = onAnimationStateChange;

  const animateLoading = loading || !!requestId;

  useEffect(() => {
    onAnimationStateChangeRef.current?.(animateLoading);
  }, [animateLoading]);

  useEffect(() => {
    if (!requestId) return;

    const pollOne = async () => {
      const count = pollCountRef.current + 1;
      pollCountRef.current = count;
      if (count > MAX_POLLS) {
        setRequestId(null);
        setStatus("");
        setTimedOut(true);
        setLoading(false);
        pollCountRef.current = 0;
        return;
      }
      try {
        const res = await fetch(
          `/api/content-studio/ai-story/animate/status?requestId=${encodeURIComponent(requestId)}`
        );
        const data = (await res.json()) as {
          status?: string;
          videoUrl?: string;
          error?: string;
        };
        const st = data.status ?? "IN_QUEUE";
        setStatus(st);

        if (st === "COMPLETED" && data.videoUrl) {
          onVideoUrlRef.current(data.videoUrl);
          setRequestId(null);
          setStatus("");
          setTimedOut(false);
          setLoading(false);
          pollCountRef.current = 0;
          return;
        }
        if (st === "FAILED") {
          toast({
            title: "Animation failed",
            description: data.error ?? "Try again.",
            variant: "destructive",
          });
          setRequestId(null);
          setStatus("");
          setLoading(false);
          pollCountRef.current = 0;
        }
      } catch {
        // keep polling on network error
      }
    };

    const interval = setInterval(() => {
      void pollOne();
    }, POLL_INTERVAL_MS);
    void pollOne();
    return () => clearInterval(interval);
  }, [requestId, toast]);

  return (
    <>
      {timedOut ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            setTimedOut(false);
            pollCountRef.current = 0;
          }}
        >
          Try again
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={animateLoading}
          onClick={async () => {
            setLoading(true);
            setTimedOut(false);
            pollCountRef.current = 0;
            try {
              const res = await fetch("/api/content-studio/ai-story/animate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  imageUrl,
                  motionPrompt: motionPrompt || imageUrl,
                }),
              });
              const data = (await res.json()) as {
                requestId?: string | null;
                request_id?: string | null;
                videoUrl?: string;
                error?: string;
              };
              if (!res.ok) throw new Error(data?.error ?? "Failed");
              const reqId = data.requestId ?? data.request_id ?? null;
              if (data.videoUrl) {
                onVideoUrlRef.current(data.videoUrl);
                setLoading(false);
                return;
              }
              if (reqId) {
                setRequestId(reqId);
                setStatus("IN_QUEUE");
                setLoading(false);
              } else {
                setLoading(false);
                throw new Error("No requestId or videoUrl returned");
              }
            } catch (e) {
              toast({
                title: "Animation failed",
                description: e instanceof Error ? e.message : "Something went wrong",
                variant: "destructive",
              });
              setLoading(false);
            }
          }}
        >
          {animateLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              <span>
                Generating animation… (may take 2–10 mins)
                {status ? ` — ${status.replace("_", " ")}` : ""}
              </span>
            </span>
          ) : (
            "Animate Scene"
          )}
        </Button>
      )}
      {videoUrl ? <video src={videoUrl} controls className={videoClassName} /> : null}
    </>
  );
}
