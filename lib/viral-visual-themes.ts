/**
 * Visual variety for viral Quiz / Would You Rather — shared by preview (React) and MP4 export (Puppeteer HTML).
 * A random theme is picked on each generate; stored on payload as `visualTheme`.
 */

export type ViralVisualThemeId =
  | "sunset"
  | "ocean"
  | "forest"
  | "neon"
  | "royal"
  | "ember"
  | "ice"
  | "candy";

export type ViralVisualThemeTokens = {
  id: ViralVisualThemeId;
  /** Short label for UI */
  label: string;
  wyrBg: string;
  /** Portrait WYR ambient glow (two radials) */
  wyrGlow: string;
  /** 16:9 WYR slightly stronger glow */
  wyrGlowStrong: string;
  wyrPanelA: string;
  wyrPanelB: string;
  wyrShadowA: string;
  wyrShadowB: string;
  wyrOrColor: string;

  quizBg: string;
  quizTopBar: string;
  quizBadgeBg: string;
  quizBadgeColor: string;
  quizBadgeBorder: string;
  optColors: readonly [string, string, string, string];

  correctBg: string;
  correctBorder: string;
  correctText: string;
  /** Slightly stronger correct row bg (portrait quiz) */
  correctBgStrong: string;

  introGlow: string;
  outroGlow: string;
  introBadgeBg: string;
  introBadgeColor: string;
  introBadgeBorder: string;
  outroBadgeBg: string;
  outroBadgeColor: string;
  outroBadgeBorder: string;
  ctaBadgeBg: string;
  ctaBadgeColor: string;
  ctaBadgeBorder: string;
};

