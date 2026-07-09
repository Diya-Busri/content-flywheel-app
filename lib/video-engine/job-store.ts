/**
 * CF Video Engine – In-Memory Job Store
 *
 * Tracks render jobs for the lifetime of the Next.js dev server process.
 * The API route starts a job, updates it during render, and the frontend polls it.
 *
 * ⚠️  WHY globalThis?
 * Next.js 14 App Router compiles each route as a separate module bundle, each
 * with its own module registry.  That means `import { jobs } from './job-store'`
 * in the render route and the status route can resolve to TWO DIFFERENT module
 * instances with TWO DIFFERENT Maps — even though the webpack key is the same.
 * Anchoring the Map on `globalThis` bypasses module-registry isolation entirely:
 * there is only ever one Node.js process `global` object, so every route that
 * accesses `globalThis.__cfVideoEngineJobs` gets the exact same Map.
 *
 * TODO (v2): persist job status to the database so jobs survive server restarts
 * and can be shared across multiple server instances.
 */

export type RenderStage =
  | 'queued'
  | 'generating_audio'
  | 'bundling'
  | 'rendering'
  | 'complete'
  | 'error';

export type RenderJob = {
  jobId: string;
  projectId: string;
  projectTitle: string;
  stage: RenderStage;
  /** 0–100 */
  progress: number;
  /** Human-readable description of the current step */
  message: string;
  /** Set when stage === 'complete' — the /engine-renders/…/output.mp4 URL */
  downloadUrl?: string;
  /** Set when stage === 'error' */
  error?: string;
  createdAt: string;
  completedAt?: string;
};

// ─── Global store ─────────────────────────────────────────────────────────────
//
// Using globalThis guarantees a single shared Map regardless of how many times
// this module is instantiated across different Next.js module bundles.

declare global {
  // eslint-disable-next-line no-var
  var __cfVideoEngineJobs: Map<string, RenderJob> | undefined;
}

if (!globalThis.__cfVideoEngineJobs) {
  globalThis.__cfVideoEngineJobs = new Map<string, RenderJob>();
}

const jobs = globalThis.__cfVideoEngineJobs;

// ─── Store API ────────────────────────────────────────────────────────────────

export function createJob(jobId: string, projectId: string, projectTitle: string): RenderJob {
  const job: RenderJob = {
    jobId,
    projectId,
    projectTitle,
    stage: 'queued',
    progress: 0,
    message: 'Queued…',
    createdAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  console.log(`[job-store] created job ${jobId} for project ${projectId} (store size: ${jobs.size})`);
  return job;
}

export function updateJob(jobId: string, update: Partial<RenderJob>): void {
  const job = jobs.get(jobId);
  if (!job) {
    console.warn(`[job-store] updateJob: job ${jobId} not found in store (store size: ${jobs.size})`);
    return;
  }
  Object.assign(job, update);
}

export function getJob(jobId: string): RenderJob | undefined {
  const job = jobs.get(jobId);
  if (!job) {
    console.warn(`[job-store] getJob: job ${jobId} not found (store size: ${jobs.size})`);
  }
  return job;
}

export function listJobs(): RenderJob[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Simple collision-resistant ID — no crypto needed */
export function generateJobId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `job_${ts}_${rand}`;
}
