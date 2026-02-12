export type GoalTemplate = {
  id: string;
  label: string;
  goalTitle: string;
  description: string;
  totalDays: number;
  dailyTimeCommitment: string;
};

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "digital-product",
    label: "Launch First Digital Product (30 days)",
    goalTitle: "Launch First Digital Product",
    description: "Create and launch your first digital product (ebook, checklist, or template) and get it ready to sell.",
    totalDays: 30,
    dailyTimeCommitment: "1hr",
  },
  {
    id: "tiktok-audience",
    label: "Build TikTok Audience (60 days)",
    goalTitle: "Build TikTok Audience",
    description: "Grow an engaged TikTok audience and learn to create content that converts, including TikTok Shop readiness.",
    totalDays: 60,
    dailyTimeCommitment: "1hr",
  },
  {
    id: "first-revenue",
    label: "First $1K Revenue (90 days)",
    goalTitle: "First $1K Revenue",
    description: "From zero to your first $1K in revenue: product creation, marketing, and sales in one 90-day plan.",
    totalDays: 90,
    dailyTimeCommitment: "2hr",
  },
];