const THEMES: Record<ViralVisualThemeId, ViralVisualThemeTokens> = {
  sunset: {
    id: "sunset",
    label: "Sunset",
    wyrBg: "#0A0A0F",
    wyrGlow:
      "radial-gradient(ellipse at 20% 50%, rgba(255,65,108,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(71,118,230,0.08) 0%, transparent 60%)",
    wyrGlowStrong:
      "radial-gradient(ellipse at 20% 50%, rgba(255,65,108,0.1) 0%, transparent 55%), radial-gradient(ellipse at 80% 50%, rgba(71,118,230,0.1) 0%, transparent 55%)",
    wyrPanelA: "linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)",
    wyrPanelB: "linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)",
    wyrShadowA: "0 8px 32px rgba(255,65,108,0.35)",
    wyrShadowB: "0 8px 32px rgba(71,118,230,0.35)",
    wyrOrColor: "#0A0A0F",
    quizBg: "#080B14",
    quizTopBar: "linear-gradient(90deg,#FF6B35,#FF416C)",
    quizBadgeBg: "rgba(255,107,53,0.15)",
    quizBadgeColor: "#FF6B35",
    quizBadgeBorder: "rgba(255,107,53,0.3)",
    optColors: ["#FF6B35", "#4776E6", "#00C49A", "#FF416C"],
    correctBg: "rgba(0,196,154,0.15)",
    correctBgStrong: "rgba(0,196,154,0.18)",
    correctBorder: "#00C49A",
    correctText: "#00C49A",
    introGlow:
      "radial-gradient(ellipse at 50% 20%, rgba(255,107,53,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(71,118,230,0.12) 0%, transparent 50%)",
    outroGlow:
      "radial-gradient(ellipse at 50% 80%, rgba(0,196,154,0.12) 0%, transparent 50%), radial-gradient(ellipse at 20% 20%, rgba(255,65,108,0.1) 0%, transparent 45%)",
    introBadgeBg: "rgba(255,107,53,0.2)",
    introBadgeColor: "#FF9A6B",
    introBadgeBorder: "rgba(255,107,53,0.45)",
    outroBadgeBg: "rgba(0,196,154,0.15)",
    outroBadgeColor: "#00C49A",
    outroBadgeBorder: "rgba(0,196,154,0.35)",
    ctaBadgeBg: "rgba(255,107,53,0.15)",
    ctaBadgeColor: "#FF6B35",
    ctaBadgeBorder: "rgba(255,107,53,0.35)",
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    wyrBg: "#061018",
    wyrGlow:
      "radial-gradient(ellipse at 25% 45%, rgba(0,212,255,0.12) 0%, transparent 58%), radial-gradient(ellipse at 78% 55%, rgba(0,119,190,0.14) 0%, transparent 55%)",
    wyrGlowStrong:
      "radial-gradient(ellipse at 25% 45%, rgba(0,212,255,0.16) 0%, transparent 55%), radial-gradient(ellipse at 78% 55%, rgba(0,119,190,0.18) 0%, transparent 52%)",
    wyrPanelA: "linear-gradient(145deg, #0093E9 0%, #00D4FF 100%)",
    wyrPanelB: "linear-gradient(145deg, #134E5E 0%, #71B280 100%)",
    wyrShadowA: "0 8px 36px rgba(0,147,233,0.4)",
    wyrShadowB: "0 8px 36px rgba(17,78,94,0.45)",
    wyrOrColor: "#061018",
    quizBg: "#051520",
    quizTopBar: "linear-gradient(90deg,#00B4DB,#0083B0)",
    quizBadgeBg: "rgba(0,212,255,0.14)",
    quizBadgeColor: "#5CE1FF",
    quizBadgeBorder: "rgba(0,212,255,0.35)",
    optColors: ["#00B4DB", "#0083B0", "#38EF7D", "#56CCF2"],
    correctBg: "rgba(56,239,125,0.14)",
    correctBgStrong: "rgba(56,239,125,0.2)",
    correctBorder: "#38EF7D",
    correctText: "#7CFFB2",
    introGlow:
      "radial-gradient(ellipse at 50% 18%, rgba(0,212,255,0.22) 0%, transparent 52%), radial-gradient(ellipse at 82% 82%, rgba(0,131,176,0.15) 0%, transparent 48%)",
    outroGlow:
      "radial-gradient(ellipse at 50% 85%, rgba(56,239,125,0.12) 0%, transparent 50%), radial-gradient(ellipse at 18% 18%, rgba(0,180,219,0.12) 0%, transparent 45%)",
    introBadgeBg: "rgba(0,212,255,0.18)",
    introBadgeColor: "#9AEFFF",
    introBadgeBorder: "rgba(0,212,255,0.42)",
    outroBadgeBg: "rgba(56,239,125,0.14)",
    outroBadgeColor: "#7CFFB2",
    outroBadgeBorder: "rgba(56,239,125,0.38)",
    ctaBadgeBg: "rgba(0,180,219,0.14)",
    ctaBadgeColor: "#5CE1FF",
    ctaBadgeBorder: "rgba(0,212,255,0.32)",
  },
  forest: {
    id: "forest",
    label: "Forest",
    wyrBg: "#07140C",
    wyrGlow:
      "radial-gradient(ellipse at 22% 48%, rgba(67,233,123,0.1) 0%, transparent 58%), radial-gradient(ellipse at 80% 52%, rgba(21,87,36,0.18) 0%, transparent 55%)",
    wyrGlowStrong:
      "radial-gradient(ellipse at 22% 48%, rgba(67,233,123,0.14) 0%, transparent 55%), radial-gradient(ellipse at 80% 52%, rgba(21,87,36,0.22) 0%, transparent 52%)",
    wyrPanelA: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    wyrPanelB: "linear-gradient(135deg, #155724 0%, #56ab2f 100%)",
    wyrShadowA: "0 8px 32px rgba(17,153,142,0.45)",
    wyrShadowB: "0 8px 32px rgba(21,87,36,0.5)",
    wyrOrColor: "#07140C",
    quizBg: "#061208",
    quizTopBar: "linear-gradient(90deg,#56ab2f,#11998e)",
    quizBadgeBg: "rgba(86,171,47,0.18)",
    quizBadgeColor: "#9AE56A",
    quizBadgeBorder: "rgba(86,171,47,0.4)",
    optColors: ["#56ab2f", "#11998e", "#C6FF7D", "#2d6a4f"],
    correctBg: "rgba(198,255,125,0.16)",
    correctBgStrong: "rgba(198,255,125,0.22)",
    correctBorder: "#C6FF7D",
    correctText: "#D4FF94",
    introGlow:
      "radial-gradient(ellipse at 50% 20%, rgba(86,171,47,0.2) 0%, transparent 54%), radial-gradient(ellipse at 85% 78%, rgba(17,153,142,0.14) 0%, transparent 48%)",
    outroGlow:
      "radial-gradient(ellipse at 52% 82%, rgba(198,255,125,0.1) 0%, transparent 50%), radial-gradient(ellipse at 20% 22%, rgba(56,171,47,0.12) 0%, transparent 45%)",
    introBadgeBg: "rgba(86,171,47,0.22)",
    introBadgeColor: "#C6FF7D",
    introBadgeBorder: "rgba(198,255,125,0.4)",
    outroBadgeBg: "rgba(17,153,142,0.16)",
    outroBadgeColor: "#5CDBB8",
    outroBadgeBorder: "rgba(17,153,142,0.38)",
    ctaBadgeBg: "rgba(86,171,47,0.16)",
    ctaBadgeColor: "#9AE56A",
    ctaBadgeBorder: "rgba(86,171,47,0.35)",
  },
  neon: {
    id: "neon",
    label: "Neon",
    wyrBg: "#050508",
    wyrGlow:
      "radial-gradient(ellipse at 20% 50%, rgba(255,0,255,0.12) 0%, transparent 55%), radial-gradient(ellipse at 82% 50%, rgba(0,255,255,0.1) 0%, transparent 55%)",
    wyrGlowStrong:
      "radial-gradient(ellipse at 20% 50%, rgba(255,0,255,0.18) 0%, transparent 52%), radial-gradient(ellipse at 82% 50%, rgba(0,255,255,0.16) 0%, transparent 52%)",
    wyrPanelA: "linear-gradient(135deg, #FF00FF 0%, #BD00FF 100%)",
    wyrPanelB: "linear-gradient(135deg, #00F5FF 0%, #0066FF 100%)",
    wyrShadowA: "0 8px 40px rgba(255,0,255,0.35)",
    wyrShadowB: "0 8px 40px rgba(0,245,255,0.35)",
    wyrOrColor: "#050508",
    quizBg: "#06060A",
    quizTopBar: "linear-gradient(90deg,#FF00FF,#00F5FF)",
    quizBadgeBg: "rgba(255,0,255,0.12)",
    quizBadgeColor: "#FF6BFF",
    quizBadgeBorder: "rgba(255,0,255,0.35)",
    optColors: ["#FF00FF", "#00F5FF", "#B026FF", "#00CCFF"],
    correctBg: "rgba(0,255,200,0.12)",
    correctBgStrong: "rgba(0,255,200,0.18)",
    correctBorder: "#00FFC8",
    correctText: "#7FFFD4",
    introGlow:
      "radial-gradient(ellipse at 48% 18%, rgba(255,0,255,0.2) 0%, transparent 50%), radial-gradient(ellipse at 80% 85%, rgba(0,245,255,0.14) 0%, transparent 48%)",
    outroGlow:
      "radial-gradient(ellipse at 50% 85%, rgba(0,255,200,0.1) 0%, transparent 50%), radial-gradient(ellipse at 22% 20%, rgba(255,0,255,0.1) 0%, transparent 45%)",
    introBadgeBg: "rgba(255,0,255,0.15)",
    introBadgeColor: "#FF9FFF",
    introBadgeBorder: "rgba(255,107,255,0.45)",
    outroBadgeBg: "rgba(0,245,255,0.12)",
    outroBadgeColor: "#7AFFFF",
    outroBadgeBorder: "rgba(0,245,255,0.38)",
    ctaBadgeBg: "rgba(189,0,255,0.12)",
    ctaBadgeColor: "#D27AFF",
    ctaBadgeBorder: "rgba(189,0,255,0.35)",
  },
  royal: {
    id: "royal",
    label: "Royal",
    wyrBg: "#0D0618",
    wyrGlow:
      "radial-gradient(ellipse at 24% 48%, rgba(186,85,211,0.14) 0%, transparent 56%), radial-gradient(ellipse at 78% 52%, rgba(255,215,0,0.1) 0%, transparent 54%)",
    wyrGlowStrong:
      "radial-gradient(ellipse at 24% 48%, rgba(186,85,211,0.2) 0%, transparent 52%), radial-gradient(ellipse at 78% 52%, rgba(255,215,0,0.14) 0%, transparent 50%)",
    wyrPanelA: "linear-gradient(135deg, #7B4397 0%, #DC2430 100%)",
    wyrPanelB: "linear-gradient(135deg, #4B2E83 0%, #F7971E 100%)",
    wyrShadowA: "0 8px 36px rgba(123,67,151,0.45)",
    wyrShadowB: "0 8px 36px rgba(75,46,131,0.45)",
    wyrOrColor: "#0D0618",
    quizBg: "#0A0612",
    quizTopBar: "linear-gradient(90deg,#F7971E,#7B4397)",
    quizBadgeBg: "rgba(247,151,30,0.15)",
    quizBadgeColor: "#FFC15C",
    quizBadgeBorder: "rgba(247,151,30,0.38)",
    optColors: ["#F7971E", "#7B4397", "#DC2430", "#C9A227"],
    correctBg: "rgba(201,162,39,0.16)",
    correctBgStrong: "rgba(201,162,39,0.22)",
    correctBorder: "#E8C547",
    correctText: "#F5E6A3",
    introGlow:
      "radial-gradient(ellipse at 50% 20%, rgba(247,151,30,0.18) 0%, transparent 52%), radial-gradient(ellipse at 82% 80%, rgba(123,67,151,0.16) 0%, transparent 48%)",
    outroGlow:
      "radial-gradient(ellipse at 50% 82%, rgba(201,162,39,0.12) 0%, transparent 50%), radial-gradient(ellipse at 18% 22%, rgba(220,36,48,0.1) 0%, transparent 45%)",
    introBadgeBg: "rgba(123,67,151,0.2)",
    introBadgeColor: "#D4A5FF",
    introBadgeBorder: "rgba(186,85,211,0.45)",
    outroBadgeBg: "rgba(201,162,39,0.14)",
    outroBadgeColor: "#F5E6A3",
    outroBadgeBorder: "rgba(201,162,39,0.38)",
    ctaBadgeBg: "rgba(247,151,30,0.14)",
    ctaBadgeColor: "#FFC15C",
    ctaBadgeBorder: "rgba(247,151,30,0.32)",
  },
  ember: {
    id: "ember",
    label: "Ember",
    wyrBg: "#120805",
    wyrGlow:
      "radial-gradient(ellipse at 22% 50%, rgba(255,94,0,0.14) 0%, transparent 56%), radial-gradient(ellipse at 80% 50%, rgba(255,45,45,0.12) 0%, transparent 55%)",
    wyrGlowStrong:
      "radial-gradient(ellipse at 22% 50%, rgba(255,94,0,0.2) 0%, transparent 52%), radial-gradient(ellipse at 80% 50%, rgba(255,45,45,0.18) 0%, transparent 52%)",
    wyrPanelA: "linear-gradient(135deg, #FF512F 0%, #F09819 100%)",
    wyrPanelB: "linear-gradient(135deg, #8E0E00 0%, #FF416C 100%)",
    wyrShadowA: "0 8px 36px rgba(255,81,47,0.45)",
    wyrShadowB: "0 8px 36px rgba(142,14,0,0.45)",
    wyrOrColor: "#120805",
    quizBg: "#100705",
    quizTopBar: "linear-gradient(90deg,#FF512F,#DD2476)",
    quizBadgeBg: "rgba(255,81,47,0.16)",
    quizBadgeColor: "#FF8A65",
    quizBadgeBorder: "rgba(255,81,47,0.38)",
    optColors: ["#FF512F", "#F09819", "#DD2476", "#FF6B6B"],
    correctBg: "rgba(255,193,7,0.14)",
    correctBgStrong: "rgba(255,193,7,0.2)",
    correctBorder: "#FFD54F",
    correctText: "#FFE082",
    introGlow:
      "radial-gradient(ellipse at 50% 20%, rgba(255,81,47,0.22) 0%, transparent 52%), radial-gradient(ellipse at 85% 78%, rgba(221,36,118,0.14) 0%, transparent 48%)",
    outroGlow:
      "radial-gradient(ellipse at 52% 82%, rgba(255,193,7,0.1) 0%, transparent 50%), radial-gradient(ellipse at 20% 22%, rgba(255,65,108,0.12) 0%, transparent 45%)",
    introBadgeBg: "rgba(255,81,47,0.2)",
    introBadgeColor: "#FFAB91",
    introBadgeBorder: "rgba(255,138,101,0.45)",
    outroBadgeBg: "rgba(255,193,7,0.14)",
    outroBadgeColor: "#FFE082",
    outroBadgeBorder: "rgba(255,193,7,0.35)",
    ctaBadgeBg: "rgba(221,36,118,0.14)",
    ctaBadgeColor: "#FF80AB",
    ctaBadgeBorder: "rgba(221,36,118,0.32)",
  },
  ice: {
    id: "ice",
    label: "Ice",
    wyrBg: "#070A12",
    wyrGlow:
      "radial-gradient(ellipse at 25% 48%, rgba(180,220,255,0.12) 0%, transparent 58%), radial-gradient(ellipse at 78% 52%, rgba(100,149,237,0.14) 0%, transparent 55%)",
    wyrGlowStrong:
      "radial-gradient(ellipse at 25% 48%, rgba(180,220,255,0.18) 0%, transparent 54%), radial-gradient(ellipse at 78% 52%, rgba(100,149,237,0.2) 0%, transparent 52%)",
    wyrPanelA: "linear-gradient(135deg, #74B9FF 0%, #A29BFE 100%)",
    wyrPanelB: "linear-gradient(135deg, #0984E3 0%, #6C5CE7 100%)",
    wyrShadowA: "0 8px 32px rgba(116,185,255,0.4)",
    wyrShadowB: "0 8px 32px rgba(9,132,227,0.4)",
    wyrOrColor: "#070A12",
    quizBg: "#060910",
    quizTopBar: "linear-gradient(90deg,#74B9FF,#6C5CE7)",
    quizBadgeBg: "rgba(116,185,255,0.14)",
    quizBadgeColor: "#A8D8FF",
    quizBadgeBorder: "rgba(116,185,255,0.35)",
    optColors: ["#74B9FF", "#6C5CE7", "#A29BFE", "#00CEC9"],
    correctBg: "rgba(0,206,201,0.12)",
    correctBgStrong: "rgba(0,206,201,0.18)",
    correctBorder: "#55EFC4",
    correctText: "#81ECEC",
    introGlow:
      "radial-gradient(ellipse at 50% 18%, rgba(180,220,255,0.2) 0%, transparent 52%), radial-gradient(ellipse at 82% 82%, rgba(108,92,231,0.14) 0%, transparent 48%)",
    outroGlow:
      "radial-gradient(ellipse at 50% 85%, rgba(0,206,201,0.1) 0%, transparent 50%), radial-gradient(ellipse at 20% 20%, rgba(116,185,255,0.12) 0%, transparent 45%)",
    introBadgeBg: "rgba(162,155,254,0.16)",
    introBadgeColor: "#DCD6FF",
    introBadgeBorder: "rgba(162,155,254,0.4)",
    outroBadgeBg: "rgba(0,206,201,0.12)",
    outroBadgeColor: "#81ECEC",
    outroBadgeBorder: "rgba(0,206,201,0.35)",
    ctaBadgeBg: "rgba(116,185,255,0.12)",
    ctaBadgeColor: "#A8D8FF",
    ctaBadgeBorder: "rgba(116,185,255,0.32)",
  },
  candy: {
    id: "candy",
    label: "Candy",
    wyrBg: "#100818",
    wyrGlow:
      "radial-gradient(ellipse at 22% 50%, rgba(255,105,180,0.12) 0%, transparent 56%), radial-gradient(ellipse at 80% 50%, rgba(186,104,200,0.12) 0%, transparent 55%)",
    wyrGlowStrong:
      "radial-gradient(ellipse at 22% 50%, rgba(255,105,180,0.18) 0%, transparent 52%), radial-gradient(ellipse at 80% 50%, rgba(186,104,200,0.18) 0%, transparent 52%)",
    wyrPanelA: "linear-gradient(135deg, #FF6B9D 0%, #C06C84 100%)",
    wyrPanelB: "linear-gradient(135deg, #A855F7 0%, #6366F1 100%)",
    wyrShadowA: "0 8px 36px rgba(255,107,157,0.4)",
    wyrShadowB: "0 8px 36px rgba(168,85,247,0.4)",
    wyrOrColor: "#100818",
    quizBg: "#0C0614",
    quizTopBar: "linear-gradient(90deg,#FF6B9D,#A855F7)",
    quizBadgeBg: "rgba(255,107,157,0.14)",
    quizBadgeColor: "#FFB3CC",
    quizBadgeBorder: "rgba(255,107,157,0.38)",
    optColors: ["#FF6B9D", "#A855F7", "#818CF8", "#F472B6"],
    correctBg: "rgba(129,140,248,0.14)",
    correctBgStrong: "rgba(129,140,248,0.2)",
    correctBorder: "#A5B4FC",
    correctText: "#C4B5FD",
    introGlow:
      "radial-gradient(ellipse at 50% 20%, rgba(255,107,157,0.2) 0%, transparent 52%), radial-gradient(ellipse at 85% 78%, rgba(168,85,247,0.15) 0%, transparent 48%)",
    outroGlow:
      "radial-gradient(ellipse at 52% 82%, rgba(129,140,248,0.12) 0%, transparent 50%), radial-gradient(ellipse at 18% 22%, rgba(255,107,157,0.1) 0%, transparent 45%)",
    introBadgeBg: "rgba(168,85,247,0.18)",
    introBadgeColor: "#E9D5FF",
    introBadgeBorder: "rgba(196,181,253,0.42)",
    outroBadgeBg: "rgba(129,140,248,0.14)",
    outroBadgeColor: "#C4B5FD",
    outroBadgeBorder: "rgba(129,140,248,0.36)",
    ctaBadgeBg: "rgba(255,107,157,0.12)",
    ctaBadgeColor: "#FFB3CC",
    ctaBadgeBorder: "rgba(255,107,157,0.32)",
  },
};

export const VIRAL_VISUAL_THEME_IDS = Object.keys(THEMES) as ViralVisualThemeId[];

export function resolveViralVisualTheme(raw?: string | null): ViralVisualThemeTokens {
  const id = typeof raw === "string" && raw in THEMES ? (raw as ViralVisualThemeId) : "sunset";
  return THEMES[id]!;
}

export function pickRandomViralVisualThemeId(): ViralVisualThemeId {
  const list = VIRAL_VISUAL_THEME_IDS;
  return list[Math.floor(Math.random() * list.length)]!;
}
