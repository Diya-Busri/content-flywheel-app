"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ExecutionRunStatus,
  ExecutionStepStatus,
  JarvisGate,
  JarvisPlan,
  JarvisFinalSummary,
  ProposedAsset,
  JarvisToolName,
} from "@/db/schema/jarvis-schema";

export type JarvisRunDTO = {
  id: string;
  userId: string;
  goal: string;
  status: ExecutionRunStatus;
  currentGate: JarvisGate;
  plan: JarvisPlan | null;
  assets: ProposedAsset[];
  finalSummary: JarvisFinalSummary | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JarvisStepDTO = {
  id: string;
  runId: string;
  toolName: JarvisToolName;
  status: ExecutionStepStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

const ACTIVE_STATUSES = new Set<ExecutionRunStatus>(["queued", "planning", "running"]);
const POLL_INTERVAL_MS = 2000;

type State = {
  run: JarvisRunDTO | null;
  steps: JarvisStepDTO[];
  loading: boolean;
  actionPending: boolean;
  /** Transient/network-level error — separate from run.error, which is a
   * genuine tool/phase failure persisted server-side. */
  actionError: string | null;
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function useJarvisRun() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get("run");

  const [state, setState] = useState<State>({
    run: null,
    steps: [],
    loading: Boolean(runId),
    actionPending: false,
    actionError: null,
  });

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setRunIdInUrl = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("run", id);
      else params.delete("run");
      const qs = params.toString();
      router.replace(qs ? `/jarvis?${qs}` : "/jarvis", { scroll: false });
    },
    [router, searchParams],
  );

  const fetchRun = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/jarvis/runs/${id}`);
      const data = await parseJson(res);
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, actionError: (data.error as string) ?? "Failed to load run" }));
        return;
      }
      setState((s) => ({
        ...s,
        run: data.run as JarvisRunDTO,
        steps: data.steps as JarvisStepDTO[],
        loading: false,
        actionError: null,
      }));
    } catch {
      setState((s) => ({ ...s, loading: false, actionError: "Couldn't reach the server — check your connection." }));
    }
  }, []);

  // Load (or reload) whenever the run id in the URL changes.
  useEffect(() => {
    if (!runId) {
      setState((s) => ({ ...s, run: null, steps: [], loading: false }));
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    void fetchRun(runId);
  }, [runId, fetchRun]);

  // Poll only while the run is actively working — never while a request is
  // already in flight, and never for terminal/awaiting-approval states.
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (!runId || !state.run || !ACTIVE_STATUSES.has(state.run.status)) return;
    pollRef.current = setInterval(() => {
      void fetchRun(runId);
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [runId, state.run, fetchRun]);

  const runAction = useCallback(
    async (path: string, body?: Record<string, unknown>, method: "POST" | "PATCH" = "POST") => {
      setState((s) => ({ ...s, actionPending: true, actionError: null }));
      try {
        const res = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const data = await parseJson(res);
        if (!res.ok) {
          setState((s) => ({
            ...s,
            actionPending: false,
            actionError: (data.error as string) ?? "Something went wrong.",
            run: (data.run as JarvisRunDTO) ?? s.run,
          }));
          return null;
        }
        setState((s) => ({
          ...s,
          actionPending: false,
          actionError: null,
          run: (data.run as JarvisRunDTO) ?? s.run,
          steps: (data.steps as JarvisStepDTO[]) ?? s.steps,
        }));
        return data;
      } catch {
        setState((s) => ({ ...s, actionPending: false, actionError: "Couldn't reach the server — check your connection." }));
        return null;
      }
    },
    [],
  );

  const startRun = useCallback(
    async (goal: string) => {
      const data = await runAction("/api/jarvis/runs", { goal });
      if (data?.run) {
        const run = data.run as JarvisRunDTO;
        setRunIdInUrl(run.id);
      }
    },
    [runAction, setRunIdInUrl],
  );

  const generateAssets = useCallback(
    (answers?: Record<string, string>) => {
      if (!runId) return Promise.resolve(null);
      return runAction(`/api/jarvis/runs/${runId}/generate`, { answers });
    },
    [runId, runAction],
  );

  const approveAssets = useCallback(
    // Omit approvedAssetIds entirely (rather than []) to retry a failed save
    // with whatever was already marked "approved" on the previous attempt —
    // an empty array means "nothing selected", which the server rejects.
    (approvedAssetIds?: string[]) => {
      if (!runId) return Promise.resolve(null);
      return runAction(`/api/jarvis/runs/${runId}/approve`, { approvedAssetIds });
    },
    [runId, runAction],
  );

  const retryPlan = useCallback(() => {
    if (!runId) return Promise.resolve(null);
    return runAction(`/api/jarvis/runs/${runId}/retry-plan`);
  }, [runId, runAction]);

  const cancelRun = useCallback(() => {
    if (!runId) return Promise.resolve(null);
    return runAction(`/api/jarvis/runs/${runId}/cancel`);
  }, [runId, runAction]);

  const editAsset = useCallback(
    async (assetId: string, patch: Record<string, unknown>) => {
      if (!runId) return "No active run";
      const data = await runAction(`/api/jarvis/runs/${runId}/assets/${assetId}`, { patch }, "PATCH");
      return data ? null : "Failed to save edit";
    },
    [runId, runAction],
  );

  const startNewTask = useCallback(() => {
    setState({ run: null, steps: [], loading: false, actionPending: false, actionError: null });
    setRunIdInUrl(null);
  }, [setRunIdInUrl]);

  const openRun = useCallback(
    (id: string) => {
      setRunIdInUrl(id);
    },
    [setRunIdInUrl],
  );

  return {
    run: state.run,
    steps: state.steps,
    loading: state.loading,
    actionPending: state.actionPending,
    actionError: state.actionError,
    startRun,
    generateAssets,
    approveAssets,
    retryPlan,
    cancelRun,
    editAsset,
    startNewTask,
    openRun,
  };
}
