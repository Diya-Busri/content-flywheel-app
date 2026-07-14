"use client";

/**
 * useMgAgentRun — client-side hook for MG Agent Workflow.
 *
 * Manages a single agent run:
 * - Stores runId in component state (not URL) to avoid page-level re-renders
 * - Polls GET /agent-runs/:runId every 2 seconds while run is active
 * - Stops polling at gate states (user must act) and terminal states
 * - Exposes typed action functions for each user action
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MgRunWithSteps, MgRunStatus, MgPlanEdits } from "@/lib/motion-graphics/agent-types";
import { MG_ACTIVE_STATUSES } from "@/lib/motion-graphics/agent-types";
import type { StoryboardScene } from "@/lib/motion-graphics/types";

export type { MgRunWithSteps };

const POLL_INTERVAL_MS = 2000;

type State = {
  runWithSteps: MgRunWithSteps | null;
  loading: boolean;
  /** True while an action (approve, cancel, retry) is in-flight */
  actionPending: boolean;
  /** Network/API error for the last action (separate from run.error) */
  actionError: string | null;
};

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function useMgAgentRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const [state, setState] = useState<State>({
    runWithSteps: null,
    loading: false,
    actionPending: false,
    actionError: null,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch current run state ─────────────────────────────────────────────
  const fetchRun = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/motion-graphics/agent-runs/${id}`);
      const data = await safeJson(res);
      if (!res.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          actionError: (data.error as string) ?? "Failed to load run",
        }));
        return;
      }
      setState((s) => ({
        ...s,
        runWithSteps: data as unknown as MgRunWithSteps,
        loading: false,
        actionError: null,
      }));
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        actionError: "Connection error — check your network",
      }));
    }
  }, []);

  // ── Start/reset polling when runId or status changes ───────────────────
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!runId) return;
    const status = state.runWithSteps?.status as MgRunStatus | undefined;
    if (!status || !MG_ACTIVE_STATUSES.has(status)) return;
    pollRef.current = setInterval(() => void fetchRun(runId), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId, state.runWithSteps?.status, fetchRun]);

  // ── Generic action helper ───────────────────────────────────────────────
  const runAction = useCallback(
    async (
      path: string,
      body: Record<string, unknown> = {}
    ): Promise<Record<string, unknown> | null> => {
      setState((s) => ({ ...s, actionPending: true, actionError: null }));
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await safeJson(res);
        if (!res.ok) {
          setState((s) => ({
            ...s,
            actionPending: false,
            actionError: (data.error as string) ?? "Something went wrong.",
            runWithSteps: (data as unknown as MgRunWithSteps) ?? s.runWithSteps,
          }));
          return null;
        }
        setState((s) => ({
          ...s,
          actionPending: false,
          actionError: null,
          runWithSteps: (data as unknown as MgRunWithSteps) ?? s.runWithSteps,
        }));
        return data;
      } catch {
        setState((s) => ({
          ...s,
          actionPending: false,
          actionError: "Connection error — check your network",
        }));
        return null;
      }
    },
    []
  );

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Start a new agent run. Returns the runId on success.
   * The run creation + Phase 1 (analysis + strategy) happen in this call.
   */
  const startRun = useCallback(
    async (payload: {
      contentMode: string;
      sourceText: string;
      sourceUrl?: string;
      targetAudience?: string;
      mainOpinion?: string;
      desiredCta?: string;
      cfMention: string;
      videoDuration?: string;
      tone?: string;
      aspectRatio: string;
    }): Promise<string | null> => {
      setState((s) => ({ ...s, loading: true, actionPending: true, actionError: null }));
      try {
        const res = await fetch("/api/admin/motion-graphics/agent-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await safeJson(res);
        if (!res.ok) {
          setState((s) => ({
            ...s,
            loading: false,
            actionPending: false,
            actionError: (data.error as string) ?? "Failed to start run",
          }));
          return null;
        }
        const rws = data as unknown as MgRunWithSteps;
        setRunId(rws.id);
        setState((s) => ({
          ...s,
          runWithSteps: rws,
          loading: false,
          actionPending: false,
          actionError: null,
        }));
        return rws.id;
      } catch {
        setState((s) => ({
          ...s,
          loading: false,
          actionPending: false,
          actionError: "Connection error — check your network",
        }));
        return null;
      }
    },
    []
  );

  /** Approve the plan (with optional edits) and start Phase 2. */
  const approvePlan = useCallback(
    (edits?: MgPlanEdits) => {
      if (!runId) return Promise.resolve(null);
      return runAction(
        `/api/admin/motion-graphics/agent-runs/${runId}/approve-plan`,
        edits ?? {}
      );
    },
    [runId, runAction]
  );

  /** Approve the storyboard (with user-edited scenes) and save the project. */
  const approveStoryboard = useCallback(
    (scenes: StoryboardScene[], existingProjectId?: string) => {
      if (!runId) return Promise.resolve(null);
      return runAction(
        `/api/admin/motion-graphics/agent-runs/${runId}/approve-storyboard`,
        { scenes, ...(existingProjectId ? { existingProjectId } : {}) }
      );
    },
    [runId, runAction]
  );

  /** Cancel the run. */
  const cancelRun = useCallback(() => {
    if (!runId) return Promise.resolve(null);
    return runAction(`/api/admin/motion-graphics/agent-runs/${runId}/cancel`);
  }, [runId, runAction]);

  /** Retry a failed run. */
  const retryRun = useCallback(() => {
    if (!runId) return Promise.resolve(null);
    return runAction(`/api/admin/motion-graphics/agent-runs/${runId}/retry`);
  }, [runId, runAction]);

  /** Reset to start a fresh run (clears local state). */
  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setRunId(null);
    setState({ runWithSteps: null, loading: false, actionPending: false, actionError: null });
  }, []);

  return {
    run:           state.runWithSteps,
    steps:         state.runWithSteps?.steps ?? [],
    loading:       state.loading,
    actionPending: state.actionPending,
    actionError:   state.actionError,
    startRun,
    approvePlan,
    approveStoryboard,
    cancelRun,
    retryRun,
    reset,
  };
}
