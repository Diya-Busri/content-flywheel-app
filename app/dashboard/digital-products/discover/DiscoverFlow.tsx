"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Parse response as JSON; if server returned HTML (error/sign-in page), throw a clear error. */
async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  const url = res.url?.replace(/^.*\/api/, "/api") || "request";
  if (trimmed.startsWith("<") || trimmed.toUpperCase().startsWith("<!DOCTYPE")) {
    const status = res.status;
    throw new Error(
      status === 401
        ? "Session expired. Please sign in again."
        : `Server returned an error page (${status}) for ${url}. Please sign in again or try again later.`
    );
  }
  if (!trimmed) return {} as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Invalid response from ${url}. Please try again.`);
  }
}
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, ArrowRight, Loader2, User, Video, RefreshCw, Filter, BookOpen, ClipboardList, Sheet, FileStack, GraduationCap, ListChecks, NotebookPen, Calendar, Play, Sparkles, Trash2, Copy, Check, AlertCircle, Target, Zap, MessageCircle, ChevronDown, ChevronUp, Layers, CheckCircle2, XCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";
import { HexColorPicker } from "react-colorful";

const STEP_GOALS = [
  { value: "side", label: "Side income ($500-2k/month)" },
  { value: "full", label: "Full-time income ($5k+/month)" },
  { value: "brand", label: "Build a personal brand" },
  { value: "learning", label: "Just testing/learning" },
];

const SATURATION_LEVELS: Record<string, { color: string; label: string; emoji: string; className: string }> = {
  low: { color: "green", label: "Low Saturation ⭐⭐⭐", emoji: "🟢", className: "text-green-500 bg-green-500/10 border-green-500/30" },
  medium: { color: "yellow", label: "Medium Saturation ⭐⭐", emoji: "🟡", className: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  high: { color: "orange", label: "High Saturation ⭐", emoji: "🟠", className: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
  veryHigh: { color: "red", label: "Very High Saturation ❌", emoji: "🔴", className: "text-red-500 bg-red-500/10 border-red-500/30" },
};

type NicheSaturation = "low" | "medium" | "high" | "veryHigh";
type NicheTrend = "rising" | "stable" | "declining";

function normalizeSaturation(s: string | undefined): NicheSaturation {
  if (!s || typeof s !== "string") return "medium";
  const lower = s.trim().toLowerCase().replace(/[\s_-]/g, "");
  if (lower === "low") return "low";
  if (lower === "medium") return "medium";
  if (lower === "high") return "high";
  if (lower === "veryhigh") return "veryHigh";
  return "medium";
}

export type NicheOption = {
  id: string;
  name: string;
  demand: string;
  competition: string;
  revenue: string;
  why: string;
  saturation: NicheSaturation;
  trend: NicheTrend;
  subNiches: string[];
};

const INITIAL_NICHES: NicheOption[] = [
  { id: "1", name: "Budget Trackers for Young Parents", demand: "High", competition: "Low", revenue: "$1-3k/mo", saturation: "low", trend: "rising", subNiches: ["First-year costs", "Monthly baby budget", "Savings goals"], why: "Young parents struggle with baby expenses and need simple solutions. Low competition, high intent." },
  { id: "2", name: "Fitness Planners for Busy Moms", demand: "High", competition: "Medium", revenue: "$1-2k/mo", saturation: "medium", trend: "stable", subNiches: ["Home workout plans", "Meal + fitness combo", "12-week challenges"], why: "Evergreen audience. Time-starved parents want quick wins. Template + guide bundles sell well." },
  { id: "3", name: "Productivity Systems for Creators", demand: "High", competition: "High", revenue: "$2-5k/mo", saturation: "high", trend: "rising", subNiches: ["Content batching", "Launch checklists", "Editor workflows"], why: "Creators invest in tools. Higher price points. Strong demand for systems and frameworks." },
  { id: "4", name: "Meal Planners for Weight Loss", demand: "High", competition: "Medium", revenue: "$1-3k/mo", saturation: "medium", trend: "stable", subNiches: ["Macro tracking", "Weekly prep sheets", "Recipe + shopping list"], why: "Recurring need. Can offer weekly/monthly. Combines well with coaching or community." },
  { id: "5", name: "Habit Trackers for Students", demand: "Medium", competition: "Low", revenue: "$500-1.5k/mo", saturation: "low", trend: "rising", subNiches: ["Exam prep tracker", "Study blocks", "Goal-setting pages"], why: "Students are used to digital products. Low barrier. Can scale with variations." },
  { id: "6", name: "Travel Budget Planners", demand: "High", competition: "Medium", revenue: "$1-3k/mo", saturation: "medium", trend: "stable", subNiches: ["Trip cost breakdown", "Daily spend tracker", "Group trip split"], why: "Travelers look for simple tools. Seasonal peaks. Easy to create with Notion or PDFs." },
  { id: "7", name: "Side Hustle Tax Trackers", demand: "High", competition: "Low", revenue: "$1-2k/mo", saturation: "low", trend: "rising", subNiches: ["1099 prep", "Quarterly estimates", "Expense categories"], why: "Freelancers and gig workers need simple tax tracking. Underserved niche with clear pain." },
  { id: "8", name: "Wedding Budget & Checklist", demand: "High", competition: "High", revenue: "$2-4k/mo", saturation: "veryHigh", trend: "stable", subNiches: ["Vendor tracker", "Timeline checklist", "Guest budget"], why: "High-ticket event, emotional purchase. Saturated but still converts with unique angles." },
];

const MORE_NICHES_POOL: NicheOption[] = [
  { id: "m1", name: "Pet Care Planners for New Owners", demand: "Medium", competition: "Low", revenue: "$500-1.5k/mo", saturation: "low", trend: "rising", subNiches: ["Vet schedule", "Cost tracker", "First-year guide"], why: "New pet owners need structure. Few dedicated digital products." },
  { id: "m2", name: "Renovation Budget Trackers", demand: "Medium", competition: "Low", revenue: "$1-2k/mo", saturation: "low", trend: "rising", subNiches: ["Room-by-room", "Contractor quotes", "Timeline"], why: "Homeowners plan one big project at a time. Niche tools beat generic spreadsheets." },
  { id: "m3", name: "Freelancer Proposal Templates", demand: "High", competition: "Medium", revenue: "$2-4k/mo", saturation: "medium", trend: "rising", subNiches: ["Pricing calculator", "Proposal pack", "Client onboarding"], why: "Freelancers pay for time-saving tools. Recurring need." },
  { id: "m4", name: "Small Business Social Content Calendars", demand: "High", competition: "High", revenue: "$1-3k/mo", saturation: "high", trend: "stable", subNiches: ["Caption templates", "Hashtag lists", "Monthly themes"], why: "SMBs want done-for-them content. Competitive but scalable." },
  { id: "m5", name: "Language Learning Progress Trackers", demand: "High", competition: "Medium", revenue: "$1-2k/mo", saturation: "medium", trend: "rising", subNiches: ["Vocabulary logs", "Speaking goals", "Streak tracker"], why: "Learners love gamification and tracking. Pairs with apps." },
];

const MOCK_NICHES = INITIAL_NICHES;

/** Product idea shown in Step 3 (Choose a Product). */
export type ProductSuggestionItem = {
  id: string;
  name: string;
  type: string;
  price: string;
  priceNote?: string;
  included: string;
  why: string;
  complexity?: "Beginner-friendly" | "Intermediate" | "Advanced";
  estimatedTime?: string;
};

const PRODUCTS_PER_PAGE = 6;

const PRODUCT_TYPE_ICONS: Record<string, string> = {
  spreadsheet: "📊",
  notion: "📁",
  template: "📋",
  guide: "📝",
  pdf: "📝",
  workbook: "📝",
  course: "🎓",
  checklist: "✅",
  planner: "📅",
};
function getProductTypeIcon(type: string): string {
  const lower = type.toLowerCase();
  for (const [key, icon] of Object.entries(PRODUCT_TYPE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "📦";
}

const MOCK_PRODUCTS: ProductSuggestionItem[] = [
  { id: "1", name: "Baby Budget Planner Template", type: "Notion Template", price: "$17-27", priceNote: "Based on template/tracker format", included: "Monthly expense tracker, baby essentials checklist, savings goal calculator", why: "New parents need simple, visual tools to manage unexpected costs.", complexity: "Beginner-friendly", estimatedTime: "~2 hours to customize" },
  { id: "2", name: "90-Day Baby Savings Challenge", type: "PDF + Guide", price: "$37-47", priceNote: "Based on 90-day duration", included: "Challenge PDF, weekly check-ins, bonus checklist", why: "Time-bound offer creates urgency. Community potential. Upsell to full planner.", complexity: "Beginner-friendly", estimatedTime: "~2 hours to customize" },
  { id: "3", name: "Family Budget Dashboard (Notion)", type: "Notion Template", price: "$17-27", priceNote: "Based on template/tracker format", included: "Dashboard, 3 expense views, video walkthrough", why: "Notion trend. Recurring updates possible. Higher perceived value.", complexity: "Intermediate", estimatedTime: "~3 hours to customize" },
  { id: "4", name: "First-Year Baby Costs Tracker", type: "Spreadsheet + Guide", price: "$17-27", priceNote: "Based on template/tracker format", included: "Excel/Sheets template, category guide, tips PDF", why: "Clear outcome. Parents Google 'baby costs' constantly.", complexity: "Beginner-friendly", estimatedTime: "~1 hour to customize" },
  { id: "5", name: "New Parent Money Bootcamp", type: "Mini-Course", price: "$37-97", priceNote: "Based on complete course/system", included: "5 short videos, workbook, 1:1 checklist", why: "Premium positioning. Bootcamp format converts. Upsell to coaching.", complexity: "Advanced", estimatedTime: "~4 hours to customize" },
];

const HOOK_EXAMPLES = [
  "Stop wasting £500/month on baby stuff you don't need...",
  "I wish I knew this budgeting trick when my first was born...",
  "New parents are overspending by 40%. Here's why...",
  "You don't need a fancy app to track baby expenses...",
  "This one spreadsheet saved us £3k in the first year...",
];

const CTA_EXAMPLES = [
  "Link in bio for the free template",
  "Comment 'BUDGET' and I'll send it to you",
  "Save this before you forget",
  "Download now for just £27",
  "DM me 'SAVE' for instant access",
];

const TOTAL_STEPS = 7;

/** Progress bar percentage for the current step (1–7). Step 1 ≈ 14%, step 7 = 100%. */
function progressForStep(step: number): number {
  return Math.round((Math.min(Math.max(step, 1), TOTAL_STEPS) / TOTAL_STEPS) * 100);
}

const PRODUCT_FORMATS = [
  { id: "ebook", label: "Ebook/Guide", icon: BookOpen, desc: "PDF with chapters & TOC" },
  { id: "workbook", label: "Workbook", icon: ClipboardList, desc: "Fill-in worksheets & exercises" },
  { id: "spreadsheet", label: "Spreadsheet Template", icon: Sheet, desc: "Ready-to-use spreadsheet layouts with column setups, real formulas, and sample data. Includes setup guide and formula reference. Delivered as a PDF." },
  { id: "notion", label: "Notion Template", icon: FileStack, desc: "Databases & templates" },
  { id: "course", label: "Course Outline", icon: GraduationCap, desc: "Modules & lessons structure" },
  { id: "checklist", label: "Checklist Pack", icon: ListChecks, desc: "Printable action checklists" },
  { id: "journal", label: "Journal", icon: NotebookPen, desc: "Guided prompts & writing space" },
  { id: "planner", label: "Planner", icon: Calendar, desc: "Lined pages for planning & notes" },
] as const;

const GENERATE_STEPS = [
  "Creating outline...",
  "Writing content...",
  "Adding examples...",
  "Formatting product...",
];

/** Universal + format-specific customization options for product generation. */
export type CustomizationOptions = {
  numChapters: number;
  contentLength: "short" | "medium" | "long";
  contentStyle: "text_only" | "text_with_placeholders" | "text_with_ai_images";
  tone: "professional" | "casual" | "academic" | "friendly";
  ebookGuide?: { includeToc: boolean; includeIntroConclusion: boolean };
  workbook?: { exercisesPerSection: number; includeAnswerKey: boolean; includeFillInBlanks: boolean };
  checklist?: { numChecklists: number; itemsPerChecklist: number; includeProgressTracking: boolean };
  course?: { numModules: number; lessonsPerModule: number; includeLearningObjectives: boolean; includeAssignments: boolean };
  journal?: { numPrompts: number; includeLinedSpace: boolean; includeReflectionQuestions: boolean };
  planner?: { duration: "weekly" | "monthly" | "quarterly" | "yearly"; includeGoalSetting: boolean; includeHabitTracker: boolean };
  spreadsheet?: { numTutorials: number; difficulty: "beginner" | "intermediate" | "advanced"; includePracticeExercises: boolean };
  notion?: { numDatabases: number; includeSetupInstructions: boolean };
};

const DEFAULT_CUSTOMIZATION: CustomizationOptions = {
  numChapters: 4,
  contentLength: "medium",
  contentStyle: "text_with_placeholders",
  tone: "professional",
  ebookGuide: { includeToc: true, includeIntroConclusion: true },
  workbook: { exercisesPerSection: 5, includeAnswerKey: false, includeFillInBlanks: false },
  checklist: { numChecklists: 4, itemsPerChecklist: 8, includeProgressTracking: false },
  course: { numModules: 4, lessonsPerModule: 3, includeLearningObjectives: true, includeAssignments: true },
  journal: { numPrompts: 12, includeLinedSpace: true, includeReflectionQuestions: true },
  planner: { duration: "monthly", includeGoalSetting: true, includeHabitTracker: true },
  spreadsheet: { numTutorials: 4, difficulty: "beginner", includePracticeExercises: true },
  notion: { numDatabases: 4, includeSetupInstructions: true },
};

const FORMAT_LABELS: Record<string, string> = {
  ebook: "Ebook",
  workbook: "Workbook",
  spreadsheet: "Spreadsheet Template",
  notion: "Notion Template",
  course: "Course Outline",
  checklist: "Checklist",
  journal: "Journal",
  planner: "Planner",
  template: "Template",
};

/** Full sales education guide from API (Step 5). */
type ProductSalesGuide = {
  productOverview: { productName: string; format: string; targetCustomer: string; transformation: string };
  painPoints: string[];
  solutions: Array<{ pain: string; solution: string }>;
  keyBenefits: string[];
  objections: Array<{ objection: string; answer: string }>;
  hooks: Array<{ text: string; whyItWorks: string }>;
  ctas: Array<{ text: string; whyItWorks: string }>;
  pricingPsychology: string[];
  idealCustomerProfile: string[];
  contentStrategy: string[];
  launchStrategy: string[];
};

export default function DiscoverFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const NICHES_PER_PAGE = 6;

  // Initialize state FROM localStorage so first render already has correct step/data (fixes "Continue" always showing Step 1)
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState("");
  const [goal, setGoal] = useState("");
  const [nicheLoading, setNicheLoading] = useState(false);
  const [allNiches, setAllNiches] = useState<NicheOption[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [moreNichesLoading, setMoreNichesLoading] = useState(false);
  const [saturationFilter, setSaturationFilter] = useState<string>("all");
  const [revenueFilter, setRevenueFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"opportunity" | "competition" | "revenue">("opportunity");
  const [selectedNiche, setSelectedNiche] = useState<NicheOption | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductSuggestionItem | null>(null);
  const [allProductSuggestions, setAllProductSuggestions] = useState<ProductSuggestionItem[]>([]);
  const [productCurrentPage, setProductCurrentPage] = useState(0);
  const [productSuggestionsLoading, setProductSuggestionsLoading] = useState(false);
  const [moreProductsLoading, setMoreProductsLoading] = useState(false);
  const [productSuggestionsError, setProductSuggestionsError] = useState<string | null>(null);
  const [productPriceFilter, setProductPriceFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [productSortBy, setProductSortBy] = useState<"potential" | "lowest" | "highest" | "easiest">("potential");
  const [salesGuide, setSalesGuide] = useState<ProductSalesGuide | null>(null);
  const [salesGuideLoading, setSalesGuideLoading] = useState(false);
  const [salesGuideProductId, setSalesGuideProductId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [facelessOrPersonal, setFacelessOrPersonal] = useState<"faceless" | "personal" | null>(null);
  const [productFormat, setProductFormat] = useState<string | null>(null);
  const [dontKnowYet, setDontKnowYet] = useState(false);
  const [customNiche, setCustomNiche] = useState("");
  const [customProductName, setCustomProductName] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedProductId, setSavedProductId] = useState<string | null>(null);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [courseIncludeAvatar, setCourseIncludeAvatar] = useState(false);
  const [courseVoiceOver, setCourseVoiceOver] = useState(false);
  const [courseVoiceType, setCourseVoiceType] = useState<string>("professional-female");
  const [customization, setCustomization] = useState<CustomizationOptions>(DEFAULT_CUSTOMIZATION);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [generateStepIndex, setGenerateStepIndex] = useState(0);
  const [generateProgress, setGenerateProgress] = useState<{ total: number; completed: number } | null>(null);
  /** When set, we hit the poll timeout but product is still generating; show "Still generating" with Keep waiting / My Library. */
  const [timeoutStillGenerating, setTimeoutStillGenerating] = useState<string | null>(null);
  const [showVideoPromptModal, setShowVideoPromptModal] = useState(false);
  const [bundleGenerating, setBundleGenerating] = useState(false);
  const [bundleItems, setBundleItems] = useState<{ productId: string; format: string; label: string; status: "generating" | "done" | "failed"; subFocus?: string }[]>([]);
  const [bundleNiche, setBundleNiche] = useState<string>("");
  const [bundleComplete, setBundleComplete] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [bundleDialogDismissed, setBundleDialogDismissed] = useState(false);
  // Design choice: shown in modal before starting bundle; 'manual' = skip auto-design
  const [showDesignChoiceModal, setShowDesignChoiceModal] = useState(false);
  const [bundleDesignChoice, setBundleDesignChoice] = useState<"ai" | "brand" | "manual" | null>(null);
  const [bundleBrandProfile, setBundleBrandProfile] = useState<{
    primaryColor: string;
    secondaryColor: string;
    tiktokUrl?: string;
    instagramUrl?: string;
    youtubeUrl?: string;
    facebookUrl?: string;
    websiteUrl?: string;
  } | null>(null);
  const [bundleBrandForm, setBundleBrandForm] = useState({
    primaryColor: "#1a1a1a",
    secondaryColor: "#475569",
    tiktokUrl: "",
    instagramUrl: "",
    youtubeUrl: "",
    facebookUrl: "",
    websiteUrl: "",
  });
  const [bundleBrandFormSaving, setBundleBrandFormSaving] = useState(false);
  const [applyingDesign, setApplyingDesign] = useState(false);
  const [designApplied, setDesignApplied] = useState(false);
  const appliedDesignRunRef = useRef(false);
  const designChoiceModalBrandFetchedRef = useRef(false);

  // Step 1: must select goal (experienced/beginner) + interests min 3 chars OR "I'm not sure"
  const canProceedStep1 = !!goal && (interests.trim().length >= 3 || dontKnowYet);
  // Step 2: must select a niche from list OR enter custom niche (min 3 chars)
  const canProceedStep2 = selectedNiche !== null || customNiche.trim().length >= 3;
  // Step 3: must select a product OR enter custom product name
  const canProceedStep3 = selectedProduct !== null || customProductName.trim().length >= 1;
  // Step 5: if they have a selected product, must wait for sales guide; otherwise can proceed (custom path)
  const canProceedStep5 = !selectedProduct || !!salesGuide;

  const DISCOVERY_KEYS = [
    "discovery-niches",
    "discovery-niche-page",
    "discovery-interests",
    "discovery-goal",
    "discovery-step",
    "discovery-dont-know-yet",
    "discovery-selected-niche",
    "discovery-product-page",
    "discovery-selected-product",
    "discovery-format",
    "discovery-content-style",
    "discovery-product-id",
  ] as const;

  function clearDiscoveryStorage() {
    DISCOVERY_KEYS.forEach((key) => localStorage.removeItem(key));
    if (typeof window !== "undefined") {
      const prefix = "discovery-products-";
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) keysToRemove.push(key);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  }

  function handleStartFresh() {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      console.log("🗑️ Starting fresh");
    }
    clearDiscoveryStorage();
    setStep(1);
    setInterests("");
    setGoal("");
    setAllNiches([]);
    setCurrentPage(0);
    setSelectedNiche(null);
    setSelectedProduct(null);
    setAllProductSuggestions([]);
    setProductCurrentPage(0);
    setFacelessOrPersonal(null);
    setProductFormat(null);
    setCustomization(DEFAULT_CUSTOMIZATION);
    setShowAdvancedOptions(false);
    setDontKnowYet(false);
    setCustomNiche("");
    setCustomProductName("");
    setSalesGuide(null);
    setSalesGuideProductId(null);
    setSavedProductId(null);
    setShowResumeModal(false);
  }

  function handleResume() {
    setShowResumeModal(false);
    if (savedProductId) {
      router.push(`/dashboard/digital-products/${savedProductId}/edit`);
      return;
    }
  }

  const handleStep2Start = async () => {
    if (!canProceedStep1) return;
    const interestsToSend = dontKnowYet ? "" : interests.trim();
    if (!dontKnowYet && interestsToSend.length === 0) {
      setGenerateError('Please enter your interests or check "I\'m not sure yet"');
      return;
    }
    if (allNiches.length > 0) {
      setStep(2);
      return;
    }
    setNicheLoading(true);
    setGenerateError(null);
    setStep(2);
    const payload = {
      interests: interestsToSend,
      goal,
      showTrending: dontKnowYet,
    };
    console.log("📤 SENDING TO API:", { interests: interestsToSend, goal, dontKnowYet });
    try {
      const res = await fetch("/api/niches/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonResponse<{ error?: string } | NicheOption[]>(res);
      console.log("📥 RECEIVED FROM API:", res.ok ? (Array.isArray(data) ? data.length : 0) : data, data);

      if (!res.ok) {
        const errMsg = (typeof data === "object" && data !== null && !Array.isArray(data) && typeof (data as { error?: string }).error === "string" ? (data as { error: string }).error : null) || "Generation failed";
        if (res.status === 429) {
          setGenerateError("We're experiencing high demand. Your request will automatically retry in a few seconds...");
          setNicheLoading(true);
          await new Promise((r) => setTimeout(r, 5000));
          setGenerateError(null);
          return handleStep2Start();
        }
        setGenerateError(errMsg);
        setAllNiches([]);
        setCurrentPage(0);
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        if (!dontKnowYet && interestsToSend.length > 0) {
          const keywords = interestsToSend.toLowerCase().split(/[,\s]+/).filter((k) => k.length > 3);
          const matched = (data as NicheOption[]).filter((n) =>
            keywords.some((k) => n.name.toLowerCase().includes(k) || (n.why && n.why.toLowerCase().includes(k)))
          );
          if (matched.length < data.length && process.env.NODE_ENV === "development") {
            console.warn(`⚠️ Frontend filtered to ${matched.length} niches matching interests`);
          }
          setAllNiches(matched.length > 0 ? matched : (data as NicheOption[]));
        } else {
          setAllNiches(data as NicheOption[]);
        }
        setCurrentPage(0);
      } else {
        const hadInterests = !dontKnowYet && interestsToSend.length > 0;
        setGenerateError(hadInterests ? "No niches matched your interests. Please try again or broaden your interests." : null);
        setAllNiches(hadInterests ? [] : INITIAL_NICHES);
        setCurrentPage(0);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Discover] Niche generation failed:", err);
      }
      const hadInterests = !dontKnowYet && interestsToSend.length > 0;
      setGenerateError(hadInterests ? "Failed to generate niches. Please try again." : null);
      setAllNiches(hadInterests ? [] : INITIAL_NICHES);
      setCurrentPage(0);
    } finally {
      setNicheLoading(false);
    }
  };

  const PRODUCTS_STORAGE_KEY = "discovery-products";

  function getProductsStorageKey(nicheId: string) {
    return `${PRODUCTS_STORAGE_KEY}-${nicheId}`;
  }

  const handleSelectNiche = (n: NicheOption) => {
    setSelectedNiche(n);
    setProductSuggestionsError(null);
    setProductCurrentPage(0);
    try {
      const key = getProductsStorageKey(n.id);
      const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      if (saved?.trim()) {
        try {
          const parsed = JSON.parse(saved.trim()) as ProductSuggestionItem[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllProductSuggestions(parsed);
            return;
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    setAllProductSuggestions([]);
  };

  useEffect(() => {
    if (step !== 3 || !selectedNiche) return;
    if (allProductSuggestions.length > 0) return;
    try {
      const key = getProductsStorageKey(selectedNiche.id);
      const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      if (saved?.trim()) {
        const parsed = JSON.parse(saved.trim()) as ProductSuggestionItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllProductSuggestions(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    let cancelled = false;
    setProductSuggestionsLoading(true);
    setProductSuggestionsError(null);
    fetch("/api/products/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niche: selectedNiche.name, subNiches: selectedNiche.subNiches ?? [] }),
    })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          const list = data as ProductSuggestionItem[];
          setAllProductSuggestions(list);
          try {
            localStorage.setItem(getProductsStorageKey(selectedNiche.id), JSON.stringify(list));
          } catch {
            // ignore
          }
        } else {
          setAllProductSuggestions(MOCK_PRODUCTS);
          if (data?.error) setProductSuggestionsError(data.error);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllProductSuggestions(MOCK_PRODUCTS);
          setProductSuggestionsError("Using default suggestions");
        }
      })
      .finally(() => {
        if (!cancelled) setProductSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, selectedNiche?.id]);

  const handleGenerateMoreProducts = async () => {
    if (!selectedNiche) return;
    setMoreProductsLoading(true);
    setProductSuggestionsError(null);
    try {
      const res = await fetch("/api/products/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: selectedNiche.name,
          subNiches: selectedNiche.subNiches ?? [],
          exclude: allProductSuggestions.map((p) => p.name),
        }),
      });
      const data = await parseJsonResponse<ProductSuggestionItem[] | { error?: string }>(res);
      if (!Array.isArray(data) || data.length === 0) {
        setProductSuggestionsError("Could not generate more. Try again.");
        return;
      }
      const newList = data as ProductSuggestionItem[];
      const combined = [...allProductSuggestions, ...newList];
      setAllProductSuggestions(combined);
      setProductCurrentPage(Math.floor(combined.length / PRODUCTS_PER_PAGE) - 1);
      try {
        localStorage.setItem(getProductsStorageKey(selectedNiche.id), JSON.stringify(combined));
      } catch {
        // ignore
      }
    } catch {
      setProductSuggestionsError("Failed to generate more products.");
    } finally {
      setMoreProductsLoading(false);
    }
  };

  function parsePriceMax(priceStr: string): number {
    const match = priceStr.match(/\$?(\d+)\s*-\s*\$?(\d+)/);
    if (match) return Math.max(parseInt(match[1], 10), parseInt(match[2], 10));
    const single = priceStr.match(/\$?(\d+)/);
    return single ? parseInt(single[1], 10) : 0;
  }
  function parsePriceMin(priceStr: string): number {
    const match = priceStr.match(/\$?(\d+)\s*-\s*\$?(\d+)/);
    if (match) return Math.min(parseInt(match[1], 10), parseInt(match[2], 10));
    const single = priceStr.match(/\$?(\d+)/);
    return single ? parseInt(single[1], 10) : 0;
  }

  const filteredAndSortedProducts = (() => {
    let list = allProductSuggestions.length > 0 ? [...allProductSuggestions] : [...MOCK_PRODUCTS];
    if (productPriceFilter === "under20") list = list.filter((p) => parsePriceMax(p.price) < 20);
    if (productPriceFilter === "20-50") list = list.filter((p) => parsePriceMax(p.price) >= 20 && parsePriceMax(p.price) <= 50);
    if (productPriceFilter === "50+") list = list.filter((p) => parsePriceMin(p.price) >= 50);
    const lower = (s: string) => s.toLowerCase();
    if (productTypeFilter === "Templates") list = list.filter((p) => lower(p.type).includes("template") || lower(p.type).includes("notion") || lower(p.type).includes("spreadsheet"));
    if (productTypeFilter === "Guides") list = list.filter((p) => lower(p.type).includes("guide") || lower(p.type).includes("pdf") || lower(p.type).includes("workbook"));
    if (productTypeFilter === "Courses") list = list.filter((p) => lower(p.type).includes("course"));
    if (productTypeFilter === "Planners") list = list.filter((p) => lower(p.type).includes("planner"));
    if (productSortBy === "lowest") list.sort((a, b) => parsePriceMin(a.price) - parsePriceMin(b.price));
    if (productSortBy === "highest") list.sort((a, b) => parsePriceMax(b.price) - parsePriceMax(a.price));
    if (productSortBy === "easiest") {
      const order = { "Beginner-friendly": 0, Intermediate: 1, Advanced: 2 };
      list.sort((a, b) => (order[a.complexity as keyof typeof order] ?? 1) - (order[b.complexity as keyof typeof order] ?? 1));
    }
    return list;
  })();

  const totalProductPages = Math.max(1, Math.ceil(filteredAndSortedProducts.length / PRODUCTS_PER_PAGE));
  const productStartIdx = productCurrentPage * PRODUCTS_PER_PAGE;
  const displayedProducts = filteredAndSortedProducts.slice(productStartIdx, productStartIdx + PRODUCTS_PER_PAGE);

  useEffect(() => {
    if (productCurrentPage >= totalProductPages) setProductCurrentPage(Math.max(0, totalProductPages - 1));
  }, [productCurrentPage, totalProductPages]);

  useEffect(() => {
    if (step !== 5 || !selectedProduct) return;
    if (salesGuideProductId === selectedProduct.id && salesGuide) return;
    let cancelled = false;
    setSalesGuideLoading(true);
    fetch("/api/product-sales-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productTitle: selectedProduct.name,
        productType: selectedProduct.type,
        productIncluded: selectedProduct.included,
        productWhy: selectedProduct.why,
        productPrice: selectedProduct.price,
        nicheName: selectedNiche?.name ?? "",
        goal,
      }),
    })
      .then((res) => parseJsonResponse<{ productOverview?: unknown }>(res))
      .then((data) => {
        if (cancelled) return;
        if (data.productOverview) {
          setSalesGuide(data as ProductSalesGuide);
          setSalesGuideProductId(selectedProduct.id);
        }
      })
      .catch(() => {
        if (!cancelled) setSalesGuide(null);
      })
      .finally(() => {
        if (!cancelled) setSalesGuideLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, selectedProduct?.id]);

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      // ignore
    }
  }

  const handleGenerateMoreNiches = async () => {
    setMoreNichesLoading(true);
    setGenerateError(null);
    const payload = {
      interests: dontKnowYet ? "" : interests.trim(),
      goal,
      showTrending: dontKnowYet,
      exclude: allNiches.map((n) => n.name),
      variation: true,
      batchNumber: Math.floor(allNiches.length / NICHES_PER_PAGE) + 1,
    };
    if (process.env.NODE_ENV === "development") {
      console.log("[Discover] Generate more niches:", payload);
    }
    try {
      const res = await fetch("/api/niches/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonResponse<{ error?: string } | NicheOption[]>(res);
      if (!res.ok) {
        const err = typeof data === "object" && data !== null && !Array.isArray(data) && typeof (data as { error?: string }).error === "string" ? (data as { error: string }).error : null;
        if (res.status === 429) {
          setGenerateError("We're experiencing high demand. Your request will automatically retry in a few seconds...");
          setMoreNichesLoading(true);
          await new Promise((r) => setTimeout(r, 5000));
          setGenerateError(null);
          return handleGenerateMoreNiches();
        }
        setGenerateError(err || "Generation failed");
        return;
      }
      if (!data || !Array.isArray(data) || data.length === 0) {
        setGenerateError("No niches returned. Please try again.");
        return;
      }
      const newNiches = data as NicheOption[];
      const pageToShow = Math.floor(allNiches.length / NICHES_PER_PAGE);
      setAllNiches((prev) => [...prev, ...newNiches]);
      setCurrentPage(pageToShow);
    } catch (err) {
      setGenerateError("Failed to generate niches. Please try again.");
      if (process.env.NODE_ENV === "development") {
        console.error("[Discover] Niche generation failed:", err);
      }
    } finally {
      setMoreNichesLoading(false);
    }
  };

  const filteredAndSortedNiches = (() => {
    let list = [...allNiches];

    // 1. SATURATION FILTER – normalize so "low" only shows low, excludes veryHigh etc.
    if (saturationFilter !== "all") {
      list = list.filter((n) => normalizeSaturation(n.saturation) === saturationFilter);
    }

    // 2. REVENUE FILTER
    if (revenueFilter !== "all") {
      if (revenueFilter === "1-2k") list = list.filter((n) => n.revenue.includes("$1-2k") || n.revenue.includes("$500-1.5k"));
      if (revenueFilter === "2-5k") list = list.filter((n) => n.revenue.includes("$2-5k") || n.revenue.includes("$1-3k"));
      if (revenueFilter === "5k+") list = list.filter((n) => n.revenue.includes("$5k") || n.revenue.includes("$2-4k"));
    }

    // 3. SORT
    if (sortBy === "opportunity") {
      const order: Record<NicheSaturation, number> = { low: 0, medium: 1, high: 2, veryHigh: 3 };
      list.sort((a, b) => order[normalizeSaturation(a.saturation)] - order[normalizeSaturation(b.saturation)]);
    }
    if (sortBy === "competition") {
      const order = { Low: 0, Medium: 1, High: 2 };
      list.sort((a, b) => (order[a.competition as keyof typeof order] ?? 2) - (order[b.competition as keyof typeof order] ?? 2));
    }
    if (sortBy === "revenue") {
      list.sort((a, b) => {
        const num = (s: string) => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
        return num(b.revenue) - num(a.revenue);
      });
    }
    return list;
  })();

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedNiches.length / NICHES_PER_PAGE));
  const startIdx = currentPage * NICHES_PER_PAGE;
  const endIdx = startIdx + NICHES_PER_PAGE;
  const displayedNiches = filteredAndSortedNiches.slice(startIdx, endIdx);

  // Clamp current page when filters reduce the list
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  // Persist niches and page to localStorage (only when not showing resume modal)
  useEffect(() => {
    if (showResumeModal) return;
    if (allNiches.length > 0) {
      try {
        localStorage.setItem("discovery-niches", JSON.stringify(allNiches));
        localStorage.setItem("discovery-niche-page", currentPage.toString());
      } catch {
        // ignore
      }
    }
  }, [allNiches, currentPage, showResumeModal]);

  // Load from localStorage ONCE on mount. Only restore state when saved progress is beyond step 1; set step LAST so modal and content show correct step.
  useEffect(() => {
    if (typeof window === "undefined" || hasLoadedFromStorage) return;
    try {
      const savedStep = localStorage.getItem("discovery-step");
      const stepNum = savedStep ? parseInt(savedStep, 10) : 0;
      const hasProgress = !Number.isNaN(stepNum) && stepNum > 1 && stepNum <= 7;

      if (process.env.NODE_ENV === "development") {
        console.log("📦 Loading saved state from localStorage...", { savedStep, stepNum, hasProgress });
      }

      if (hasProgress) {
        const savedInterests = localStorage.getItem("discovery-interests");
        const savedGoal = localStorage.getItem("discovery-goal");
        const savedNiches = localStorage.getItem("discovery-niches");
        const savedNichePage = localStorage.getItem("discovery-niche-page");
        const savedSelectedNiche = localStorage.getItem("discovery-selected-niche");
        const savedProductPage = localStorage.getItem("discovery-product-page");
        const savedSelectedProduct = localStorage.getItem("discovery-selected-product");
        const savedFormat = localStorage.getItem("discovery-format");
        const savedContentStyle = localStorage.getItem("discovery-content-style");
        const savedDontKnow = localStorage.getItem("discovery-dont-know-yet");

        if (savedInterests != null) setInterests(savedInterests);
        if (savedGoal != null) setGoal(savedGoal);
        if (savedDontKnow != null) setDontKnowYet(savedDontKnow === "true");
        if (savedContentStyle === "faceless" || savedContentStyle === "personal") setFacelessOrPersonal(savedContentStyle);
        if (savedFormat != null && savedFormat !== "") setProductFormat(savedFormat);

        if (savedNiches?.trim()) {
          try {
            const parsed = JSON.parse(savedNiches.trim()) as NicheOption[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAllNiches(parsed);
              const page = parseInt(savedNichePage ?? "0", 10);
              if (!Number.isNaN(page)) setCurrentPage(Math.max(0, page));
            }
          } catch {
            // ignore
          }
        }
        if (savedSelectedNiche?.trim()) {
          try {
            const niche = JSON.parse(savedSelectedNiche.trim()) as NicheOption;
            if (niche?.id != null) {
              setSelectedNiche(niche);
              const productsKey = getProductsStorageKey(niche.id);
              const savedProducts = localStorage.getItem(productsKey);
              if (savedProducts?.trim()) {
                const productList = JSON.parse(savedProducts.trim()) as ProductSuggestionItem[];
                if (Array.isArray(productList) && productList.length > 0) setAllProductSuggestions(productList);
              }
            }
          } catch {
            // ignore
          }
        }
        if (savedProductPage != null) {
          const pageNum = parseInt(savedProductPage, 10);
          if (!Number.isNaN(pageNum) && pageNum >= 0) setProductCurrentPage(pageNum);
        }
        if (savedSelectedProduct?.trim()) {
          try {
            const product = JSON.parse(savedSelectedProduct.trim()) as ProductSuggestionItem;
            if (product?.id != null) setSelectedProduct(product);
          } catch {
            // ignore
          }
        }
        const savedProductIdVal = localStorage.getItem("discovery-product-id");
        if (savedProductIdVal && savedProductIdVal.trim()) setSavedProductId(savedProductIdVal.trim());
        // Set step AFTER all other state so modal and content show correct step
        setStep(stepNum);
        setShowResumeModal(true);
        if (process.env.NODE_ENV === "development") {
          console.log("✅ Found saved progress at step:", stepNum);
        }
      }
      setHasLoadedFromStorage(true);
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("Load from localStorage failed", e);
      }
      setHasLoadedFromStorage(true);
    }
  }, [hasLoadedFromStorage]);

  // Persist state only when resume modal is closed (so we don't overwrite saved data on mount)
  useEffect(() => {
    if (showResumeModal) return;
    try {
      localStorage.setItem("discovery-step", step.toString());
    } catch {
      // ignore
    }
  }, [step, showResumeModal]);
  useEffect(() => {
    if (showResumeModal) return;
    try {
      localStorage.setItem("discovery-interests", interests);
    } catch {
      // ignore
    }
  }, [interests, showResumeModal]);
  useEffect(() => {
    if (showResumeModal) return;
    try {
      localStorage.setItem("discovery-goal", goal);
    } catch {
      // ignore
    }
  }, [goal, showResumeModal]);
  useEffect(() => {
    if (showResumeModal) return;
    try {
      localStorage.setItem("discovery-dont-know-yet", dontKnowYet.toString());
    } catch {
      // ignore
    }
  }, [dontKnowYet, showResumeModal]);
  useEffect(() => {
    if (showResumeModal) return;
    try {
      if (selectedNiche) localStorage.setItem("discovery-selected-niche", JSON.stringify(selectedNiche));
      else localStorage.removeItem("discovery-selected-niche");
    } catch {
      // ignore
    }
  }, [selectedNiche, showResumeModal]);
  useEffect(() => {
    if (showResumeModal) return;
    try {
      localStorage.setItem("discovery-product-page", productCurrentPage.toString());
    } catch {
      // ignore
    }
  }, [productCurrentPage, showResumeModal]);
  useEffect(() => {
    if (showResumeModal) return;
    try {
      if (selectedProduct) localStorage.setItem("discovery-selected-product", JSON.stringify(selectedProduct));
      else localStorage.removeItem("discovery-selected-product");
    } catch {
      // ignore
    }
  }, [selectedProduct, showResumeModal]);
  useEffect(() => {
    if (showResumeModal) return;
    try {
      if (productFormat) localStorage.setItem("discovery-format", productFormat);
      else localStorage.removeItem("discovery-format");
    } catch {
      // ignore
    }
  }, [productFormat, showResumeModal]);
  useEffect(() => {
    if (showResumeModal) return;
    try {
      if (facelessOrPersonal) localStorage.setItem("discovery-content-style", facelessOrPersonal);
      else localStorage.removeItem("discovery-content-style");
    } catch {
      // ignore
    }
  }, [facelessOrPersonal, showResumeModal]);

  const handleSelectProduct = (p: ProductSuggestionItem) => {
    setSelectedProduct(p);
  };

  const POLL_INTERVAL_MS = 2500;

  /**
   * Poll GET /api/products/[id] until completed, failed, or timeout.
   * On timeout, does one final fetch; if product is complete, returns 'completed'; if still generating, returns 'timeout_still_generating'.
   * Does not redirect or set global state; caller handles outcome.
   */
  const runPollLoop = async (
    productId: string,
    timeoutMs: number
  ): Promise<{ outcome: "completed" | "failed" | "timeout_still_generating"; productId: string; error?: string }> => {
    const pollStart = Date.now();
    const fetchAndParse = async (): Promise<{
      status?: string;
      sections: Array<{ content?: string; contentHtml?: string }>;
      total: number;
      completed: number;
      hasContent: boolean;
      isCompleted: boolean;
      isFailed: boolean;
    }> => {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) {
        if (res.status === 404) return { sections: [], total: 0, completed: 0, hasContent: false, isCompleted: false, isFailed: false };
        const text = await res.text();
        if (res.status === 401) throw new Error("Session expired. Please sign in again.");
        const isHtml = text.trimStart().startsWith("<");
        const errMessage = isHtml
          ? `Server error (${res.status}). Please try again in a moment or check the app is running.`
          : (() => {
              const trimmed = text.trim();
              if (trimmed.length > 1 && trimmed.startsWith("{")) {
                try {
                  const parsed = JSON.parse(trimmed) as { error?: string };
                  return parsed?.error ?? (trimmed.slice(0, 200) || `Request failed (${res.status})`);
                } catch {
                  // fall through
                }
              }
              return trimmed.slice(0, 200) || `Request failed (${res.status})`;
            })();
        throw new Error(errMessage);
      }
      const product = await parseJsonResponse<{
        status?: string;
        content?: { sections?: Array<{ content?: string; contentHtml?: string }> };
      }>(res);
      const sections = product.content?.sections ?? [];
      const total = Array.isArray(sections) ? sections.length : 0;
      const completed = Array.isArray(sections)
        ? sections.filter((s) => ((s?.content ?? s?.contentHtml ?? "").trim().length > 0)).length
        : 0;
      const hasContent = total > 0 && completed === total;
      const isCompleted = product.status === "draft" && hasContent;
      const isFailed = product.status === "failed";
      return {
        status: product.status,
        sections,
        total,
        completed,
        hasContent,
        isCompleted,
        isFailed,
      };
    };

    while (true) {
      if (Date.now() - pollStart > timeoutMs) {
        const last = await fetchAndParse().catch(() => null);
        if (last?.isCompleted) {
          return { outcome: "completed", productId };
        }
        return { outcome: "timeout_still_generating", productId };
      }
      const data = await fetchAndParse();
      if (data.total > 0) setGenerateProgress({ total: data.total, completed: data.completed });
      if (data.isFailed) return { outcome: "failed", productId, error: "Product generation failed. Please try again." };
      if (data.isCompleted) return { outcome: "completed", productId };
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  };

  const BUNDLE_POLL_TIMEOUT_MS = 20 * 60 * 1000;
  const AUTO_RETRY_DELAY_MS = 3000;

  const pollBundleProductUntilDone = async (productId: string): Promise<"done" | "failed"> => {
    const start = Date.now();
    const fetchStatus = async (): Promise<{ isCompleted: boolean; isFailed: boolean }> => {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) return { isCompleted: false, isFailed: res.status >= 400 };
      const data = await res.json().catch(() => ({}));
      const status = data?.status;
      const sections = data?.content?.sections ?? [];
      const hasContent = sections.length > 0 && sections.every((s: { content?: string; contentHtml?: string }) => ((s?.content ?? s?.contentHtml ?? "").trim().length > 0));
      return { isCompleted: status === "draft" && hasContent, isFailed: status === "failed" };
    };
    while (Date.now() - start < BUNDLE_POLL_TIMEOUT_MS) {
      const { isCompleted, isFailed } = await fetchStatus();
      if (isFailed) return "failed";
      if (isCompleted) return "done";
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    const last = await fetchStatus();
    return last.isCompleted ? "done" : "failed";
  };

  /** Poll until done/failed; if failed, auto-retry once after 3s then poll again. */
  const pollBundleProductWithAutoRetry = async (
    productId: string,
    retryBody: { niche: string; productName: string; format: string; subFocus?: string }
  ): Promise<"done" | "failed"> => {
    let result = await pollBundleProductUntilDone(productId);
    if (result === "failed") {
      await new Promise((r) => setTimeout(r, AUTO_RETRY_DELAY_MS));
      const retryRes = await fetch(`/api/products/${productId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retry: true,
          niche: retryBody.niche,
          productName: retryBody.productName,
          format: retryBody.format,
          subFocus: retryBody.subFocus ?? undefined,
        }),
      });
      if (retryRes.ok) result = await pollBundleProductUntilDone(productId);
    }
    return result;
  };

  /** Opens the design choice modal. Generation must only start after user picks an option. */
  const openDesignChoiceModal = () => {
    if (bundleGenerating) return;
    designChoiceModalBrandFetchedRef.current = false;
    setBundleDesignChoice(null);
    setShowDesignChoiceModal(true);
  };

  const startFullBundle = async () => {
    if (!bundleDesignChoice) {
      setShowDesignChoiceModal(true);
      return;
    }
    const nicheName = selectedNiche?.name ?? customNiche.trim();
    if (!nicheName) {
      toast({ title: "No topic", description: "Select or enter a niche first.", variant: "destructive" });
      return;
    }
    setBundleError(null);
    setBundleDialogDismissed(false);
    setBundleGenerating(true);
    setBundleNiche(nicheName);
    try {
      const res = await fetch("/api/products/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: nicheName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to start bundle");
      const items = (data.items ?? []).map((item: { productId: string; format: string; label: string; subFocus?: string }) => ({
        ...item,
        status: "generating" as const,
        subFocus: item.subFocus,
      }));
      setBundleItems(items);
      const updateBundleItem = (productId: string, status: "done" | "failed") => {
        setBundleItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, status } : i)));
      };
      // Poll all 8 in parallel — server already generates them all simultaneously,
      // so we must watch all at once or we waste time waiting for batches sequentially.
      const results = await Promise.all(
        items.map(async (item: { productId: string; format: string; label: string; status: "generating" | "done" | "failed"; subFocus?: string }) => {
          const result = await pollBundleProductWithAutoRetry(item.productId, {
            niche: nicheName,
            productName: item.label,
            format: item.format,
            subFocus: item.subFocus,
          });
          updateBundleItem(item.productId, result);
          return result;
        })
      );
      setBundleComplete(true);
      const failed = results.filter((r) => r === "failed").length;
      if (failed > 0) {
        toast({ title: "Partially complete", description: `${failed} format(s) failed. You can retry them below.` });
      } else {
        toast({ title: "Bundle complete", description: "All 8 products are in My Library." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate bundle";
      setBundleError(msg);
      toast({ title: "Bundle failed", description: msg, variant: "destructive" });
    } finally {
      setBundleGenerating(false);
    }
  };

  const handleRetryBundleItem = async (item: { productId: string; format: string; label: string; subFocus?: string }) => {
    setBundleItems((prev) => prev.map((i) => (i.productId === item.productId ? { ...i, status: "generating" as const } : i)));
    try {
      const res = await fetch(`/api/products/${item.productId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retry: true,
          niche: bundleNiche,
          productName: item.label,
          format: item.format,
          subFocus: item.subFocus ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Retry failed");
      }
      const result = await pollBundleProductUntilDone(item.productId);
      setBundleItems((prev) => prev.map((i) => (i.productId === item.productId ? { ...i, status: result } : i)));
      if (result === "done") toast({ title: "Done", description: `${item.label} generated successfully.` });
      else toast({ title: "Retry failed", description: `${item.label} failed again. Try again later.`, variant: "destructive" });
    } catch (err) {
      setBundleItems((prev) => prev.map((i) => (i.productId === item.productId ? { ...i, status: "failed" as const } : i)));
      toast({ title: "Retry failed", description: err instanceof Error ? err.message : "Could not retry.", variant: "destructive" });
    }
  };

  const closeBundleDialog = () => {
    setBundleDialogDismissed(true);
    setBundleItems([]);
    setBundleComplete(false);
    setBundleError(null);
    setBundleDesignChoice(null);
    setBundleBrandProfile(null);
    setApplyingDesign(false);
    setDesignApplied(false);
    appliedDesignRunRef.current = false;
  };

  // When design choice modal opens, fetch brand profile once
  useEffect(() => {
    if (!showDesignChoiceModal || designChoiceModalBrandFetchedRef.current) return;
    designChoiceModalBrandFetchedRef.current = true;
    let cancelled = false;
    fetch("/api/brand-profile")
      .then((res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setBundleBrandProfile(null);
          return;
        }
        if (!res.ok) return;
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setBundleBrandProfile({
          primaryColor: data.primaryColor ?? "#1a1a1a",
          secondaryColor: data.secondaryColor ?? "#475569",
          tiktokUrl: data.tiktokUrl,
          instagramUrl: data.instagramUrl,
          youtubeUrl: data.youtubeUrl,
          facebookUrl: data.facebookUrl,
          websiteUrl: data.websiteUrl,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showDesignChoiceModal]);

  // When bundle is complete: for 'manual' skip apply-design; for 'ai'/'brand' apply design (once)
  useEffect(() => {
    if (!bundleComplete || bundleItems.length === 0 || designApplied || appliedDesignRunRef.current) return;
    const choice = bundleDesignChoice ?? "manual";
    if (choice === "manual") {
      appliedDesignRunRef.current = true;
      setDesignApplied(true);
      return;
    }
    const doneIds = bundleItems.filter((i) => i.status === "done").map((i) => i.productId);
    if (doneIds.length === 0) return;
    appliedDesignRunRef.current = true;
    const useBrand = choice === "brand";
    setApplyingDesign(true);
    Promise.all(
      doneIds.map((id) =>
        fetch(`/api/products/${id}/apply-design`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ useBrandColors: useBrand }),
        })
      )
    )
      .then(() => {
        setDesignApplied(true);
        toast({ title: "Design applied", description: "All products are styled and ready in My Library." });
      })
      .catch(() => {
        toast({ title: "Design could not be applied", description: "You can still open My Library and use Auto-Design on each product.", variant: "destructive" });
        setDesignApplied(true);
      })
      .finally(() => setApplyingDesign(false));
  }, [bundleComplete, bundleItems, bundleDesignChoice, designApplied, toast]);

  const handleCreateProduct = async (alsoGenerateVideos = false) => {
    if (!productFormat) {
      toast({
        title: "Select a format",
        description: "Please select a product format first.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedProduct) {
      toast({
        title: "Select a product",
        description: "Please select a product idea first.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setCreateError(null);
    setGenerateStepIndex(0);
    setGenerateProgress(null);

    const stepInterval = setInterval(() => {
      setGenerateStepIndex((i) => Math.min(i + 1, GENERATE_STEPS.length - 1));
    }, 4000);

    try {
      const nicheName = selectedNiche?.name ?? "";
      const baseDescription = selectedProduct
        ? `${selectedProduct.included}. ${selectedProduct.why} Target: ${nicheName}.`
        : "";
      const spreadsheetDisclaimer = "⚠️ This is a step-by-step tutorial guide (PDF). You will learn how to create this spreadsheet yourself in Excel or Google Sheets. This is NOT a pre-made spreadsheet file - it's an educational guide that teaches you valuable Excel skills.";
      const productDescription =
        productFormat === "spreadsheet"
          ? `${baseDescription} ${spreadsheetDisclaimer}`.trim()
          : baseDescription;
      const hooks = salesGuide?.hooks?.map((h) => ({ text: h.text, whyItWorks: h.whyItWorks })) ?? [];
      const ctas = salesGuide?.ctas?.map((c) => ({ text: c.text, whyItWorks: c.whyItWorks })) ?? [];

      const response = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: selectedNiche ?? nicheName,
          product: selectedProduct,
          productName: selectedProduct.name,
          productDescription,
          productIncluded: selectedProduct.included ?? "",
          productWhy: selectedProduct.why ?? "",
          format: productFormat,
          hooks,
          ctas,
          customizationOptions: customization,
        }),
      });

      const data = await parseJsonResponse<{ productId?: string; error?: string }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate product");
      }

      const productId = data.productId;
      if (!productId) throw new Error("No product ID returned");

      try {
        localStorage.setItem("discovery-product-id", productId);
      } catch {
        // ignore
      }

      const TIMEOUT_MS = 20 * 60 * 1000; // 20 min — poll until then; on timeout show "Still generating" if not done
      const result = await runPollLoop(productId, TIMEOUT_MS);

      clearInterval(stepInterval);
      if (result.outcome === "completed") {
        // Redirect immediately with no delay so user lands in the editor as soon as generation is done
        if (alsoGenerateVideos) {
          router.push(`/dashboard/digital-products/scripts?productId=${encodeURIComponent(result.productId)}&intent=video-guide${facelessOrPersonal ? `&contentStyle=${facelessOrPersonal}` : ""}`);
        } else {
          router.push(`/dashboard/digital-products/${result.productId}/edit?created=1`);
        }
        setGenerating(false);
        setGenerateProgress(null);
        setGenerateStepIndex(GENERATE_STEPS.length - 1);
        return;
      }
      if (result.outcome === "failed") {
        setCreateError(result.error ?? "Product generation failed. Please try again.");
        toast({ title: "Generation failed", description: result.error, variant: "destructive" });
        return;
      }
      if (result.outcome === "timeout_still_generating") {
        setTimeoutStillGenerating(result.productId);
        return;
      }
    } catch (err) {
      console.error("Product generation failed:", err);
      const message = err instanceof Error ? err.message : "Failed to generate product. Please try again.";
      setCreateError(message);
      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      clearInterval(stepInterval);
      setGenerating(false);
      setGenerateProgress(null);
      setGenerateStepIndex(0);
    }
  };

  const wrapperClass = "min-h-screen bg-background text-foreground";
  const cardClass = "border-border bg-card";

  if (!hasLoadedFromStorage) {
    return (
      <main className={wrapperClass}>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </main>
    );
  }

  return (
    <main className={wrapperClass}>
      {/* Generating product overlay - blocks entire screen, no navigation until complete */}
      {(generating || createError || timeoutStillGenerating) && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/98 backdrop-blur-md p-6" role="alert" aria-live="polite">
          {timeoutStillGenerating ? (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-2">Still generating...</h2>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                This may take a few more minutes. You can check My Library for your product or keep waiting here.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted"
                  onClick={() => {
                    setTimeoutStillGenerating(null);
                    router.push("/dashboard/digital-products");
                  }}
                >
                  Go to My Library
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={async () => {
                    const id = timeoutStillGenerating;
                    if (!id) return;
                    setGenerating(true);
                    setTimeoutStillGenerating(null);
                    setCreateError(null);
                    const stepInterval = setInterval(
                      () => setGenerateStepIndex((i) => Math.min(i + 1, GENERATE_STEPS.length - 1)),
                      4000
                    );
                    try {
                      const result = await runPollLoop(id, 30 * 60 * 1000);
                      if (result.outcome === "completed") {
                        router.push(`/dashboard/digital-products/${result.productId}/edit?created=1`);
                        setGenerateStepIndex(GENERATE_STEPS.length - 1);
                        return;
                      }
                      if (result.outcome === "failed") {
                        setCreateError(result.error ?? "Product generation failed.");
                        toast({ title: "Generation failed", description: result.error, variant: "destructive" });
                        return;
                      }
                      if (result.outcome === "timeout_still_generating") {
                        setTimeoutStillGenerating(result.productId);
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "Failed to check status.";
                      setCreateError(msg);
                      toast({ title: "Error", description: msg, variant: "destructive" });
                    } finally {
                      clearInterval(stepInterval);
                      setGenerating(false);
                      setGenerateProgress(null);
                      setGenerateStepIndex(0);
                    }
                  }}
                >
                  Keep waiting
                </Button>
              </div>
            </>
          ) : createError ? (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-2">Generation Failed</h2>
              <p className="text-red-400 text-center max-w-md mb-6">{createError}</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted"
                  onClick={() => setCreateError(null)}
                >
                  Dismiss
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={() => {
                    setCreateError(null);
                    handleCreateProduct();
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-1">
                Generating your {productFormat ? FORMAT_LABELS[productFormat] ?? "Product" : "Product"}...
              </h2>
              <p className="text-orange-500 font-medium mb-2">{selectedProduct?.name ?? "Product"}</p>
              {generateProgress && generateProgress.total > 0 && (
                <p className="text-muted-foreground text-sm mb-6">
                  Generating chapter {Math.min(generateProgress.completed + 1, generateProgress.total)} of {generateProgress.total}...
                </p>
              )}
              {(!generateProgress || generateProgress.total === 0) && <div className="mb-6" />}
              <div className="w-full max-w-sm space-y-3">
                {GENERATE_STEPS.map((label, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    {i < generateStepIndex ? (
                      <Check className="w-5 h-5 text-green-500 shrink-0" />
                    ) : i === generateStepIndex ? (
                      <Loader2 className="w-5 h-5 text-orange-500 animate-spin shrink-0" />
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-border shrink-0" />
                    )}
                    <span className={i <= generateStepIndex ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-8">
                {productFormat === "workbook"
                  ? "Creating comprehensive workbook with exercises and worksheets... May take 1–3 minutes."
                  : productFormat === "course"
                    ? "Creating course outline with modules and lessons... May take 1–2 minutes."
                    : "Polling every few seconds. Longer products may take several minutes—you can stay or check My Library if it takes a while."
              }
              </p>
            </>
          )}
        </div>
      )}

      {/* Resume or Start Fresh modal */}
      <Dialog open={showResumeModal} onOpenChange={(open) => !open && setShowResumeModal(false)}>
        <DialogContent className="max-w-[600px] border-border bg-card text-foreground" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl text-foreground">Welcome back!</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {savedProductId
                ? "You have a product in progress. Open it in the editor or start a new discovery."
                : "You have an in-progress discovery session. Continue where you left off or start fresh."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <button
              type="button"
              onClick={handleResume}
              className="flex w-full items-start gap-4 rounded-lg border-2 border-orange-500 bg-muted p-5 text-left transition-all hover:border-orange-500 hover:bg-orange-500/10 hover:-translate-y-0.5"
            >
              <Play className="h-8 w-8 shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground">{savedProductId ? "Open in editor" : "Continue where you left off"}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {savedProductId ? "Go directly to the product editor to finish designing your product." : "Resume with all your generated content and progress saved."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  • Step {step} of 6
                  <br />
                  • {allNiches.length} niches explored
                  {selectedNiche ? (
                    <>
                      <br />• Selected: {selectedNiche.name}
                    </>
                  ) : null}
                  {selectedProduct ? (
                    <>
                      <br />• Product: {selectedProduct.name}
                    </>
                  ) : null}
                  {productFormat ? (
                    <>
                      <br />• Format: {productFormat}
                    </>
                  ) : null}
                  <br />• All selections preserved
                  {interests.trim().slice(0, 30) ? (
                    <>
                      <br />• &ldquo;{interests.trim().slice(0, 30)}…&rdquo;
                    </>
                  ) : null}
                </p>
              </div>
            </button>
            <div className="text-center text-xs text-muted-foreground">or</div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("Start fresh? Your previous discovery progress will be deleted.")) {
                  handleStartFresh();
                }
              }}
              className="flex w-full items-start gap-4 rounded-lg border-2 border-border bg-muted p-5 text-left transition-all hover:border-muted-foreground/50 hover:bg-muted"
            >
              <Sparkles className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground">Start fresh</div>
                <p className="mt-1 text-sm text-muted-foreground">Begin a new discovery session (previous work will be deleted).</p>
              </div>
            </button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button variant="ghost" className="text-muted-foreground" onClick={() => router.push("/dashboard/digital-products")}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-3xl mx-auto p-6 md:p-10 pb-24">
        {/* Top nav: Dashboard + Digital Products so main app nav is discoverable */}
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-sm">
          <Link href="/dashboard" className="text-muted-foreground hover:text-orange-500 transition-colors">
            Dashboard
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/dashboard/digital-products" className="text-muted-foreground hover:text-orange-500 transition-colors">
            Digital Products
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">Discover</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <Link
            href="/dashboard/digital-products"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-orange-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Digital Products
          </Link>
          {step > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500/90 hover:text-red-400 hover:bg-red-500/10"
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("Start over? This will delete all your discovery progress.")) {
                  handleStartFresh();
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Start over
            </Button>
          )}
        </div>

        {/* Progress bar: fills proportionally from step 1 (~14%) to step 7 (100%), brand amber #F59E0B */}
        <div className="mb-8 [&>div>div]:bg-[#F59E0B]">
          <Progress value={progressForStep(step)} className="h-2 bg-muted" />
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 1 of 7</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">Tell Us About You</h1>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-foreground">What topics interest you?</Label>
                <Textarea
                  placeholder="e.g., fitness, budgeting, productivity, travel, parenting, design..."
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  rows={4}
                  disabled={dontKnowYet}
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground resize-none disabled:opacity-60"
                />
                <p className="text-xs text-muted-foreground">Don&apos;t overthink it - just list things you know about or enjoy</p>
                <label className="flex items-center gap-2 cursor-pointer mt-3">
                  <Checkbox
                    checked={dontKnowYet}
                    onCheckedChange={(checked) => {
                      setDontKnowYet(!!checked);
                      if (checked) setInterests("");
                    }}
                    className="border-border data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <span className="text-sm text-foreground">I&apos;m not sure yet — show me what&apos;s selling well</span>
                </label>
              </div>
              <div className="space-y-3">
                <Label className="text-foreground">What&apos;s your goal?</Label>
                <RadioGroup value={goal} onValueChange={setGoal} className="grid gap-3">
                  {STEP_GOALS.map((g) => (
                    <label
                      key={g.value}
                      htmlFor={`goal-${g.value}`}
                      onClick={() => setGoal(g.value)}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-muted-foreground/40 hover:bg-muted has-[:checked]:border-orange-500 has-[:checked]:bg-orange-500/10"
                    >
                      <RadioGroupItem
                        id={`goal-${g.value}`}
                        value={g.value}
                        className="border-2 border-border bg-background text-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-500/20 data-[state=checked]:text-orange-500 shrink-0"
                      />
                      <span className="text-sm text-foreground pointer-events-none">{g.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex flex-col items-end gap-2 pt-2">
                {!goal && (
                  <p className="text-xs text-amber-500/90">Select a goal to continue</p>
                )}
                {goal && !dontKnowYet && interests.trim().length > 0 && interests.trim().length < 3 && (
                  <p className="text-xs text-amber-500/90">Enter at least 3 characters</p>
                )}
                <Button
                  type="button"
                  className="bg-orange-500 hover:bg-orange-600 text-foreground font-medium gap-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500"
                  onClick={handleStep2Start}
                  disabled={!canProceedStep1}
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 2 of 7</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Pick Your Niche</h1>
            {dontKnowYet ? (
              <p className="text-muted-foreground mb-8">Here are the hottest opportunities right now 🔥</p>
            ) : (
              <p className="text-muted-foreground mb-8">Based on your interests: {interests.trim() || "—"}</p>
            )}

            {nicheLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">{dontKnowYet ? "Loading trending niches..." : "Finding niches that match your interests..."}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Saturation:</span>
                  <select value={saturationFilter} onChange={(e) => setSaturationFilter(e.target.value)} className="rounded-lg bg-background border border-border text-foreground text-xs px-3 py-1.5">
                    <option value="all">All</option>
                    <option value="low">🟢 Low only</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🟠 High</option>
                    <option value="veryHigh">🔴 Very high</option>
                  </select>
                  <span className="text-xs font-medium text-muted-foreground ml-2">Revenue:</span>
                  <select value={revenueFilter} onChange={(e) => setRevenueFilter(e.target.value)} className="rounded-lg bg-background border border-border text-foreground text-xs px-3 py-1.5">
                    <option value="all">All</option>
                    <option value="1-2k">$500–2k/mo</option>
                    <option value="2-5k">$2–5k/mo</option>
                    <option value="5k+">$5k+/mo</option>
                  </select>
                  <span className="text-xs font-medium text-muted-foreground ml-2">Sort:</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "opportunity" | "competition" | "revenue")} className="rounded-lg bg-background border border-border text-foreground text-xs px-3 py-1.5">
                    <option value="opportunity">Best opportunity</option>
                    <option value="competition">Lowest competition</option>
                    <option value="revenue">Highest revenue</option>
                  </select>
                </div>

                {(saturationFilter !== "all" || revenueFilter !== "all") && (
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredAndSortedNiches.length} of {allNiches.length} niches
                  </p>
                )}

                {filteredAndSortedNiches.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-muted-foreground mb-4">No niches match your filters.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground hover:bg-muted"
                      onClick={() => {
                        setSaturationFilter("all");
                        setRevenueFilter("all");
                        setCurrentPage(0);
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                <div className="grid gap-4">
                  {displayedNiches.map((n) => {
                    const sat = SATURATION_LEVELS[normalizeSaturation(n.saturation)] ?? SATURATION_LEVELS.medium;
                    const trendLabel = n.trend === "rising" ? "📈 Rising" : n.trend === "declining" ? "📉 Declining" : "➡️ Stable";
                    return (
                      <Card key={n.id} className={cardClass}>
                        <CardContent className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <h3 className="font-semibold text-foreground">{n.name}</h3>
                            <span className={`text-xs font-medium px-2 py-1 rounded-md border ${sat.className}`}>
                              {sat.emoji} {sat.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                            <span>💰 Revenue: {n.revenue}</span>
                            <span>👥 Competition: {n.competition}</span>
                            <span>{trendLabel}</span>
                          </div>
                          {n.subNiches?.length > 0 && (
                            <p className="text-xs text-[#888] mb-2">Angles: {n.subNiches.join(" · ")}</p>
                          )}
                          <p className="text-sm text-muted-foreground mb-4">Why this works: {n.why}</p>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 cursor-pointer"
                            onClick={() => {
                              handleSelectNiche(n);
                              setStep(3);
                            }}
                          >
                            Select This Niche
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                )}

                {/* Pagination: only show when there are niches and more than one page */}
                {filteredAndSortedNiches.length > 0 && totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-4 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground hover:bg-card"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      ← Previous Niches
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <span className="text-muted-foreground">({filteredAndSortedNiches.length} total)</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground hover:bg-card"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={currentPage >= totalPages - 1}
                    >
                      Next Niches →
                    </Button>
                  </div>
                )}

                {/* Page dots for quick jump */}
                {filteredAndSortedNiches.length > 0 && totalPages > 1 && totalPages <= 10 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        aria-label={`Page ${idx + 1}`}
                        onClick={() => setCurrentPage(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === currentPage ? "w-6 bg-orange-500" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Progress and no-limit messaging */}
                {allNiches.length > 0 && (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">
                      You&apos;ve explored {allNiches.length} niches across {totalPages} page{totalPages !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Keep generating until you find the perfect fit — there&apos;s no limit!
                    </p>
                  </div>
                )}

                {generateError && (
                  <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-500/10">
                    <AlertDescription className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{generateError}</span>
                        <Button size="sm" variant="outline" className="border-red-500/50 shrink-0" onClick={() => { setGenerateError(null); handleStep2Start(); }} disabled={nicheLoading}>
                          {nicheLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Retry"}
                        </Button>
                      </div>
                      {allNiches.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-1">You can still continue by entering your own niche below.</p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <Button variant="outline" className="w-full border-border text-muted-foreground hover:bg-card" onClick={handleGenerateMoreNiches} disabled={moreNichesLoading}>
                  {moreNichesLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Finding more opportunities...
                    </>
                  ) : (
                    <>
                      ✨ Show Me 6 More Niches
                      {allNiches.length > 0 && (
                        <span className="text-sm ml-2 text-muted-foreground">({allNiches.length} generated so far)</span>
                      )}
                    </>
                  )}
                </Button>

                <div className="mt-6 space-y-3">
                  <Label className="text-muted-foreground">Or enter your own niche (min 3 characters)</Label>
                  <Input
                    placeholder="e.g. Budgeting for freelancers"
                    value={customNiche}
                    onChange={(e) => setCustomNiche(e.target.value)}
                    className="bg-card border-border text-foreground placeholder:text-muted-foreground"
                  />
                  {customNiche.trim().length > 0 && customNiche.trim().length < 3 && (
                    <p className="text-xs text-amber-500/90">Enter at least 3 characters</p>
                  )}
                </div>

                <div className="flex justify-between mt-6">
                  <Button variant="ghost" className="text-muted-foreground" onClick={() => setStep(1)}>← Back</Button>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      if (!selectedNiche && customNiche.trim().length >= 3) {
                        setSelectedNiche({
                          id: "custom",
                          name: customNiche.trim(),
                          demand: "",
                          competition: "",
                          revenue: "",
                          why: "",
                          saturation: "low",
                          trend: "stable",
                          subNiches: [],
                        });
                      }
                      setStep(3);
                    }}
                    disabled={!canProceedStep2}
                  >
                    Next: Choose Product <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 3 of 7</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Choose a Product</h1>
            <p className="text-muted-foreground mb-6">Based on niche: {selectedNiche?.name ?? "Your niche"}</p>

            {productSuggestionsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating product ideas…</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <label className="text-sm text-muted-foreground">Price:</label>
                  <select
                    value={productPriceFilter}
                    onChange={(e) => { setProductPriceFilter(e.target.value); setProductCurrentPage(0); }}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                  >
                    <option value="all">All</option>
                    <option value="under20">Under $20</option>
                    <option value="20-50">$20–50</option>
                    <option value="50+">$50+</option>
                  </select>
                  <label className="text-sm text-muted-foreground ml-2">Type:</label>
                  <select
                    value={productTypeFilter}
                    onChange={(e) => { setProductTypeFilter(e.target.value); setProductCurrentPage(0); }}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                  >
                    <option value="all">All</option>
                    <option value="Templates">Templates</option>
                    <option value="Guides">Guides</option>
                    <option value="Courses">Courses</option>
                    <option value="Planners">Planners</option>
                  </select>
                  <label className="text-sm text-muted-foreground ml-2">Sort:</label>
                  <select
                    value={productSortBy}
                    onChange={(e) => { setProductSortBy(e.target.value as "potential" | "lowest" | "highest" | "easiest"); setProductCurrentPage(0); }}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                  >
                    <option value="potential">Best seller potential</option>
                    <option value="lowest">Lowest price</option>
                    <option value="highest">Highest price</option>
                    <option value="easiest">Easiest to create</option>
                  </select>
                </div>

                {(productPriceFilter !== "all" || productTypeFilter !== "all") && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Showing {filteredAndSortedProducts.length} of {allProductSuggestions.length || MOCK_PRODUCTS.length} products
                  </p>
                )}

                {filteredAndSortedProducts.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-muted-foreground mb-4">No products match your filters.</p>
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground" onClick={() => { setProductPriceFilter("all"); setProductTypeFilter("all"); setProductCurrentPage(0); }}>
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {displayedProducts.map((p) => (
                      <Card key={p.id} className={cardClass}>
                        <CardContent className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-foreground">{p.name}</h3>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {getProductTypeIcon(p.type)} {p.type}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {p.complexity && (
                              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                {p.complexity}
                              </span>
                            )}
                            {p.estimatedTime && (
                              <span className="text-xs text-muted-foreground">{p.estimatedTime}</span>
                            )}
                          </div>
                          <p className="text-xs text-orange-500 mb-0.5">Suggested Price: {p.price}</p>
                          {p.priceNote && <p className="text-xs text-muted-foreground mb-2">{p.priceNote}</p>}
                          <p className="text-sm text-muted-foreground mb-1">What&apos;s included:</p>
                          <p className="text-sm text-foreground mb-3">{p.included}</p>
                          <p className="text-sm text-muted-foreground mb-4">Why it sells: {p.why}</p>
                          <Button
                            type="button"
                            size="sm"
                            className="relative z-10 cursor-pointer bg-orange-500 hover:bg-orange-600"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectProduct(p);
                              setStep(4);
                            }}
                          >
                            Create This Product
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {filteredAndSortedProducts.length > 0 && totalProductPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground hover:bg-card"
                      onClick={() => setProductCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={productCurrentPage === 0}
                    >
                      ← Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {productCurrentPage + 1} of {totalProductPages} ({filteredAndSortedProducts.length} products total)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground hover:bg-card"
                      onClick={() => setProductCurrentPage((p) => Math.min(totalProductPages - 1, p + 1))}
                      disabled={productCurrentPage >= totalProductPages - 1}
                    >
                      Next →
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full border-border text-muted-foreground hover:bg-card"
                  onClick={handleGenerateMoreProducts}
                  disabled={moreProductsLoading}
                >
                  {moreProductsLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Generating more…
                    </>
                  ) : (
                    <>
                      ✨ Generate 6 More Products
                      {(allProductSuggestions.length > 0 || MOCK_PRODUCTS.length > 0) && (
                        <span className="text-sm ml-2 text-muted-foreground">
                          ({(allProductSuggestions.length || MOCK_PRODUCTS.length)} total)
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </>
            )}

            {productSuggestionsError && !productSuggestionsLoading && (
              <p className="text-xs text-muted-foreground mt-2">{productSuggestionsError}</p>
            )}

            <div className="mt-6 space-y-3">
              <Label className="text-muted-foreground">Or enter your own product name</Label>
              <Input
                placeholder="e.g. My Budget Tracker"
                value={customProductName}
                onChange={(e) => setCustomProductName(e.target.value)}
                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setStep(2)}>← Back</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (!selectedProduct && customProductName.trim().length >= 1) {
                    setSelectedProduct({
                      id: "custom",
                      name: customProductName.trim(),
                      type: "Guides",
                      price: "TBD",
                      included: "",
                      why: "",
                    });
                  }
                  setStep(4);
                }}
                disabled={!canProceedStep3}
              >
                Next: Your Content Style <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {/* STEP 4: Your Content Style - clickable cards */}
        {step === 4 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 4 of 7</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-8">Your Content Style</h1>

            <p className="text-muted-foreground mb-6">How do you want to show up online?</p>
            <div className="grid gap-4">
              <button
                type="button"
                onClick={() => setFacelessOrPersonal("faceless")}
                className={`w-full rounded-xl border-2 p-6 text-left transition-all cursor-pointer hover:border-orange-500/50 ${
                  facelessOrPersonal === "faceless" ? "border-orange-500 bg-orange-500/10" : "border-border hover:bg-card"
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="flex items-center gap-2 mb-2 w-full justify-between">
                      <span className="flex items-center gap-2">
                        <User className="w-5 h-5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">Faceless Content</span>
                      </span>
                      {facelessOrPersonal === "faceless" && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-orange-500 bg-orange-500/20 px-2 py-1 rounded-full">
                          <Check className="w-3.5 h-3.5" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Best for: Privacy & anonymity, testing multiple niches, scalable content production.</p>
                    <p className="text-xs text-muted-foreground">Video styles: Text overlays on B-roll, screen recordings, animations & graphics.</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFacelessOrPersonal("personal")}
                className={`w-full rounded-xl border-2 p-6 text-left transition-all cursor-pointer hover:border-orange-500/50 ${
                  facelessOrPersonal === "personal" ? "border-orange-500 bg-orange-500/10" : "border-border hover:bg-card"
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="flex items-center gap-2 mb-2 w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-muted-foreground" />
                        <span className="font-semibold text-foreground">Personal Brand</span>
                      </span>
                      {facelessOrPersonal === "personal" && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-orange-500 bg-orange-500/20 px-2 py-1 rounded-full">
                          <Check className="w-3.5 h-3.5" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Best for: Building authority, long-term brand growth, trust & connection.</p>
                    <p className="text-xs text-muted-foreground">Video styles: Talking head (you on camera), behind-the-scenes, story-driven content.</p>
                  </div>
                </div>
              </button>
            </div>
            <div className="flex justify-between mt-8">
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setStep(3)}>← Back</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setStep(5)}
                disabled={facelessOrPersonal === null}
              >
                Next: Learn Hooks & CTAs <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            {facelessOrPersonal === null && (
              <p className="text-xs text-amber-500/90 mt-2">Select faceless or personal brand to continue</p>
            )}
          </>
        )}

        {/* STEP 5 - Master the Basics: full sales education */}
        {step === 5 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 5 of 7</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Master the Basics</h1>
            <p className="text-muted-foreground mb-6">
              A complete sales masterclass tailored to your product{selectedProduct ? `: ${selectedProduct.name}` : ""}.
            </p>

            {salesGuideLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Building your sales guide…</span>
              </div>
            ) : salesGuide ? (
              <Accordion type="multiple" className="w-full space-y-2 border border-border rounded-xl bg-card p-2">
                {/* 1. Product Overview */}
                <AccordionItem value="overview" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      Product Overview
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Product:</span> <span className="text-foreground">{salesGuide.productOverview.productName}</span></p>
                      <p><span className="text-muted-foreground">Format:</span> <span className="text-foreground">{salesGuide.productOverview.format}</span></p>
                      <p><span className="text-muted-foreground">Who it&apos;s for:</span> <span className="text-foreground">{salesGuide.productOverview.targetCustomer}</span></p>
                      <p><span className="text-muted-foreground">Transformation:</span> <span className="text-orange-500">{salesGuide.productOverview.transformation}</span></p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2. Pain Points */}
                <AccordionItem value="pain" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Pain Points (Why customers need this)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 text-sm text-foreground">
                      {salesGuide.painPoints.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-500">⚠️</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* 3. Solution */}
                <AccordionItem value="solution" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-500" />
                      Solution (How your product solves each pain)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-sm">
                      {salesGuide.solutions.map((s, i) => (
                        <div key={i} className="rounded-lg border border-border p-3">
                          <p className="text-amber-500/90 mb-1">Pain: {s.pain}</p>
                          <p className="text-green-500/90 flex items-center gap-1">✅ Solution: {s.solution}</p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 4. Key Benefits */}
                <AccordionItem value="benefits" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Key Benefits
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-foreground">
                      {salesGuide.keyBenefits.map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-green-500">✓</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* 5. Objection Handling */}
                <AccordionItem value="objections" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-orange-500" />
                      Objection Handling
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-sm">
                      {salesGuide.objections.map((o, i) => (
                        <div key={i} className="rounded-lg border border-border p-3 space-y-1">
                          <p className="text-muted-foreground">Objection: &ldquo;{o.objection}&rdquo;</p>
                          <p className="text-green-500/90 pl-2 border-l-2 border-green-500/50">→ {o.answer}</p>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-[#888] mt-1" onClick={() => copyToClipboard(`${o.objection}\n\nAnswer: ${o.answer}`, `obj-${i}`)}>
                            {copyFeedback === `obj-${i}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />} Copy
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 6. Hooks */}
                <AccordionItem value="hooks" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    Hooks (The first 3 seconds)
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground mb-3">Why each hook works is listed below.</p>
                    <div className="space-y-3">
                      {salesGuide.hooks.map((h, i) => (
                        <div key={i} className="rounded-xl border-l-4 border-orange-500 bg-background p-4">
                          <p className="text-sm text-foreground mb-1">&ldquo;{h.text}&rdquo;</p>
                          <p className="text-xs text-[#888]">Why it works: {h.whyItWorks}</p>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-[#888] mt-2" onClick={() => copyToClipboard(h.text, `hook-${i}`)}>
                            {copyFeedback === `hook-${i}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />} Copy this hook
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 7. CTAs */}
                <AccordionItem value="ctas" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    CTAs (Tell them what to do)
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground mb-3">Psychology behind each CTA.</p>
                    <div className="space-y-3">
                      {salesGuide.ctas.map((c, i) => (
                        <div key={i} className="rounded-xl border-l-4 border-orange-500 bg-background p-4">
                          <p className="text-sm text-foreground mb-1">&ldquo;{c.text}&rdquo;</p>
                          <p className="text-xs text-[#888]">Why it works: {c.whyItWorks}</p>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-[#888] mt-2" onClick={() => copyToClipboard(c.text, `cta-${i}`)}>
                            {copyFeedback === `cta-${i}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />} Copy this CTA
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 8. Pricing Psychology */}
                <AccordionItem value="pricing" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    Pricing Psychology
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-foreground">
                      {salesGuide.pricingPsychology.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-orange-500">•</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* 9. Ideal Customer Profile */}
                <AccordionItem value="icp" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-orange-500" />
                      Ideal Customer Profile
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-foreground">
                      {salesGuide.idealCustomerProfile.map((item, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-orange-500">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* 10. Content Strategy */}
                <AccordionItem value="content" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    Content Strategy (Where to promote)
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-foreground">
                      {salesGuide.contentStrategy.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-orange-500">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* 11. Launch Strategy */}
                <AccordionItem value="launch" className="border-border px-3">
                  <AccordionTrigger className="text-foreground hover:no-underline hover:text-orange-500">
                    Launch Strategy
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-foreground">
                      {salesGuide.launchStrategy.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-orange-500">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              <div className="space-y-6 rounded-xl border border-border bg-card p-6">
                <p className="text-muted-foreground">
                  {selectedProduct
                    ? "Could not load the full sales guide. Here are generic hooks and CTAs you can use."
                    : "Select a product in Step 3 to get a full sales masterclass tailored to it. Meanwhile, here are general hooks and CTAs."}
                </p>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Hooks</h3>
                  <div className="space-y-2">
                    {HOOK_EXAMPLES.map((h, i) => (
                      <div key={i} className="rounded-xl border-l-4 border-orange-500 bg-background p-3 text-sm text-foreground">&ldquo;{h}&rdquo;</div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">CTAs</h3>
                  <div className="space-y-2">
                    {CTA_EXAMPLES.map((c, i) => (
                      <div key={i} className="rounded-xl border-l-4 border-orange-500 bg-background p-3 text-sm text-foreground">&ldquo;{c}&rdquo;</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-6 mb-8">Use this guide when creating your content—our AI will reference these patterns in your scripts.</p>

            <div className="flex justify-between">
              <Button variant="ghost" className="text-muted-foreground" onClick={() => setStep(4)}>← Back</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setStep(6)}
                disabled={!canProceedStep5}
              >
                Next: Choose Format <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            {selectedProduct && !salesGuide && salesGuideLoading && (
              <p className="text-xs text-amber-500/90 mt-2">Loading your sales guide…</p>
            )}
            {selectedProduct && !salesGuide && !salesGuideLoading && (
              <p className="text-xs text-amber-500/90 mt-2">Waiting for sales guide. If it doesn’t load, click Back and reselect your product.</p>
            )}
          </>
        )}

        {/* STEP 6: Choose Product Format */}
        {step === 6 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 6 of 7</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Choose product format</h1>
            <p className="text-muted-foreground mb-8">How should we package your content? We&apos;ll generate a format-specific product.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {PRODUCT_FORMATS.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setProductFormat(f.id)}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${
                      productFormat === f.id ? "border-orange-500 bg-orange-500/10" : "border-border bg-card hover:border-muted-foreground/40"
                    }`}
                  >
                    <Icon className="w-8 h-8 text-orange-500 mb-3" />
                    <p className="font-semibold text-foreground mb-1">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                    <p className="text-xs text-orange-500 mt-2">{productFormat === f.id ? "Selected" : "Select"}</p>
                  </button>
                );
              })}
            </div>

            <div className="mb-6">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:border-orange-500 gap-2"
                onClick={openDesignChoiceModal}
                disabled={bundleGenerating}
              >
                {bundleGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating all 8…
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    Generate all 8 formats at once →
                  </>
                )}
              </Button>
            </div>

            {productFormat === "course" && (
              <Card className={`${cardClass} mb-6`}>
                <CardContent className="p-5">
                  <p className="font-medium text-foreground mb-3">Course options</p>
                  <div className="space-y-3 text-sm">
                    <label className="flex items-center gap-2 text-foreground cursor-pointer">
                      <input type="checkbox" checked={courseIncludeAvatar} onChange={(e) => setCourseIncludeAvatar(e.target.checked)} className="rounded border-border bg-background text-orange-500" />
                      Include avatar presenter
                    </label>
                    <label className="flex items-center gap-2 text-foreground cursor-pointer">
                      <input type="checkbox" checked={courseVoiceOver} onChange={(e) => setCourseVoiceOver(e.target.checked)} className="rounded border-border bg-background text-orange-500" />
                      Generate AI voiceover
                    </label>
                    {courseVoiceOver && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Voice:</span>
                        <select value={courseVoiceType} onChange={(e) => setCourseVoiceType(e.target.value)} className="rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                          <option value="professional-female">Professional Female</option>
                          <option value="professional-male">Professional Male</option>
                          <option value="casual">Casual</option>
                        </select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setStep(5)}>← Back</Button>
              <Button
                type="button"
                className="relative z-10 cursor-pointer bg-orange-500 hover:bg-orange-600 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setStep(7)}
                disabled={!productFormat}
              >
                Next: Customize <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            {!productFormat && (
              <p className="text-xs text-amber-500/90 mt-2">Select a format to continue</p>
            )}

            {/* Bundle progress + design setup dialog is rendered once at the end of the page */}
          </>
        )}

        {/* STEP 7: Customize & Create */}
        {step === 7 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 7 of 7</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Customize product</h1>
            <p className="text-muted-foreground mb-6">Adjust these options to tailor the generated content. You can leave defaults as-is.</p>

            {/* Basic options */}
            <Card className={`${cardClass} mb-4`}>
              <CardContent className="p-5">
                <p className="font-semibold text-foreground mb-4">Basic</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {productFormat !== "spreadsheet" && (
                  <div>
                    <Label className="text-foreground">Number of chapters/sections</Label>
                    <select
                      value={productFormat === "planner" ? 7 : customization.numChapters}
                      onChange={(e) => setCustomization((c) => ({ ...c, numChapters: Number(e.target.value) }))}
                      className="mt-1.5 w-full rounded-lg bg-background border border-border text-foreground px-3 py-2 text-sm"
                      disabled={productFormat === "planner"}
                    >
                      {[3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    {productFormat === "planner" && (
                      <p className="text-xs text-muted-foreground mt-1">Planners use 7 sections (intro + 3 planning layouts + disclaimer).</p>
                    )}
                  </div>
                  )}
                  {productFormat !== "spreadsheet" && (
                  <div>
                    <Label className="text-foreground">Content length per chapter</Label>
                    <select
                      value={customization.contentLength}
                      onChange={(e) => setCustomization((c) => ({ ...c, contentLength: e.target.value as CustomizationOptions["contentLength"] }))}
                      className="mt-1.5 w-full rounded-lg bg-background border border-border text-foreground px-3 py-2 text-sm"
                    >
                      <option value="short">Short (~500 words)</option>
                      <option value="medium">Medium (~800 words)</option>
                      <option value="long">Long (~1200 words)</option>
                    </select>
                  </div>
                  )}
                  <div>
                    <Label className="text-foreground">Content style</Label>
                    <select
                      value={customization.contentStyle}
                      onChange={(e) => setCustomization((c) => ({ ...c, contentStyle: e.target.value as CustomizationOptions["contentStyle"] }))}
                      className="mt-1.5 w-full rounded-lg bg-background border border-border text-foreground px-3 py-2 text-sm"
                    >
                      <option value="text_only">Text only</option>
                      <option value="text_with_placeholders">Text with image placeholders</option>
                      <option value="text_with_ai_images">Text with AI-generated images</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-foreground">Tone</Label>
                    <select
                      value={customization.tone}
                      onChange={(e) => setCustomization((c) => ({ ...c, tone: e.target.value as CustomizationOptions["tone"] }))}
                      className="mt-1.5 w-full rounded-lg bg-background border border-border text-foreground px-3 py-2 text-sm"
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="academic">Academic</option>
                      <option value="friendly">Friendly</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedOptions((b) => !b)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-3"
            >
              {showAdvancedOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Advanced options
            </button>

            {showAdvancedOptions && (
              <Card className={`${cardClass} mb-6`}>
                <CardContent className="p-5 space-y-6">
                  {/* Ebook/Guide */}
                  {(productFormat === "ebook" || productFormat === "guide") && (
                    <div className="space-y-3">
                      <p className="font-medium text-foreground">Ebook / Guide</p>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customization.ebookGuide?.includeToc ?? true}
                          onChange={(e) => setCustomization((c) => ({
                            ...c,
                            ebookGuide: { ...(c.ebookGuide ?? DEFAULT_CUSTOMIZATION.ebookGuide!), includeToc: e.target.checked },
                          }))}
                          className="rounded border-border bg-background text-orange-500"
                        />
                        Include Table of Contents
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customization.ebookGuide?.includeIntroConclusion ?? true}
                          onChange={(e) => setCustomization((c) => ({
                            ...c,
                            ebookGuide: { ...(c.ebookGuide ?? DEFAULT_CUSTOMIZATION.ebookGuide!), includeIntroConclusion: e.target.checked },
                          }))}
                          className="rounded border-border bg-background text-orange-500"
                        />
                        Include introduction & conclusion chapters
                      </label>
                    </div>
                  )}
                  {/* Workbook */}
                  {productFormat === "workbook" && (
                    <div className="space-y-3">
                      <p className="font-medium text-foreground">Workbook</p>
                      <div>
                        <Label className="text-foreground text-sm">Exercises per section</Label>
                        <select
                          value={customization.workbook?.exercisesPerSection ?? 5}
                          onChange={(e) => setCustomization((c) => ({
                            ...c,
                            workbook: { ...(c.workbook ?? DEFAULT_CUSTOMIZATION.workbook!), exercisesPerSection: Number(e.target.value) },
                          }))}
                          className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm"
                        >
                          {[3, 5, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.workbook?.includeAnswerKey ?? false} onChange={(e) => setCustomization((c) => ({ ...c, workbook: { ...(c.workbook ?? DEFAULT_CUSTOMIZATION.workbook!), includeAnswerKey: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include answer key
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.workbook?.includeFillInBlanks ?? false} onChange={(e) => setCustomization((c) => ({ ...c, workbook: { ...(c.workbook ?? DEFAULT_CUSTOMIZATION.workbook!), includeFillInBlanks: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include fill-in blanks
                      </label>
                    </div>
                  )}
                  {/* Checklist */}
                  {productFormat === "checklist" && (
                    <div className="space-y-3">
                      <p className="font-medium text-foreground">Checklist Pack</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-foreground text-sm">Number of checklists</Label>
                          <select value={customization.checklist?.numChecklists ?? 5} onChange={(e) => setCustomization((c) => ({ ...c, checklist: { ...(c.checklist ?? DEFAULT_CUSTOMIZATION.checklist!), numChecklists: Number(e.target.value) } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                            {[3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-foreground text-sm">Items per checklist</Label>
                          <select value={customization.checklist?.itemsPerChecklist ?? 10} onChange={(e) => setCustomization((c) => ({ ...c, checklist: { ...(c.checklist ?? DEFAULT_CUSTOMIZATION.checklist!), itemsPerChecklist: Number(e.target.value) } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                            {[5, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.checklist?.includeProgressTracking ?? false} onChange={(e) => setCustomization((c) => ({ ...c, checklist: { ...(c.checklist ?? DEFAULT_CUSTOMIZATION.checklist!), includeProgressTracking: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include progress tracking
                      </label>
                    </div>
                  )}
                  {/* Course */}
                  {productFormat === "course" && (
                    <div className="space-y-3">
                      <p className="font-medium text-foreground">Course Outline</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-foreground text-sm">Number of modules</Label>
                          <select value={customization.course?.numModules ?? 5} onChange={(e) => setCustomization((c) => ({ ...c, course: { ...(c.course ?? DEFAULT_CUSTOMIZATION.course!), numModules: Number(e.target.value) } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                            {[3, 5, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-foreground text-sm">Lessons per module</Label>
                          <select value={customization.course?.lessonsPerModule ?? 3} onChange={(e) => setCustomization((c) => ({ ...c, course: { ...(c.course ?? DEFAULT_CUSTOMIZATION.course!), lessonsPerModule: Number(e.target.value) } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                            {[3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.course?.includeLearningObjectives ?? true} onChange={(e) => setCustomization((c) => ({ ...c, course: { ...(c.course ?? DEFAULT_CUSTOMIZATION.course!), includeLearningObjectives: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include learning objectives
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.course?.includeAssignments ?? true} onChange={(e) => setCustomization((c) => ({ ...c, course: { ...(c.course ?? DEFAULT_CUSTOMIZATION.course!), includeAssignments: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include assignments
                      </label>
                    </div>
                  )}
                  {/* Journal */}
                  {productFormat === "journal" && (
                    <div className="space-y-3">
                      <p className="font-medium text-foreground">Journal</p>
                      <div>
                        <Label className="text-foreground text-sm">Number of prompts</Label>
                        <select value={customization.journal?.numPrompts ?? 20} onChange={(e) => setCustomization((c) => ({ ...c, journal: { ...(c.journal ?? DEFAULT_CUSTOMIZATION.journal!), numPrompts: Number(e.target.value) } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                          {[10, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.journal?.includeLinedSpace ?? true} onChange={(e) => setCustomization((c) => ({ ...c, journal: { ...(c.journal ?? DEFAULT_CUSTOMIZATION.journal!), includeLinedSpace: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include lined writing space
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.journal?.includeReflectionQuestions ?? true} onChange={(e) => setCustomization((c) => ({ ...c, journal: { ...(c.journal ?? DEFAULT_CUSTOMIZATION.journal!), includeReflectionQuestions: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include reflection questions
                      </label>
                    </div>
                  )}
                  {/* Planner */}
                  {productFormat === "planner" && (
                    <div className="space-y-3">
                      <p className="font-medium text-foreground">Planner</p>
                      <div>
                        <Label className="text-foreground text-sm">Duration</Label>
                        <select value={customization.planner?.duration ?? "monthly"} onChange={(e) => setCustomization((c) => ({ ...c, planner: { ...(c.planner ?? DEFAULT_CUSTOMIZATION.planner!), duration: e.target.value as "weekly" | "monthly" | "quarterly" | "yearly" } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.planner?.includeGoalSetting ?? true} onChange={(e) => setCustomization((c) => ({ ...c, planner: { ...(c.planner ?? DEFAULT_CUSTOMIZATION.planner!), includeGoalSetting: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include goal-setting pages
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.planner?.includeHabitTracker ?? true} onChange={(e) => setCustomization((c) => ({ ...c, planner: { ...(c.planner ?? DEFAULT_CUSTOMIZATION.planner!), includeHabitTracker: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include habit tracker
                      </label>
                    </div>
                  )}
                  {/* Spreadsheet */}
                  {productFormat === "spreadsheet" && (
                    <div className="space-y-3">
                      <p className="font-medium text-foreground">Spreadsheet Template</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-foreground text-sm">Number of tutorials</Label>
                          <select value={customization.spreadsheet?.numTutorials ?? 5} onChange={(e) => setCustomization((c) => ({ ...c, spreadsheet: { ...(c.spreadsheet ?? DEFAULT_CUSTOMIZATION.spreadsheet!), numTutorials: Number(e.target.value) } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                            {[3, 5, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-foreground text-sm">Difficulty</Label>
                          <select value={customization.spreadsheet?.difficulty ?? "beginner"} onChange={(e) => setCustomization((c) => ({ ...c, spreadsheet: { ...(c.spreadsheet ?? DEFAULT_CUSTOMIZATION.spreadsheet!), difficulty: e.target.value as "beginner" | "intermediate" | "advanced" } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.spreadsheet?.includePracticeExercises ?? true} onChange={(e) => setCustomization((c) => ({ ...c, spreadsheet: { ...(c.spreadsheet ?? DEFAULT_CUSTOMIZATION.spreadsheet!), includePracticeExercises: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include practice exercises
                      </label>
                    </div>
                  )}
                  {/* Notion */}
                  {productFormat === "notion" && (
                    <div className="space-y-3">
                      <p className="font-medium text-foreground">Notion Template</p>
                      <div>
                        <Label className="text-foreground text-sm">Number of databases/views</Label>
                        <select value={customization.notion?.numDatabases ?? 5} onChange={(e) => setCustomization((c) => ({ ...c, notion: { ...(c.notion ?? DEFAULT_CUSTOMIZATION.notion!), numDatabases: Number(e.target.value) } }))} className="mt-1 w-full rounded-lg bg-background border border-border text-foreground px-3 py-1.5 text-sm">
                          {[3, 5, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                        <input type="checkbox" checked={customization.notion?.includeSetupInstructions ?? true} onChange={(e) => setCustomization((c) => ({ ...c, notion: { ...(c.notion ?? DEFAULT_CUSTOMIZATION.notion!), includeSetupInstructions: e.target.checked } }))} className="rounded border-border bg-background text-orange-500" />
                        Include setup instructions
                      </label>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="mb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:border-orange-500 gap-2"
                onClick={openDesignChoiceModal}
                disabled={bundleGenerating}
              >
                {bundleGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating all 8…
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    Generate all 8 formats at once →
                  </>
                )}
              </Button>
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setStep(6)}>← Back</Button>
              <Button
                type="button"
                className="relative z-10 cursor-pointer bg-orange-500 hover:bg-orange-600 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowVideoPromptModal(true);
                }}
                disabled={!productFormat || generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Create My Product →"
                )}
              </Button>
            </div>

            <Dialog open={showVideoPromptModal} onOpenChange={setShowVideoPromptModal}>
              <DialogContent className="bg-card border-border text-foreground max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg">Would you also like a Video Creation Guide?</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    We can generate a step-by-step guide showing you exactly how to create TikTok-style promotional videos for your product, including AI prompts, editing tips, and scene breakdowns.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-2 sm:gap-0 flex-col-reverse sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      setShowVideoPromptModal(false);
                      handleCreateProduct(false);
                    }}
                  >
                    Skip for now
                  </Button>
                  <Button
                    type="button"
                    className="bg-orange-500 hover:bg-orange-600 gap-2"
                    onClick={() => {
                      setShowVideoPromptModal(false);
                      handleCreateProduct(true);
                    }}
                  >
                    <Video className="w-4 h-4" />
                    Yes, create video guide
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* Design choice modal — shown as soon as user clicks "Generate all 8"; generation starts only after they pick an option */}
      <Dialog open={showDesignChoiceModal} onOpenChange={(open) => { if (!open) setShowDesignChoiceModal(false); }}>
        <DialogContent
          className="sm:max-w-md bg-card border-border text-foreground z-[100]"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => { setShowDesignChoiceModal(false); e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">Choose how to design your products</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Pick an option below. Generation will start only after you continue — we&apos;ll then apply your choice to all 8 products when they&apos;re ready. You can edit anything later in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
              <input type="radio" name="designChoice" checked={bundleDesignChoice === "ai"} onChange={() => setBundleDesignChoice("ai")} className="mt-0.5 text-orange-500" />
              <div>
                <span className="text-sm font-medium text-foreground">Auto-design for me</span>
                <p className="text-xs text-muted-foreground mt-0.5">AI picks colours, fonts, and background images based on your niche.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
              <input type="radio" name="designChoice" checked={bundleDesignChoice === "brand"} onChange={() => setBundleDesignChoice("brand")} className="mt-0.5 text-orange-500" />
              <div>
                <span className="text-sm font-medium text-foreground">Use my brand colours</span>
                <p className="text-xs text-muted-foreground mt-0.5">Uses your saved brand profile. {bundleBrandProfile === null && bundleDesignChoice === "brand" ? "Set up below first." : ""}</p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50">
              <input type="radio" name="designChoice" checked={bundleDesignChoice === "manual"} onChange={() => setBundleDesignChoice("manual")} className="mt-0.5 text-orange-500" />
              <div>
                <span className="text-sm font-medium text-foreground">I&apos;ll design manually</span>
                <p className="text-xs text-muted-foreground mt-0.5">Blank templates ready to edit in the library.</p>
              </div>
            </label>
          </div>
          {bundleDesignChoice === "brand" && bundleBrandProfile === null && (
            <div className="rounded-lg border border-border bg-background/80 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Set up your brand first</p>
              <div>
                <Label className="text-xs text-foreground">Primary colour</Label>
                <div className="flex gap-2 mt-1.5 items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="h-9 w-9 shrink-0 rounded-md border border-border bg-card hover:ring-2 hover:ring-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        style={{ backgroundColor: bundleBrandForm.primaryColor }}
                        aria-label="Pick primary colour"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 bg-card border-border" align="start">
                      <div className="[&_.react-colorful]:h-32 [&_.react-colorful]:w-44 [&_.react-colorful]:rounded-md">
                        <HexColorPicker
                          color={bundleBrandForm.primaryColor}
                          onChange={(c) => setBundleBrandForm((f) => ({ ...f, primaryColor: c }))}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="text"
                    value={bundleBrandForm.primaryColor}
                    onChange={(e) => setBundleBrandForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    className="h-9 w-24 font-mono text-sm bg-card border-border text-foreground"
                    placeholder="#1a1a1a"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-foreground">Secondary colour</Label>
                <div className="flex gap-2 mt-1.5 items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="h-9 w-9 shrink-0 rounded-md border border-border bg-card hover:ring-2 hover:ring-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        style={{ backgroundColor: bundleBrandForm.secondaryColor }}
                        aria-label="Pick secondary colour"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3 bg-card border-border" align="start">
                      <div className="[&_.react-colorful]:h-32 [&_.react-colorful]:w-44 [&_.react-colorful]:rounded-md">
                        <HexColorPicker
                          color={bundleBrandForm.secondaryColor}
                          onChange={(c) => setBundleBrandForm((f) => ({ ...f, secondaryColor: c }))}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="text"
                    value={bundleBrandForm.secondaryColor}
                    onChange={(e) => setBundleBrandForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                    className="h-9 w-24 font-mono text-sm bg-card border-border text-foreground"
                    placeholder="#475569"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-1">Social links (optional)</p>
              <Input type="url" value={bundleBrandForm.tiktokUrl} onChange={(e) => setBundleBrandForm((f) => ({ ...f, tiktokUrl: e.target.value }))} className="h-8 bg-card border-border text-foreground text-sm" placeholder="TikTok URL" />
              <Input type="url" value={bundleBrandForm.instagramUrl} onChange={(e) => setBundleBrandForm((f) => ({ ...f, instagramUrl: e.target.value }))} className="h-8 bg-card border-border text-foreground text-sm" placeholder="Instagram URL" />
              <Input type="url" value={bundleBrandForm.youtubeUrl} onChange={(e) => setBundleBrandForm((f) => ({ ...f, youtubeUrl: e.target.value }))} className="h-8 bg-card border-border text-foreground text-sm" placeholder="YouTube URL" />
              <Input type="url" value={bundleBrandForm.facebookUrl} onChange={(e) => setBundleBrandForm((f) => ({ ...f, facebookUrl: e.target.value }))} className="h-8 bg-card border-border text-foreground text-sm" placeholder="Facebook URL" />
              <Input type="url" value={bundleBrandForm.websiteUrl} onChange={(e) => setBundleBrandForm((f) => ({ ...f, websiteUrl: e.target.value }))} className="h-8 bg-card border-border text-foreground text-sm" placeholder="Website/Store URL" />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-border text-muted-foreground" onClick={() => setShowDesignChoiceModal(false)}>Cancel</Button>
            {bundleDesignChoice === "brand" && bundleBrandProfile === null ? (
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                disabled={bundleBrandFormSaving || !bundleBrandForm.primaryColor.trim() || !bundleBrandForm.secondaryColor.trim()}
                onClick={async () => {
                  setBundleBrandFormSaving(true);
                  try {
                    const res = await fetch("/api/brand-profile", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        primaryColor: bundleBrandForm.primaryColor.trim() || "#1a1a1a",
                        secondaryColor: bundleBrandForm.secondaryColor.trim() || "#475569",
                        tiktokUrl: bundleBrandForm.tiktokUrl.trim() || undefined,
                        instagramUrl: bundleBrandForm.instagramUrl.trim() || undefined,
                        youtubeUrl: bundleBrandForm.youtubeUrl.trim() || undefined,
                        facebookUrl: bundleBrandForm.facebookUrl.trim() || undefined,
                        websiteUrl: bundleBrandForm.websiteUrl.trim() || undefined,
                      }),
                    });
                    if (!res.ok) throw new Error("Failed to save");
                    const data = await res.json();
                    setBundleBrandProfile({ primaryColor: data.primaryColor ?? "#1a1a1a", secondaryColor: data.secondaryColor ?? "#475569", tiktokUrl: data.tiktokUrl, instagramUrl: data.instagramUrl, youtubeUrl: data.youtubeUrl, facebookUrl: data.facebookUrl, websiteUrl: data.websiteUrl });
                    setShowDesignChoiceModal(false);
                    toast({ title: "Brand saved", description: "Starting generation with your brand colours." });
                    startFullBundle();
                  } catch {
                    toast({ title: "Could not save brand", variant: "destructive" });
                  } finally {
                    setBundleBrandFormSaving(false);
                  }
                }}
              >
                {bundleBrandFormSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & start generating"}
              </Button>
            ) : (
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                disabled={!bundleDesignChoice}
                onClick={() => {
                  if (!bundleDesignChoice) return;
                  setShowDesignChoiceModal(false);
                  startFullBundle();
                }}
              >
                Continue
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full bundle progress dialog */}
      <Dialog open={((bundleGenerating || bundleItems.length > 0) && !bundleDialogDismissed)} onOpenChange={(open) => !open && closeBundleDialog()}>
        <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Layers className="w-5 h-5 text-orange-500" />
              Generate Full Bundle
            </DialogTitle>
                <DialogDescription className="text-muted-foreground">
              {bundleItems.length === 0
                ? "Starting all 8 formats for your topic…"
                : bundleComplete
                  ? bundleItems.some((i) => i.status === "failed")
                    ? "Partially complete. Retry failed formats below or view the rest in My Library."
                    : designApplied
                      ? "All products are ready in My Library."
                      : applyingDesign
                        ? "Applying your design…"
                        : bundleDesignChoice === "manual"
                          ? "All products are ready in My Library."
                          : "All products are ready. Applying your design…"
                  : "Generating each format. This may take several minutes."}
              {bundleDesignChoice && (
                <span className="block mt-1.5 text-xs">
                  Design: {bundleDesignChoice === "ai" ? "Auto" : bundleDesignChoice === "brand" ? "Brand colours" : "Manual (blank templates)"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {bundleError && (
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 text-red-400 px-3 py-2 text-sm mt-2">
              <XCircle className="w-4 h-4 shrink-0" />
              {bundleError}
            </div>
          )}
          {bundleItems.length > 0 && (
            <ul className="space-y-2 max-h-[280px] overflow-y-auto mt-3">
              {bundleItems.map((item) => (
                <li key={item.productId} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{item.label}</span>
                  {item.status === "generating" && (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating…
                    </span>
                  )}
                  {item.status === "done" && (
                    <span className="flex items-center gap-1.5 text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Done
                    </span>
                  )}
                  {item.status === "failed" && (
                    <span className="flex items-center gap-1.5 text-red-400">
                      <XCircle className="w-4 h-4 shrink-0" />
                      Failed
                      <Button type="button" variant="outline" size="sm" className="h-7 border-border text-muted-foreground hover:bg-muted hover:text-foreground shrink-0" onClick={() => handleRetryBundleItem(item)}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Retry
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {applyingDesign && (
            <div className="flex items-center gap-2 text-amber-400 text-sm mt-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying your design to all products…
            </div>
          )}
          {bundleComplete && designApplied && (
            <DialogFooter className="mt-4 sm:mt-6">
              <Button asChild className="bg-orange-500 hover:bg-orange-600">
                <Link href="/dashboard/library" onClick={closeBundleDialog}>View in My Library</Link>
              </Button>
              <Button variant="outline" className="border-border text-muted-foreground" onClick={closeBundleDialog}>Close</Button>
            </DialogFooter>
          )}
          {bundleComplete && !designApplied && !applyingDesign && (
            <DialogFooter className="mt-4 sm:mt-6">
              <Button asChild className="bg-orange-500 hover:bg-orange-600">
                <Link href="/dashboard/library" onClick={closeBundleDialog}>View in My Library</Link>
              </Button>
              <Button variant="outline" className="border-border text-muted-foreground" onClick={closeBundleDialog}>Close</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
