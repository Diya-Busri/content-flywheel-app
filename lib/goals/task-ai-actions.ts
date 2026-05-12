export interface TaskContext {
  taskDescription: string;
  goalTitle: string;
  category?: string | null;
  currentDay: number;
  totalDays: number;
  completedCount: number;
  totalCount: number;
}

export interface AIAction {
  label: string;
  emoji: string;
  prompt: (ctx: TaskContext) => string;
}

function header(ctx: TaskContext) {
  return `Task: "${ctx.taskDescription}"
Goal: "${ctx.goalTitle}" (Day ${ctx.currentDay} of ${ctx.totalDays} · ${ctx.completedCount}/${ctx.totalCount} tasks done today)`;
}

const ACTIONS_BY_CATEGORY: Record<string, AIAction[]> = {
  content_creation: [
    {
      label: "Write hook",
      emoji: "🎣",
      prompt: (ctx) =>
        `${header(ctx)}\n\nGenerate 5 powerful, scroll-stopping hooks for this content task. Make each one specific and different in style (curiosity, controversy, relatable, bold claim, story-opener).`,
    },
    {
      label: "Write script",
      emoji: "📝",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWrite a complete short-form video script (60–90 seconds) for this task. Include: hook, value delivery, and a strong CTA. Format it clearly with labels.`,
    },
    {
      label: "Write caption",
      emoji: "✍️",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWrite 3 caption options for this content. Each one should have a hook, core message, and call to action. Optimised for comments and saves.`,
    },
    {
      label: "Hashtags",
      emoji: "#️⃣",
      prompt: (ctx) =>
        `${header(ctx)}\n\nGenerate the ideal hashtag set for this content. Mix niche, mid-tier, and broad tags. Give me 15–20 hashtags with a 1-line explanation for why each is included.`,
    },
    {
      label: "CTA ideas",
      emoji: "🎯",
      prompt: (ctx) =>
        `${header(ctx)}\n\nGive me 5 high-converting CTA options for this piece of content. Make them feel natural, not salesy. Vary the format: comment, follow, share, save, click.`,
    },
    {
      label: "Video concept",
      emoji: "💡",
      prompt: (ctx) =>
        `${header(ctx)}\n\nGenerate 3 specific video concepts to complete this content task. For each: give the angle, format (talking head/voiceover/trend), hook idea, and why it would perform well.`,
    },
  ],

  marketing: [
    {
      label: "Campaign angle",
      emoji: "📣",
      prompt: (ctx) =>
        `${header(ctx)}\n\nSuggest 3 specific marketing angles for this task. Each should be distinct — think emotional, logical, and social proof angles.`,
    },
    {
      label: "Write ad copy",
      emoji: "✏️",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWrite direct-response ad copy for this marketing task. Include a headline, 2–3 body variations, and a CTA. Make it punchy and conversion-focused.`,
    },
    {
      label: "Target audience",
      emoji: "🎯",
      prompt: (ctx) =>
        `${header(ctx)}\n\nDefine the ideal target audience for this marketing task. Cover: demographics, psychographics, top 3 pain points, and desires. Be specific, not generic.`,
    },
    {
      label: "Email draft",
      emoji: "📧",
      prompt: (ctx) =>
        `${header(ctx)}\n\nDraft a compelling email to support this marketing task. Include: subject line (3 options), opening hook, body, and CTA.`,
    },
    {
      label: "Unique angle",
      emoji: "🔍",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHow should I differentiate this from what competitors are doing? Give me a unique positioning angle that stands out.`,
    },
  ],

  planning: [
    {
      label: "Break it down",
      emoji: "🪜",
      prompt: (ctx) =>
        `${header(ctx)}\n\nBreak this task into 5–7 micro-steps I can do right now. Be extremely specific — each step should be a concrete action, not vague advice.`,
    },
    {
      label: "Beat procrastination",
      emoji: "⚡",
      prompt: (ctx) =>
        `${header(ctx)}\n\nI'm procrastinating on this. Give me the single smallest possible first action I can take in the next 2 minutes. Then explain exactly why completing this task matters for my goal.`,
    },
    {
      label: "Remove blockers",
      emoji: "🧱",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWhat are the 3 most common blockers that prevent people from completing this task? For each blocker, give me an immediate fix.`,
    },
    {
      label: "Quick win",
      emoji: "🏆",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWhat's the single highest-impact action I can take RIGHT NOW to make meaningful progress on this task? I have limited time — prioritise ruthlessly.`,
    },
    {
      label: "Time-block it",
      emoji: "⏱️",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHelp me time-block this task. How long will it actually take? What should a focused session look like? When is the best time to do it?`,
    },
  ],

  admin: [
    {
      label: "Draft message",
      emoji: "💬",
      prompt: (ctx) =>
        `${header(ctx)}\n\nDraft a professional, concise message or email needed to complete this admin task. Make it clear and to the point. Include subject line if it's an email.`,
    },
    {
      label: "Checklist",
      emoji: "✅",
      prompt: (ctx) =>
        `${header(ctx)}\n\nCreate a complete, ordered checklist to finish this admin task without missing anything important.`,
    },
    {
      label: "Build a template",
      emoji: "📋",
      prompt: (ctx) =>
        `${header(ctx)}\n\nCreate a reusable template I can use to complete this type of task faster every time. Make it simple and fill-in-the-blank ready.`,
    },
    {
      label: "Simplify it",
      emoji: "⚡",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHow do I complete this admin task in the fewest steps possible? What can I cut, automate, or skip without compromising the result?`,
    },
  ],

  product_dev: [
    {
      label: "Write a spec",
      emoji: "📐",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHelp me write a clear, concise spec for this product task. What does "done" look like? Include requirements, success criteria, and scope boundaries.`,
    },
    {
      label: "User story",
      emoji: "👤",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWrite a user story for this task in the format: "As a [user], I want [goal] so that [reason]." Include acceptance criteria.`,
    },
    {
      label: "MVP scope",
      emoji: "🎯",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWhat's the absolute minimum I need to build or do to complete this task? Help me avoid over-engineering. What can wait for v2?`,
    },
    {
      label: "Launch checklist",
      emoji: "🚀",
      prompt: (ctx) =>
        `${header(ctx)}\n\nCreate a launch checklist for this product task. What must be true before I can call it done and ship?`,
    },
  ],

  analytics: [
    {
      label: "Key metrics",
      emoji: "📊",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWhat are the 3–5 most important metrics to track for this analytics task? Explain what each tells me and what a good vs bad result looks like.`,
    },
    {
      label: "Read the data",
      emoji: "🔎",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHelp me interpret what the data is telling me for this task. What patterns should I look for? What actions should the data drive?`,
    },
    {
      label: "Report template",
      emoji: "📈",
      prompt: (ctx) =>
        `${header(ctx)}\n\nCreate a simple, clean report template to communicate results from this analytics task to stakeholders.`,
    },
    {
      label: "Improve numbers",
      emoji: "⬆️",
      prompt: (ctx) =>
        `${header(ctx)}\n\nGive me 5 specific, actionable things I can do to improve the metrics I'm tracking in this task. Prioritise by impact.`,
    },
  ],

  follow_ups: [
    {
      label: "Follow-up message",
      emoji: "💌",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWrite a natural, non-pushy follow-up message for this task. Make it feel warm and human, not like a template.`,
    },
    {
      label: "Handle objections",
      emoji: "🗣️",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWhat are the top 3 objections someone might give when I follow up? For each, write a calm, confident response.`,
    },
    {
      label: "Build rapport",
      emoji: "🤝",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHow do I approach this follow-up in a way that builds trust first? Give me a rapport-building opening before I make any ask.`,
    },
  ],

  operations: [
    {
      label: "Write an SOP",
      emoji: "📖",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWrite a simple SOP (Standard Operating Procedure) for this operational task so anyone on my team could do it without asking questions.`,
    },
    {
      label: "Automate it",
      emoji: "⚙️",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHow could I automate or systematise this task so I never have to do it manually again? What tools should I use?`,
    },
    {
      label: "Delegate it",
      emoji: "👥",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHow would I delegate this task? Write a clear brief I could hand off to a team member or freelancer today.`,
    },
  ],

  scheduling: [
    {
      label: "Time-block it",
      emoji: "🗓️",
      prompt: (ctx) =>
        `${header(ctx)}\n\nHelp me slot this task into my schedule. What's the best time of day and day of the week for this type of work? How long should I block?`,
    },
    {
      label: "Batch with others",
      emoji: "📦",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWhat similar tasks could I batch with this one to save time and stay in flow? Give me a batching strategy.`,
    },
  ],

  maintenance: [
    {
      label: "Fix it fast",
      emoji: "🔧",
      prompt: (ctx) =>
        `${header(ctx)}\n\nWhat's the fastest way to complete this maintenance task without cutting corners? Give me a step-by-step.`,
    },
    {
      label: "Prevent recurrence",
      emoji: "🛡️",
      prompt: (ctx) =>
        `${header(ctx)}\n\nAfter I complete this task, how do I make sure this problem doesn't come back? Give me a prevention checklist.`,
    },
  ],
};

export const UNIVERSAL_ACTIONS: AIAction[] = [
  {
    label: "How do I do this?",
    emoji: "🪜",
    prompt: (ctx) =>
      `${header(ctx)}\n\nI'm not sure where to start. Give me a clear, beginner-friendly step-by-step guide to complete this task right now. Be specific — no vague advice.`,
  },
  {
    label: "I'm stuck",
    emoji: "⚡",
    prompt: (ctx) =>
      `${header(ctx)}\n\nI keep putting this off. Help me start RIGHT NOW. What's the absolute smallest first action I can take? And tell me clearly why this task matters for reaching my goal.`,
  },
  {
    label: "Ask AI Coach",
    emoji: "🤖",
    prompt: (ctx) =>
      `${header(ctx)}\n\nI need targeted coaching on this task. First, ask me one question to understand exactly where I'm stuck. Then give me specific guidance based on my answer.`,
  },
];

export function getTaskActions(category?: string | null): AIAction[] {
  const categoryActions = category ? (ACTIONS_BY_CATEGORY[category] ?? []) : [];
  return [...categoryActions, ...UNIVERSAL_ACTIONS];
}
