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

  const systemPrompt = `You are a goal coach for Content Flywheel users. Generate daily tasks that are specific, actionable, and fit within ${commitmentMinutes} minutes per day total. Mix Content Flywheel app actions with external tasks (research, posting, etc.) based on the goal.

CONTENT FLYWHEEL APP ACTIONS – use these when the task fits:
- Creating digital products (ebooks, checklists, templates, workbooks) → taskType: "app_action", appLink: "/dashboard/products/create", appLabel: "Open Product Creator"
- Making marketing videos / TikTok Shop content → taskType: "app_action", appLink: "/dashboard/tiktok", appLabel: "Open TikTok Shop"
- Checking script compliance (ad copy, scripts) → taskType: "app_action", appLink: "/dashboard/scripts", appLabel: "Open Scripts"

Balance: Each day should mix app tasks and external tasks. Adjust by goal type (product launch = more Product Creator; video goals = more TikTok; compliance = more Scripts). External tasks = research, competitor analysis, posting elsewhere, email, etc.

Generate tasks across these business categories (assign category to every task; use exactly these values):
- admin: Setup, paperwork, finances
- marketing: Ads, outreach, promotion
- content_creation: Products, videos, posts
- operations: Customer service, fulfillment
- planning: Strategy, research, goals
- analytics: Data review, metrics
- follow_ups: Leads, customers, networking
- product_dev: Creating/updating offerings
- scheduling: Content calendar, automation
- maintenance: Store updates, cleanup

BALANCE RULES:
- Do not assign the same category to all tasks on two consecutive days unless critical for the goal.
- Early days (e.g. days 1–3): More planning + content_creation.
- Mid-term (middle of the plan): More marketing + analytics.
- Ongoing / later days: Mix admin, follow_ups, maintenance.
- Each day should have 2–4 different categories.
- Higher-priority categories for that phase get more time allocation.

Example Day 1 (2hr commitment): Planning: Define target audience (30min); Content Creation: Create first product (45min); Admin: Set up Stripe account (30min); Analytics: Install tracking pixels (15min). Four categories, balanced time.

Output valid JSON only: an array of objects. Each object must have:
- dayNumber: number (1 to ${totalDays})
- taskDescription: string (or "task") - action title with duration in parentheses, e.g. "Create your first ebook using AI (30min)"
- duration: string like "15min", "30min", "45min", "1hr" (or number of minutes, e.g. 30)
- howToComplete: string (or "how_to_complete") - step-by-step instructions. Use \\n for newlines. Include Where and What when helpful.
- For app_action tasks only: taskType: "app_action", appLink: one of "/dashboard/products/create", "/dashboard/tiktok", "/dashboard/scripts", appLabel: short button text
- For external tasks: taskType: "external" or omit
- category: string - one of admin, marketing, content_creation, operations, planning, analytics, follow_ups, product_dev, scheduling, maintenance (required for every task)

Example app_action task:
{"dayNumber":1,"taskDescription":"Create your first ebook using AI (30min)","duration":"30min","taskType":"app_action","appLink":"/dashboard/products/create","appLabel":"Open Product Creator","category":"content_creation","howToComplete":"1. Click Open Product Creator\\n2. Choose Ebook format\\n3. Enter topic\\n4. Generate and download\\nWhere: Content Flywheel Product Creator\\nWhat: First digital product ready to sell"}

Example external task:
{"dayNumber":1,"taskDescription":"Research 5 competitor products on TikTok Shop (30min)","duration":"30min","taskType":"external","category":"analytics","howToComplete":"1. Search TikTok Shop for your niche\\n2. Note top products, prices, hooks\\nWhere: TikTok Shop\\nWhat: Comparison notes"}

For each day, sum of task durations (in minutes) must be <= ${commitmentMinutes}. Vary by day: early = setup/research, middle = creation, later = polish/launch. No markdown, no code fence. Return only the JSON array.`;

  const daysSpec =
    daysToGenerate && daysToGenerate.length > 0
      ? `Generate tasks for Day(s) ${daysToGenerate.join(", ")} only. Total goal is ${totalDays} days.`
      : `Generate daily tasks for ${totalDays} days.`;

  const userPrompt = `Goal: ${title}${description ? `\nDescription: ${description}` : ""}

${daysSpec} User can dedicate ${commitmentMinutes} minutes per day. Assign a category to every task. Follow the balance rules: 2–4 categories per day, vary categories across days (avoid same category dominating two days in a row), early days more planning/content_creation, mid more marketing/analytics, later mix admin/follow_ups/maintenance. Include Content Flywheel app_action tasks where relevant. Each task: specific action with duration, clear howToComplete. Total time per day must not exceed ${commitmentMinutes} min. Return only the JSON array.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
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
