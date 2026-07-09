import { TASK_CATEGORIES } from "@/lib/goals/categories";

export type GeneratedTask = {
  dayNumber: number;
  taskDescription: string;
  duration: string;
  howToComplete: string;
  taskType?: "external" | "app_action";
  appLink?: string;
  appLabel?: string;
  category?: string;
};

const TIME_OPTIONS = ["30min", "1hr", "2hr", "3hr", "4hr+"] as const;

export type GenerateTasksOptions = {
  title: string;
  description?: string;
  totalDays: number;
  dailyTimeCommitment: string;
  /** If provided, only generate tasks for these days (e.g. [1] for Day 1 only). */
  daysToGenerate?: number[];
};

export async function generateTasks(options: GenerateTasksOptions): Promise<GeneratedTask[]> {
  const { title, description, totalDays, dailyTimeCommitment, daysToGenerate } = options;

  const timeCommitment =
    dailyTimeCommitment && TIME_OPTIONS.includes(dailyTimeCommitment as (typeof TIME_OPTIONS)[number])
      ? dailyTimeCommitment
      : "1hr";

  const commitmentMinutes =
    timeCommitment === "30min"
      ? 30
      : timeCommitment === "1hr"
        ? 60
        : timeCommitment === "2hr"
          ? 120
          : timeCommitment === "3hr"
            ? 180
            : 240;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const systemPrompt = `You are an execution coach, not a productivity planner. Your job is to generate daily tasks that feel like real actions a person can DO and finish, not things to think about or prepare for.

CORE RULE — EXECUTION OVER PREPARATION:
Every task must start with an action verb that implies something visible gets done:
post, send, upload, record, edit, publish, build, fix, write, apply, reply, push, finish, complete, launch, film, design, create, revise, test, ship.

BANNED task starters (never generate these):
"Research best practices", "Define target audience", "Create checklist", "Plan strategy", "Brainstorm framework", "Analyze approach", "Draft outline", "Review options", "Think about", "Consider", "Explore", "Look into".

PLANNING LIMIT: Maximum 1 planning or research task across the ENTIRE goal, and only on Day 1. After Day 1, every task must be pure execution.

TASK SIZE: Each task must be completable in 10–30 minutes. Nothing vague, nothing open-ended. If a task could take hours, split it into specific smaller actions.

GOAL TYPE PATTERNS — generate tasks in this style based on the goal:
- Content / TikTok / social media goals → record hook, film intro clip, edit video, post reel, upload carousel, write caption, reply to 5 comments, send collab DM
- Coding / dev / app goals → push code to GitHub, fix this bug, build this feature, deploy to production, write this function, update landing page, add this button
- Study / exam / revision goals → revise Chapter 3, complete 10 practice questions, make flashcards for Topic X, take timed mock test, summarise key points
- Job search goals → apply to 1 role on LinkedIn, update CV bullet for this skill, send follow-up email, message recruiter on LinkedIn, complete one interview prep question
- Business / sales / product goals → send 10 cold DMs, post product listing, write email to list, reply to enquiries, update product page, send invoice, record testimonial request

CONTENT FLYWHEEL APP ACTIONS – use when the task fits:
- Creating digital products (ebooks, checklists, templates, workbooks) → taskType: "app_action", appLink: "/dashboard/products/create", appLabel: "Open Product Creator"
- Making marketing videos / TikTok Shop content → taskType: "app_action", appLink: "/dashboard/tiktok", appLabel: "Open TikTok Shop"
- Checking script compliance (ad copy, scripts) → taskType: "app_action", appLink: "/dashboard/scripts", appLabel: "Open Scripts"

PROOF: Every task should be easy to prove complete — a screenshot of a post, a link to code, a photo of notes, a sent message. Avoid tasks that are impossible to prove.

CATEGORIES — assign one to every task (use exact values):
- admin: Account setup, billing, forms
- marketing: Posting, outreach, promotion, DMs
- content_creation: Recording, editing, writing, uploading
- operations: Fulfilment, customer replies
- planning: ONLY Day 1, max 1 task
- analytics: Checking metrics, reviewing numbers
- follow_ups: Replying, chasing, networking
- product_dev: Building, fixing, shipping
- scheduling: Queuing posts, booking slots
- maintenance: Fixing, updating, cleaning up

DAY STRUCTURE:
- Day 1: 1 quick setup/planning task (max 15min), then execution tasks
- Day 2 onwards: 100% execution — no planning, no research
- Each day: 2–4 tasks across different categories, totalling <= ${commitmentMinutes} min
- Avoid the same category dominating two days in a row

Output valid JSON only — an array of objects. Each object:
- dayNumber: number (1 to ${totalDays})
- taskDescription: string — short action title with duration, e.g. "Record 3 TikTok hooks (20min)"
- duration: string — "15min", "20min", "30min", "45min", "1hr"
- howToComplete: string — numbered steps, beginner-friendly, very specific. Use \\n between steps. End with "Where: [platform/tool]\\nWhat: [the output/result]"
- taskType: "app_action" or "external"
- For app_action: appLink (one of the three above), appLabel
- category: one of the 10 values above (required on every task)

GOOD example (execution-focused):
{"dayNumber":2,"taskDescription":"Record your first TikTok hook (20min)","duration":"20min","taskType":"external","category":"content_creation","howToComplete":"1. Open TikTok camera\\n2. Film 3 takes of your hook (first 3 seconds of the video)\\n3. Pick the best take and save it\\nWhere: TikTok app\\nWhat: Saved hook clip ready to edit"}

BAD example (do NOT generate):
{"dayNumber":2,"taskDescription":"Research TikTok content strategies (30min)","duration":"30min","taskType":"external","category":"planning","howToComplete":"1. Search online for strategies\\n2. Take notes\\nWhere: Google\\nWhat: Strategy notes"}

No markdown, no code fence. Return only the JSON array.`;

  const daysSpec =
    daysToGenerate && daysToGenerate.length > 0
      ? `Generate tasks for Day(s) ${daysToGenerate.join(", ")} only. Total goal is ${totalDays} days.`
      : `Generate daily tasks for ${totalDays} days.`;

  const userPrompt = `Goal: ${title}${description ? `\nDescription: ${description}` : ""}

${daysSpec} ${commitmentMinutes} minutes per day available.

Generate execution-first tasks. Every task after Day 1 must be something the user physically does and can prove — posting, recording, sending, building, fixing, applying. No research tasks, no planning tasks, no "define your audience" tasks after Day 1.

Use the goal title to infer the goal type (content, coding, study, job search, business) and generate tasks in the right style for that type. Be specific — "Record 3 hook variations for TikTok" is good, "Create TikTok content" is too vague.

Assign a category to every task. Keep total time per day <= ${commitmentMinutes} min. Return only the JSON array.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // gpt-4o-mini: task generation/formatting, low complexity
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: daysToGenerate && daysToGenerate.length === 1 ? 1500 : 6000,
    }),
  });

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    const errMsg = data?.error?.message ?? "OpenAI request failed";
    throw new Error(errMsg);
  }

  const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI did not return a valid task array");
  }

  let tasks: GeneratedTask[];
  try {
    tasks = JSON.parse(jsonMatch[0]) as GeneratedTask[];
  } catch {
    throw new Error("Failed to parse AI task list");
  }

  if (!Array.isArray(tasks)) {
    throw new Error("Tasks must be an array");
  }

  function normalizeDuration(d: unknown): string {
    if (typeof d === "number" && d > 0) {
      if (d >= 60) return d % 60 === 0 ? `${d / 60}hr` : `${Math.floor(d / 60)}hr ${d % 60}min`;
      return `${d}min`;
    }
    if (typeof d === "string" && d) return d.trim().slice(0, 20);
    return "30min";
  }

  const normalized = tasks
    .filter((t) => {
      if (!t || typeof t.dayNumber !== "number") return false;
      const desc = t.taskDescription ?? (t as { task?: string }).task;
      return typeof desc === "string" && desc.trim().length > 0;
    })
    .map((t) => {
      const raw = t as Record<string, unknown>;
      const taskDescription = String(raw.taskDescription ?? raw.task ?? "").trim().slice(0, 600);
      let howToComplete = String(raw.howToComplete ?? raw.how_to_complete ?? "").trim();
      const where = typeof raw.where === "string" ? raw.where.trim() : "";
      const what = typeof raw.what === "string" ? raw.what.trim() : "";
      if (where || what) {
        const extra = [where && `Where: ${where}`, what && `What: ${what}`].filter(Boolean).join("\n");
        if (extra && !howToComplete.includes("Where:") && !howToComplete.includes("What:")) {
          howToComplete = howToComplete ? `${howToComplete}\n${extra}` : extra;
        }
      }
      return {
        dayNumber: Math.min(totalDays, Math.max(1, Math.floor(t.dayNumber))),
        taskDescription,
        duration: normalizeDuration(t.duration),
        howToComplete: howToComplete.slice(0, 800),
        taskType: t.taskType === "app_action" ? ("app_action" as const) : ("external" as const),
        appLink: typeof t.appLink === "string" && t.appLink ? t.appLink.trim().slice(0, 500) : undefined,
        appLabel: typeof t.appLabel === "string" && t.appLabel ? t.appLabel.trim().slice(0, 100) : undefined,
        category:
          typeof raw.category === "string" && (TASK_CATEGORIES as readonly string[]).includes(raw.category.trim())
            ? raw.category.trim()
            : undefined,
      };
    });

  if (normalized.length === 0) {
    throw new Error("AI returned no valid tasks");
  }

  const filtered =
    daysToGenerate && daysToGenerate.length > 0
      ? normalized.filter((t) => daysToGenerate.includes(t.dayNumber))
      : normalized;

  return filtered;
}
