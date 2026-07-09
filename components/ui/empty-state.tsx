/**
 * EmptyState — reusable empty content placeholder
 * ──────────────────────────────────────────────────────────────────────────────
 * Three sizes: "sm" (inline), "md" (panel), "lg" (full-page).
 *
 * Usage:
 *   <EmptyState
 *     icon={FolderOpen}
 *     title="No projects yet"
 *     description="Launch your first AI project to get started."
 *     action={{ label: "Launch with AI", href: "/dashboard/launch" }}
 *   />
 */

import Link from "next/link";
import { LucideIcon } from "lucide-react";

type Action = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type Props = {
  icon?: LucideIcon;
  /** Emoji or text used if no icon */
  emoji?: string;
  title: string;
  description?: string;
  action?: Action;
  secondaryAction?: Action;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: {
    wrap:    "py-6 px-4",
    icon:    "h-8 w-8",
    iconBox: "h-12 w-12 rounded-xl mb-3",
    emoji:   "text-2xl mb-3",
    title:   "text-sm font-semibold",
    desc:    "text-xs mt-1",
    btn:     "mt-3 text-xs px-3 py-1.5",
  },
  md: {
    wrap:    "py-10 px-6",
    icon:    "h-6 w-6",
    iconBox: "h-12 w-12 rounded-xl mb-4",
    emoji:   "text-3xl mb-4",
    title:   "text-base font-semibold",
    desc:    "text-sm mt-1.5",
    btn:     "mt-4 text-sm px-4 py-2",
  },
  lg: {
    wrap:    "py-16 px-8",
    icon:    "h-7 w-7",
    iconBox: "h-16 w-16 rounded-2xl mb-5",
    emoji:   "text-4xl mb-5",
    title:   "text-lg font-bold",
    desc:    "text-sm mt-2 max-w-sm",
    btn:     "mt-5 text-sm px-5 py-2.5",
  },
} as const;

export function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className = "",
}: Props) {
  const s = SIZE[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.wrap} ${className}`}>
      {/* Icon or emoji */}
      {Icon && (
        <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 ${s.iconBox}`}>
          <Icon className={s.icon} />
        </div>
      )}
      {!Icon && emoji && (
        <div className={s.emoji}>{emoji}</div>
      )}

      {/* Text */}
      <p className={`text-gray-900 dark:text-white ${s.title}`}>{title}</p>
      {description && (
        <p className={`text-gray-500 dark:text-gray-400 leading-relaxed ${s.desc}`}>
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 flex-wrap justify-center" style={{ marginTop: size === "sm" ? "0.75rem" : size === "md" ? "1rem" : "1.25rem" }}>
          {action && (
            <ActionBtn {...action} primary size={size} />
          )}
          {secondaryAction && (
            <ActionBtn {...secondaryAction} primary={false} size={size} />
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  label,
  href,
  onClick,
  primary,
  size,
}: Action & { primary: boolean; size: "sm" | "md" | "lg" }) {
  const s = SIZE[size];
  const baseClass = `inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${s.btn}`;
  const cls = primary
    ? `${baseClass} bg-orange-500 hover:bg-orange-600 text-white shadow-sm`
    : `${baseClass} border border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800`;

  if (href) {
    return <Link href={href} className={cls}>{label}</Link>;
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {label}
    </button>
  );
}
