import type { TaskCategory } from "@/db/schema/goals-schema";

export const TASK_CATEGORIES: TaskCategory[] = [
  "admin",
  "marketing",
  "content_creation",
  "operations",
  "planning",
  "analytics",
  "follow_ups",
  "product_dev",
  "scheduling",
  "maintenance",
];

export const CATEGORY_CONFIG: Record<
  TaskCategory,
  { label: string; shortLabel: string; emoji: string; badgeClass: string }
> = {
  admin: {
    label: "Admin",
    shortLabel: "Admin",
    emoji: "📋",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  marketing: {
    label: "Marketing",
    shortLabel: "Marketing",
    emoji: "📈",
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  },
  content_creation: {
    label: "Content Creation",
    shortLabel: "Content",
    emoji: "📱",
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  },
  operations: {
    label: "Operations",
    shortLabel: "Operations",
    emoji: "⚙️",
    badgeClass: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  },
  planning: {
    label: "Planning",
    shortLabel: "Planning",
    emoji: "🎯",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  analytics: {
    label: "Analytics",
    shortLabel: "Analytics",
    emoji: "📊",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  follow_ups: {
    label: "Follow-ups",
    shortLabel: "Follow-ups",
    emoji: "💬",
    badgeClass: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  },
  product_dev: {
    label: "Product Dev",
    shortLabel: "Product Dev",
    emoji: "🛍️",
    badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  },
  scheduling: {
    label: "Scheduling",
    shortLabel: "Scheduling",
    emoji: "📅",
    badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  maintenance: {
    label: "Maintenance",
    shortLabel: "Maintenance",
    emoji: "🔧",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
};

export function getCategoryConfig(
  category: TaskCategory | null | undefined
): { label: string; shortLabel: string; emoji: string; badgeClass: string } | null {
  if (!category || !(category in CATEGORY_CONFIG)) return null;
  return CATEGORY_CONFIG[category as TaskCategory];
}

export function formatCategoryDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hrs}hr ${mins}min` : `${hrs}hr`;
}
