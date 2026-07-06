"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Circle,
  AlertTriangle,
  Sparkles,
  Target,
  DollarSign,
  Video,
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachStructuredResponse } from "@/hooks/useChatCoach";

interface CoachResponseRendererProps {
  response: CoachStructuredResponse;
  onSendMessage?: (msg: string) => void;
}

// ─── Opportunity score pill ───────────────────────────────────────────────────
function OpportunityScore({ score }: { score: number }) {
  const isStrong = score >= 8;
  const isGood = score >= 6 && score < 8;
  const colorText = isStrong
    ? "text-green-600 dark:text-green-400"
    : isGood
    ? "text-orange-500"
    : "text-red-500";
  const colorBg = isStrong
    ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20"
    : isGood
    ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20"
    : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20";
  const label = isStrong ? "Strong" : isGood ? "Good" : "Risky";
  const dotColor = isStrong
    ? "bg-green-500"
    : isGood
    ? "bg-orange-500"
    : "bg-red-500";

  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2 shrink-0", colorBg)}>
      <span className={cn("text-2xl font-bold tabular-nums leading-none", colorText)}>
        {score}/10
      </span>
      <div>
        <div className={cn("text-xs font-semibold leading-tight", colorText)}>{label}</div>
        <div className="flex gap-0.5 mt-1">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 w-2.5 rounded-full",
                i < score ? dotColor : "bg-gray-200 dark:bg-gray-700"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Metric badge (demand / competition / difficulty / profit) ────────────────
function MetricBadge({ label, value }: { label: string; value: string }) {
  const colorMap: Record<string, string> = {
    "Very High":
      "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
    High: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
    Medium:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
    Low: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
    Easy: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
    Hard: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  };
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
        {label}
      </span>
      <span
        className={cn(
          "rounded-lg px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
          colorMap[value] ?? "bg-slate-100 text-slate-600"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────
function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-orange-500">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

// ─── Difficulty chip ──────────────────────────────────────────────────────────
function DifficultyChip({ difficulty }: { difficulty: string }) {
  const cls =
    difficulty === "Easy"
      ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
      : difficulty === "Medium"
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400"
      : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
  return (
    <span className={cn("text-[10px] font-semibold rounded-md px-2 py-0.5", cls)}>
      {difficulty}
    </span>
  );
}

// ─── Action button mapping ────────────────────────────────────────────────────
function handleAction(action: string) {
  switch (action) {
    case "create-product":
      window.location.href = "/dashboard/products?create=true";
      break;
    case "generate-carousel":
      window.location.href = "/dashboard/design-studio";
      break;
    case "generate-video-guide":
      window.location.href = "/dashboard/ai-coach?mode=youtube";
      break;
    case "turn-into-note":
      window.location.href = "/dashboard/workspace?tab=notes";
      break;
    case "research-competitors":
      window.location.href = "/dashboard/workspace?tab=research";
      break;
    case "create-marketing-plan":
      window.location.href = "/dashboard/workspace";
      break;
    case "open-design-studio":
      window.location.href = "/dashboard/design-studio";
      break;
    default:
      break;
  }
}

// ─── Inline action button (inside action plan cards) ─────────────────────────
function InlineAction({ label }: { label: string }) {
  const actionKey = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
      onClick={() => handleAction(actionKey)}
    >
      <ArrowRight className="h-3 w-3 shrink-0" />
      {label}
    </button>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────
export function CoachResponseRenderer({
  response,
  onSendMessage,
}: CoachResponseRendererProps) {
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [generateAllLoading, setGenerateAllLoading] = useState(false);

  const toggleTask = (key: string) => {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const {
    summary,
    opportunity,
    whyThisWorks,
    actionPlan,
    contentOpportunities,
    pricingStrategy,
    commonMistakes,
    followUpQuestions,
    nextActions,
  } = response;

  return (
    <div className="space-y-3 w-full text-sm">
      {/* ── 1. Executive Summary ─────────────────────────────────────────── */}
      {summary && (
        <div className="rounded-xl border border-border bg-gradient-to-br from-orange-50/60 to-transparent dark:from-orange-500/5 p-4 space-y-3">
          <div className="flex items-start gap-4">
            <p className="text-foreground leading-relaxed flex-1">{summary.paragraph}</p>
            {!!summary.opportunityScore && (
              <OpportunityScore score={summary.opportunityScore} />
            )}
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-orange-500/10 px-3 py-2">
            <Sparkles className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-orange-700 dark:text-orange-300 text-sm font-medium leading-snug">
              {summary.overallRecommendation}
            </p>
          </div>
        </div>
      )}

      {/* ── 2. Opportunity Card ───────────────────────────────────────────── */}
      {opportunity && (
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="font-semibold text-sm">Opportunity Overview</span>
          </div>
          <div>
            <div className="font-semibold text-base text-foreground">
              {opportunity.productName}
            </div>
            <div className="text-muted-foreground text-sm leading-snug mt-0.5">
              {opportunity.targetAudience}
            </div>
            <div className="text-orange-600 dark:text-orange-400 font-semibold text-base mt-1.5">
              {opportunity.estimatedPrice}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
            <MetricBadge label="Demand" value={opportunity.demand} />
            <MetricBadge label="Competition" value={opportunity.competition} />
            <MetricBadge label="Difficulty" value={opportunity.difficulty} />
            <MetricBadge label="Profit" value={opportunity.profitPotential} />
          </div>
        </div>
      )}

      {/* ── 3. Why This Works (collapsible) ──────────────────────────────── */}
      {whyThisWorks && whyThisWorks.length > 0 && (
        <Section
          title="Why This Works"
          icon={<Zap className="h-4 w-4" />}
          defaultOpen={false}
        >
          <ul className="space-y-2">
            {whyThisWorks.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="text-green-500 shrink-0 mt-0.5 font-bold">✓</span>
                <span className="text-foreground/80 leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 4. Step-by-Step Action Plan ──────────────────────────────────── */}
      {actionPlan && actionPlan.length > 0 && (
        <Section
          title="Step-by-Step Action Plan"
          icon={<CheckCircle className="h-4 w-4" />}
          defaultOpen={true}
        >
          <div className="space-y-3">
            {actionPlan.map((week, wi) => (
              <div key={wi} className="rounded-lg bg-muted/50 border border-border/50 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold shrink-0">
                    {week.week}
                  </span>
                  <span className="font-semibold text-sm text-foreground">
                    {week.title}
                  </span>
                </div>
                <ul className="space-y-2 pl-7">
                  {week.tasks.map((task, ti) => {
                    const key = `${wi}-${ti}`;
                    const done = checkedTasks.has(key);
                    return (
                      <li
                        key={ti}
                        className="flex items-start gap-2 cursor-pointer group"
                        onClick={() => toggleTask(key)}
                      >
                        {done ? (
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-orange-400 transition-colors" />
                        )}
                        <span
                          className={cn(
                            "text-sm leading-snug",
                            done
                              ? "line-through text-muted-foreground"
                              : "text-foreground/80"
                          )}
                        >
                          {task}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {week.actions && week.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-7 pt-0.5">
                    {week.actions.map((action, ai) => (
                      <InlineAction key={ai} label={action} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 5. Content Opportunities ─────────────────────────────────────── */}
      {contentOpportunities && contentOpportunities.length > 0 && (
        <Section
          title="Content Opportunities"
          icon={<Video className="h-4 w-4" />}
          defaultOpen={false}
        >
          <div className="grid gap-2">
            {contentOpportunities.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                    {item.platform} · {item.contentType}
                  </span>
                  <DifficultyChip difficulty={item.difficulty} />
                </div>
                <p className="text-sm text-foreground/80 italic leading-snug">
                  &ldquo;{item.hook}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 6. Pricing Strategy ──────────────────────────────────────────── */}
      {pricingStrategy && (
        <Section
          title="Pricing Strategy"
          icon={<DollarSign className="h-4 w-4" />}
          defaultOpen={false}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold text-foreground">
                {pricingStrategy.recommended}
              </span>
              <span className="text-xs rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2.5 py-1 font-semibold">
                Recommended
              </span>
              {pricingStrategy.expectedConversion && (
                <span className="text-xs text-muted-foreground">
                  {pricingStrategy.expectedConversion} conversion
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {pricingStrategy.reasoning}
            </p>
            {pricingStrategy.alternatives && pricingStrategy.alternatives.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Alternatives
                </div>
                <div className="flex flex-wrap gap-2">
                  {pricingStrategy.alternatives.map((alt, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-muted px-2.5 py-1 text-xs text-foreground/70"
                    >
                      {alt}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── 7. Common Mistakes ───────────────────────────────────────────── */}
      {commonMistakes && commonMistakes.length > 0 && (
        <Section
          title="Common Mistakes to Avoid"
          icon={<AlertTriangle className="h-4 w-4" />}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {commonMistakes.map((mistake, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2.5"
              >
                <span className="text-amber-500 shrink-0 text-sm">⚠</span>
                <span className="text-sm text-amber-800 dark:text-amber-300 leading-snug">
                  {mistake}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 8. Next Actions ──────────────────────────────────────────────── */}
      {nextActions && nextActions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Next Actions
          </div>
          <div className="flex flex-wrap gap-2">
            {nextActions.map((na, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAction(na.action)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
                  na.primary
                    ? "bg-orange-500 text-white hover:bg-orange-600 shadow-sm"
                    : "border border-border bg-card text-foreground hover:bg-muted hover:border-orange-300 dark:hover:border-orange-500/30"
                )}
              >
                {na.label}
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 9. AI Follow-up Questions ────────────────────────────────────── */}
      {followUpQuestions && followUpQuestions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Ask a follow-up
          </div>
          <div className="flex flex-wrap gap-2">
            {followUpQuestions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSendMessage?.(q)}
                className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground/70 hover:border-orange-300 hover:text-orange-600 dark:hover:border-orange-500/30 dark:hover:text-orange-400 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 10. Generate All ─────────────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-dashed border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-foreground">
              Generate Everything
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
              Create product → Design assets → Video guide → Marketing plan
            </div>
          </div>
          <button
            type="button"
            disabled={generateAllLoading}
            onClick={() => {
              setGenerateAllLoading(true);
              setTimeout(() => {
                window.location.href = "/dashboard/products?create=true&auto=true";
              }, 400);
            }}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors shadow-sm shrink-0 disabled:opacity-70"
          >
            {generateAllLoading ? (
              <span className="inline-flex gap-0.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
              </span>
            ) : (
              <>
                <Sparkles className="h-4 w-4 shrink-0" />
                Generate All
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
