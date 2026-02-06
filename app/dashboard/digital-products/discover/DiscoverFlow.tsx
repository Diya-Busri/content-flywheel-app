"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Loader2, User, Video, RefreshCw, Filter, BookOpen, ClipboardList, Sheet, FileStack, GraduationCap, ListChecks, Play, Sparkles, Trash2, Copy, Check, AlertCircle, Target, Zap, MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";

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

const PROGRESS_VALUES = [17, 33, 50, 67, 83, 100];

const PRODUCT_FORMATS = [
  { id: "ebook", label: "Ebook/Guide", icon: BookOpen, desc: "PDF with chapters & TOC" },
  { id: "workbook", label: "Workbook", icon: ClipboardList, desc: "Fill-in worksheets & exercises" },
  { id: "spreadsheet", label: "Spreadsheet", icon: Sheet, desc: "Excel/Sheets with formulas" },
  { id: "notion", label: "Notion Template", icon: FileStack, desc: "Databases & templates" },
  { id: "course", label: "Course Outline", icon: GraduationCap, desc: "Modules & lessons structure" },
  { id: "checklist", label: "Checklist Pack", icon: ListChecks, desc: "Printable action checklists" },
] as const;

const GENERATE_STEPS = [
  "Creating outline...",
  "Writing content...",
  "Adding examples...",
  "Formatting product...",
];

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
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [courseIncludeAvatar, setCourseIncludeAvatar] = useState(false);
  const [courseVoiceOver, setCourseVoiceOver] = useState(false);
  const [courseVoiceType, setCourseVoiceType] = useState<string>("professional-female");
  const [generating, setGenerating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [generateStepIndex, setGenerateStepIndex] = useState(0);

  // Next: need goal + (interests text OR "I'm not sure")
  const canProceedStep1 = !!goal && (interests.trim().length > 0 || dontKnowYet);

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
    setDontKnowYet(false);
    setSalesGuide(null);
    setSalesGuideProductId(null);
    setShowResumeModal(false);
  }

  function handleResume() {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      console.log("✅ RESUMING - State already loaded from localStorage");
      console.log("Current step:", step);
    }
    setShowResumeModal(false);
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
      const data = await res.json();
      console.log("📥 RECEIVED FROM API:", res.ok ? (Array.isArray(data) ? data.length : 0) : data, data);

      if (!res.ok) {
        const errMsg = (data && typeof data.error === "string" ? data.error : null) || "Generation failed";
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
    setStep(3);
    try {
      const key = getProductsStorageKey(n.id);
      const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      if (saved) {
        const parsed = JSON.parse(saved) as ProductSuggestionItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllProductSuggestions(parsed);
          return;
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
      if (saved) {
        const parsed = JSON.parse(saved) as ProductSuggestionItem[];
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
      .then((res) => res.json())
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
      const data = await res.json();
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
      .then((res) => res.json())
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
      const data = await res.json();
      if (!res.ok) {
        setGenerateError((data && typeof data.error === "string" ? data.error : null) || "Generation failed");
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
      const hasProgress = !Number.isNaN(stepNum) && stepNum > 1 && stepNum <= 6;

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

        if (savedNiches) {
          try {
            const parsed = JSON.parse(savedNiches) as NicheOption[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAllNiches(parsed);
              const page = parseInt(savedNichePage ?? "0", 10);
              if (!Number.isNaN(page)) setCurrentPage(Math.max(0, page));
            }
          } catch {
            // ignore
          }
        }
        if (savedSelectedNiche) {
          try {
            const niche = JSON.parse(savedSelectedNiche) as NicheOption;
            if (niche?.id != null) {
              setSelectedNiche(niche);
              const productsKey = getProductsStorageKey(niche.id);
              const savedProducts = localStorage.getItem(productsKey);
              if (savedProducts) {
                const productList = JSON.parse(savedProducts) as ProductSuggestionItem[];
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
        if (savedSelectedProduct) {
          try {
            const product = JSON.parse(savedSelectedProduct) as ProductSuggestionItem;
            if (product?.id != null) setSelectedProduct(product);
          } catch {
            // ignore
          }
        }
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
    setStep(4);
  };

  const handleCreateProduct = async () => {
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

    const stepInterval = setInterval(() => {
      setGenerateStepIndex((i) => Math.min(i + 1, GENERATE_STEPS.length - 1));
    }, 8000);

    try {
      const nicheName = selectedNiche?.name ?? "";
      const productDescription = selectedProduct
        ? `${selectedProduct.included}. ${selectedProduct.why} Target: ${nicheName}.`
        : "";
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
        }),
      });

      const data = (await response.json()) as { productId?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate product");
      }

      if (data.productId) {
        router.push(`/dashboard/digital-products/${data.productId}/edit`);
        return;
      }
      throw new Error("No product ID returned");
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
      setGenerateStepIndex(0);
    }
  };

  const wrapperClass = "min-h-screen bg-[#0F0F0F] text-white";
  const cardClass = "border-[#2A2A2A] bg-[#1A1A1A]";

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
      {/* Step 7: Generating product overlay */}
      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F0F0F]/95 backdrop-blur-sm p-6">
          <h2 className="text-xl font-semibold text-white mb-1">Generating Your Product...</h2>
          <p className="text-orange-500 font-medium mb-8">{selectedProduct?.name ?? "Your Product"}</p>
          <div className="w-full max-w-sm space-y-3">
            {GENERATE_STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {i < generateStepIndex ? (
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                ) : i === generateStepIndex ? (
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin shrink-0" />
                ) : (
                  <span className="w-5 h-5 rounded-full border border-[#2A2A2A] shrink-0" />
                )}
                <span className={i <= generateStepIndex ? "text-[#E0E0E0]" : "text-[#666]"}>{label}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#A0A0A0] mt-8">
            {productFormat === "workbook"
              ? "Creating comprehensive workbook with exercises and worksheets... This takes ~60 seconds"
              : "Estimated time: ~30 seconds"}
          </p>
          {createError && (
            <p className="text-red-400 mt-4 text-sm">{createError}</p>
          )}
        </div>
      )}

      {/* Resume or Start Fresh modal */}
      <Dialog open={showResumeModal} onOpenChange={(open) => !open && setShowResumeModal(false)}>
        <DialogContent className="max-w-[600px] border-[#2A2A2A] bg-[#1A1A1A] text-white" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Welcome back!</DialogTitle>
            <DialogDescription className="text-[#A0A0A0]">
              You have an in-progress discovery session. Continue where you left off or start fresh.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <button
              type="button"
              onClick={handleResume}
              className="flex w-full items-start gap-4 rounded-lg border-2 border-orange-500 bg-[#2A2A2A] p-5 text-left transition-all hover:border-orange-500 hover:bg-orange-500/10 hover:-translate-y-0.5"
            >
              <Play className="h-8 w-8 shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">Continue where you left off</div>
                <p className="mt-1 text-sm text-[#A0A0A0]">Resume with all your generated content and progress saved.</p>
                <p className="mt-2 text-xs text-[#666]">
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
            <div className="text-center text-xs text-[#555]">or</div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("Start fresh? Your previous discovery progress will be deleted.")) {
                  handleStartFresh();
                }
              }}
              className="flex w-full items-start gap-4 rounded-lg border-2 border-[#444] bg-[#2A2A2A] p-5 text-left transition-all hover:border-[#666] hover:bg-[#333]"
            >
              <Sparkles className="h-8 w-8 shrink-0 text-[#A0A0A0]" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">Start fresh</div>
                <p className="mt-1 text-sm text-[#A0A0A0]">Begin a new discovery session (previous work will be deleted).</p>
              </div>
            </button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button variant="ghost" className="text-[#A0A0A0]" onClick={() => router.push("/dashboard/digital-products")}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-3xl mx-auto p-6 md:p-10 pb-24">
        {/* Top nav: Dashboard + Digital Products so main app nav is discoverable */}
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-sm">
          <Link href="/dashboard" className="text-[#A0A0A0] hover:text-orange-500 transition-colors">
            Dashboard
          </Link>
          <span className="text-[#555]">/</span>
          <Link href="/dashboard/digital-products" className="text-[#A0A0A0] hover:text-orange-500 transition-colors">
            Digital Products
          </Link>
          <span className="text-[#555]">/</span>
          <span className="text-white font-medium">Discover</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <Link
            href="/dashboard/digital-products"
            className="inline-flex items-center gap-2 text-sm text-[#A0A0A0] hover:text-orange-500 transition-colors"
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

        {/* Progress bar */}
        <div className="mb-8">
          <Progress value={PROGRESS_VALUES[step - 1]} className="h-2 bg-[#2A2A2A]" />
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 1 of 6</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-8">Tell Us About You</h1>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-white">What topics interest you?</Label>
                <Textarea
                  placeholder="e.g., fitness, budgeting, productivity, travel, parenting, design..."
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  rows={4}
                  disabled={dontKnowYet}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white placeholder:text-[#666] resize-none disabled:opacity-60"
                />
                <p className="text-xs text-[#A0A0A0]">Don&apos;t overthink it - just list things you know about or enjoy</p>
                <label className="flex items-center gap-2 cursor-pointer mt-3">
                  <Checkbox
                    checked={dontKnowYet}
                    onCheckedChange={(checked) => {
                      setDontKnowYet(!!checked);
                      if (checked) setInterests("");
                    }}
                    className="border-[#2A2A2A] data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <span className="text-sm text-[#E0E0E0]">I&apos;m not sure yet — show me what&apos;s selling well</span>
                </label>
              </div>
              <div className="space-y-3">
                <Label className="text-white">What&apos;s your goal?</Label>
                <RadioGroup value={goal} onValueChange={setGoal} className="grid gap-3">
                  {STEP_GOALS.map((g) => (
                    <label
                      key={g.value}
                      htmlFor={`goal-${g.value}`}
                      onClick={() => setGoal(g.value)}
                      className="flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 cursor-pointer hover:border-[#3A3A3A] hover:bg-[#222] has-[:checked]:border-orange-500 has-[:checked]:bg-orange-500/10"
                    >
                      <RadioGroupItem
                        id={`goal-${g.value}`}
                        value={g.value}
                        className="border-2 border-[#666] bg-[#0F0F0F] text-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-500/20 data-[state=checked]:text-orange-500 shrink-0"
                      />
                      <span className="text-sm text-[#E0E0E0] pointer-events-none">{g.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex flex-col items-end gap-2 pt-2">
                {!goal && (
                  <p className="text-xs text-amber-500/90">Select a goal above to continue</p>
                )}
                <Button
                  type="button"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-medium gap-2 px-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500"
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
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 2 of 6</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Pick Your Niche</h1>
            {dontKnowYet ? (
              <p className="text-[#A0A0A0] mb-8">Here are the hottest opportunities right now 🔥</p>
            ) : (
              <p className="text-[#A0A0A0] mb-8">Based on your interests: {interests.trim() || "—"}</p>
            )}

            {nicheLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
                <p className="text-[#A0A0A0]">{dontKnowYet ? "Loading trending niches..." : "Finding niches that match your interests..."}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
                  <Filter className="w-4 h-4 text-[#A0A0A0]" />
                  <span className="text-xs font-medium text-[#A0A0A0]">Saturation:</span>
                  <select value={saturationFilter} onChange={(e) => setSaturationFilter(e.target.value)} className="rounded-lg bg-[#0F0F0F] border border-[#2A2A2A] text-white text-xs px-3 py-1.5">
                    <option value="all">All</option>
                    <option value="low">🟢 Low only</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🟠 High</option>
                    <option value="veryHigh">🔴 Very high</option>
                  </select>
                  <span className="text-xs font-medium text-[#A0A0A0] ml-2">Revenue:</span>
                  <select value={revenueFilter} onChange={(e) => setRevenueFilter(e.target.value)} className="rounded-lg bg-[#0F0F0F] border border-[#2A2A2A] text-white text-xs px-3 py-1.5">
                    <option value="all">All</option>
                    <option value="1-2k">$500–2k/mo</option>
                    <option value="2-5k">$2–5k/mo</option>
                    <option value="5k+">$5k+/mo</option>
                  </select>
                  <span className="text-xs font-medium text-[#A0A0A0] ml-2">Sort:</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "opportunity" | "competition" | "revenue")} className="rounded-lg bg-[#0F0F0F] border border-[#2A2A2A] text-white text-xs px-3 py-1.5">
                    <option value="opportunity">Best opportunity</option>
                    <option value="competition">Lowest competition</option>
                    <option value="revenue">Highest revenue</option>
                  </select>
                </div>

                {(saturationFilter !== "all" || revenueFilter !== "all") && (
                  <p className="text-sm text-[#A0A0A0]">
                    Showing {filteredAndSortedNiches.length} of {allNiches.length} niches
                  </p>
                )}

                {filteredAndSortedNiches.length === 0 ? (
                  <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-8 text-center">
                    <p className="text-[#A0A0A0] mb-4">No niches match your filters.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#222]"
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
                            <h3 className="font-semibold text-white">{n.name}</h3>
                            <span className={`text-xs font-medium px-2 py-1 rounded-md border ${sat.className}`}>
                              {sat.emoji} {sat.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-[#A0A0A0] mb-2">
                            <span>💰 Revenue: {n.revenue}</span>
                            <span>👥 Competition: {n.competition}</span>
                            <span>{trendLabel}</span>
                          </div>
                          {n.subNiches?.length > 0 && (
                            <p className="text-xs text-[#888] mb-2">Angles: {n.subNiches.join(" · ")}</p>
                          )}
                          <p className="text-sm text-[#A0A0A0] mb-4">Why this works: {n.why}</p>
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => handleSelectNiche(n)}>
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
                      className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#1A1A1A]"
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                    >
                      ← Previous Niches
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-[#A0A0A0]">
                      <span>
                        Page {currentPage + 1} of {totalPages}
                      </span>
                      <span className="text-[#666]">({filteredAndSortedNiches.length} total)</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#1A1A1A]"
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
                          idx === currentPage ? "w-6 bg-orange-500" : "w-2 bg-[#3A3A3A] hover:bg-[#555]"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Progress and no-limit messaging */}
                {allNiches.length > 0 && (
                  <div className="text-center py-2">
                    <p className="text-sm text-[#A0A0A0]">
                      You&apos;ve explored {allNiches.length} niches across {totalPages} page{totalPages !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-[#666] mt-1">
                      Keep generating until you find the perfect fit — there&apos;s no limit!
                    </p>
                  </div>
                )}

                {generateError && (
                  <Alert variant="destructive" className="mb-4 border-red-500/50 bg-red-500/10">
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                      <span>{generateError}</span>
                      <Button size="sm" variant="outline" className="border-red-500/50" onClick={handleGenerateMoreNiches} disabled={moreNichesLoading}>
                        Retry
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <Button variant="outline" className="w-full border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#1A1A1A]" onClick={handleGenerateMoreNiches} disabled={moreNichesLoading}>
                  {moreNichesLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Finding more opportunities...
                    </>
                  ) : (
                    <>
                      ✨ Show Me 6 More Niches
                      {allNiches.length > 0 && (
                        <span className="text-sm ml-2 text-[#666]">({allNiches.length} generated so far)</span>
                      )}
                    </>
                  )}
                </Button>

                <div className="flex justify-between">
                  <Button variant="ghost" className="text-[#A0A0A0]" onClick={() => setStep(1)}>← Back</Button>
                  <Button variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]" onClick={() => setStep(3)}>Skip & Enter Custom Niche →</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 3 of 6</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Choose a Product</h1>
            <p className="text-[#A0A0A0] mb-6">Based on niche: {selectedNiche?.name ?? "Your niche"}</p>

            {productSuggestionsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[#A0A0A0]">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generating product ideas…</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <label className="text-sm text-[#A0A0A0]">Price:</label>
                  <select
                    value={productPriceFilter}
                    onChange={(e) => { setProductPriceFilter(e.target.value); setProductCurrentPage(0); }}
                    className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white"
                  >
                    <option value="all">All</option>
                    <option value="under20">Under $20</option>
                    <option value="20-50">$20–50</option>
                    <option value="50+">$50+</option>
                  </select>
                  <label className="text-sm text-[#A0A0A0] ml-2">Type:</label>
                  <select
                    value={productTypeFilter}
                    onChange={(e) => { setProductTypeFilter(e.target.value); setProductCurrentPage(0); }}
                    className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white"
                  >
                    <option value="all">All</option>
                    <option value="Templates">Templates</option>
                    <option value="Guides">Guides</option>
                    <option value="Courses">Courses</option>
                    <option value="Planners">Planners</option>
                  </select>
                  <label className="text-sm text-[#A0A0A0] ml-2">Sort:</label>
                  <select
                    value={productSortBy}
                    onChange={(e) => { setProductSortBy(e.target.value as "potential" | "lowest" | "highest" | "easiest"); setProductCurrentPage(0); }}
                    className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1.5 text-sm text-white"
                  >
                    <option value="potential">Best seller potential</option>
                    <option value="lowest">Lowest price</option>
                    <option value="highest">Highest price</option>
                    <option value="easiest">Easiest to create</option>
                  </select>
                </div>

                {(productPriceFilter !== "all" || productTypeFilter !== "all") && (
                  <p className="text-sm text-[#A0A0A0] mb-3">
                    Showing {filteredAndSortedProducts.length} of {allProductSuggestions.length || MOCK_PRODUCTS.length} products
                  </p>
                )}

                {filteredAndSortedProducts.length === 0 ? (
                  <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-8 text-center">
                    <p className="text-[#A0A0A0] mb-4">No products match your filters.</p>
                    <Button variant="outline" size="sm" className="border-[#2A2A2A] text-[#A0A0A0]" onClick={() => { setProductPriceFilter("all"); setProductTypeFilter("all"); setProductCurrentPage(0); }}>
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {displayedProducts.map((p) => (
                      <Card key={p.id} className={cardClass}>
                        <CardContent className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-white">{p.name}</h3>
                            <span className="text-xs text-[#A0A0A0] flex items-center gap-1">
                              {getProductTypeIcon(p.type)} {p.type}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {p.complexity && (
                              <span className="text-xs px-2 py-0.5 rounded bg-[#2A2A2A] text-[#A0A0A0]">
                                {p.complexity}
                              </span>
                            )}
                            {p.estimatedTime && (
                              <span className="text-xs text-[#666]">{p.estimatedTime}</span>
                            )}
                          </div>
                          <p className="text-xs text-orange-500 mb-0.5">Suggested Price: {p.price}</p>
                          {p.priceNote && <p className="text-xs text-[#666] mb-2">{p.priceNote}</p>}
                          <p className="text-sm text-[#A0A0A0] mb-1">What&apos;s included:</p>
                          <p className="text-sm text-[#E0E0E0] mb-3">{p.included}</p>
                          <p className="text-sm text-[#A0A0A0] mb-4">Why it sells: {p.why}</p>
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => handleSelectProduct(p)}>
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
                      className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#1A1A1A]"
                      onClick={() => setProductCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={productCurrentPage === 0}
                    >
                      ← Previous
                    </Button>
                    <span className="text-sm text-[#A0A0A0]">
                      Page {productCurrentPage + 1} of {totalProductPages} ({filteredAndSortedProducts.length} products total)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#1A1A1A]"
                      onClick={() => setProductCurrentPage((p) => Math.min(totalProductPages - 1, p + 1))}
                      disabled={productCurrentPage >= totalProductPages - 1}
                    >
                      Next →
                    </Button>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full border-[#2A2A2A] text-[#A0A0A0] hover:bg-[#1A1A1A]"
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
                        <span className="text-sm ml-2 text-[#666]">
                          ({(allProductSuggestions.length || MOCK_PRODUCTS.length)} total)
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </>
            )}

            {productSuggestionsError && !productSuggestionsLoading && (
              <p className="text-xs text-[#666] mt-2">{productSuggestionsError}</p>
            )}

            <div className="flex justify-between mt-6">
              <Button variant="ghost" className="text-[#A0A0A0]" onClick={() => setStep(2)}>← Back</Button>
              <Button variant="outline" className="border-[#2A2A2A] text-[#A0A0A0]" onClick={() => setStep(4)}>Create Custom Product →</Button>
            </div>
          </>
        )}

        {/* STEP 4: Your Content Style - clickable cards */}
        {step === 4 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 4 of 6</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-8">Your Content Style</h1>

            <p className="text-[#A0A0A0] mb-6">How do you want to show up online?</p>
            <div className="grid gap-4">
              <button
                type="button"
                onClick={() => setFacelessOrPersonal("faceless")}
                className={`w-full rounded-xl border-2 p-6 text-left transition-all cursor-pointer hover:border-orange-500/50 ${
                  facelessOrPersonal === "faceless" ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A] hover:bg-[#1A1A1A]"
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="flex items-center gap-2 mb-2 w-full justify-between">
                      <span className="flex items-center gap-2">
                        <User className="w-5 h-5 text-[#A0A0A0]" />
                        <span className="font-semibold text-white">Faceless Content</span>
                      </span>
                      {facelessOrPersonal === "faceless" && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-orange-500 bg-orange-500/20 px-2 py-1 rounded-full">
                          <Check className="w-3.5 h-3.5" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#A0A0A0] mb-3">Best for: Privacy & anonymity, testing multiple niches, scalable content production.</p>
                    <p className="text-xs text-[#666]">Video styles: Text overlays on B-roll, screen recordings, animations & graphics.</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFacelessOrPersonal("personal")}
                className={`w-full rounded-xl border-2 p-6 text-left transition-all cursor-pointer hover:border-orange-500/50 ${
                  facelessOrPersonal === "personal" ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A] hover:bg-[#1A1A1A]"
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex flex-col items-start gap-2 flex-1">
                    <div className="flex items-center gap-2 mb-2 w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-[#A0A0A0]" />
                        <span className="font-semibold text-white">Personal Brand</span>
                      </span>
                      {facelessOrPersonal === "personal" && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-orange-500 bg-orange-500/20 px-2 py-1 rounded-full">
                          <Check className="w-3.5 h-3.5" /> Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#A0A0A0] mb-3">Best for: Building authority, long-term brand growth, trust & connection.</p>
                    <p className="text-xs text-[#666]">Video styles: Talking head (you on camera), behind-the-scenes, story-driven content.</p>
                  </div>
                </div>
              </button>
            </div>
            <div className="flex justify-between mt-8">
              <Button variant="ghost" className="text-[#A0A0A0]" onClick={() => setStep(3)}>← Back</Button>
              <Button className="bg-orange-500 hover:bg-orange-600 gap-2" onClick={() => setStep(5)} disabled={facelessOrPersonal === null}>
                Next: Learn Hooks & CTAs →
              </Button>
            </div>
          </>
        )}

        {/* STEP 5 - Master the Basics: full sales education */}
        {step === 5 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 5 of 6</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Master the Basics</h1>
            <p className="text-[#A0A0A0] mb-6">
              A complete sales masterclass tailored to your product{selectedProduct ? `: ${selectedProduct.name}` : ""}.
            </p>

            {salesGuideLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[#A0A0A0]">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Building your sales guide…</span>
              </div>
            ) : salesGuide ? (
              <Accordion type="multiple" className="w-full space-y-2 border border-[#2A2A2A] rounded-xl bg-[#1A1A1A] p-2">
                {/* 1. Product Overview */}
                <AccordionItem value="overview" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      Product Overview
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-[#A0A0A0]">Product:</span> <span className="text-white">{salesGuide.productOverview.productName}</span></p>
                      <p><span className="text-[#A0A0A0]">Format:</span> <span className="text-white">{salesGuide.productOverview.format}</span></p>
                      <p><span className="text-[#A0A0A0]">Who it&apos;s for:</span> <span className="text-[#E0E0E0]">{salesGuide.productOverview.targetCustomer}</span></p>
                      <p><span className="text-[#A0A0A0]">Transformation:</span> <span className="text-orange-500">{salesGuide.productOverview.transformation}</span></p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 2. Pain Points */}
                <AccordionItem value="pain" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Pain Points (Why customers need this)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 text-sm text-[#E0E0E0]">
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
                <AccordionItem value="solution" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-500" />
                      Solution (How your product solves each pain)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-sm">
                      {salesGuide.solutions.map((s, i) => (
                        <div key={i} className="rounded-lg border border-[#2A2A2A] p-3">
                          <p className="text-amber-500/90 mb-1">Pain: {s.pain}</p>
                          <p className="text-green-500/90 flex items-center gap-1">✅ Solution: {s.solution}</p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* 4. Key Benefits */}
                <AccordionItem value="benefits" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Key Benefits
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-[#E0E0E0]">
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
                <AccordionItem value="objections" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-orange-500" />
                      Objection Handling
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-sm">
                      {salesGuide.objections.map((o, i) => (
                        <div key={i} className="rounded-lg border border-[#2A2A2A] p-3 space-y-1">
                          <p className="text-[#A0A0A0]">Objection: &ldquo;{o.objection}&rdquo;</p>
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
                <AccordionItem value="hooks" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    Hooks (The first 3 seconds)
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-[#A0A0A0] mb-3">Why each hook works is listed below.</p>
                    <div className="space-y-3">
                      {salesGuide.hooks.map((h, i) => (
                        <div key={i} className="rounded-xl border-l-4 border-orange-500 bg-[#0F0F0F] p-4">
                          <p className="text-sm text-[#E0E0E0] mb-1">&ldquo;{h.text}&rdquo;</p>
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
                <AccordionItem value="ctas" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    CTAs (Tell them what to do)
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-[#A0A0A0] mb-3">Psychology behind each CTA.</p>
                    <div className="space-y-3">
                      {salesGuide.ctas.map((c, i) => (
                        <div key={i} className="rounded-xl border-l-4 border-orange-500 bg-[#0F0F0F] p-4">
                          <p className="text-sm text-[#E0E0E0] mb-1">&ldquo;{c.text}&rdquo;</p>
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
                <AccordionItem value="pricing" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    Pricing Psychology
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-[#E0E0E0]">
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
                <AccordionItem value="icp" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-orange-500" />
                      Ideal Customer Profile
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-[#E0E0E0]">
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
                <AccordionItem value="content" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    Content Strategy (Where to promote)
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-[#E0E0E0]">
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
                <AccordionItem value="launch" className="border-[#2A2A2A] px-3">
                  <AccordionTrigger className="text-white hover:no-underline hover:text-orange-500">
                    Launch Strategy
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1.5 text-sm text-[#E0E0E0]">
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
              <div className="space-y-6 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-6">
                <p className="text-[#A0A0A0]">
                  {selectedProduct
                    ? "Could not load the full sales guide. Here are generic hooks and CTAs you can use."
                    : "Select a product in Step 3 to get a full sales masterclass tailored to it. Meanwhile, here are general hooks and CTAs."}
                </p>
                <div>
                  <h3 className="font-semibold text-white mb-2">Hooks</h3>
                  <div className="space-y-2">
                    {HOOK_EXAMPLES.map((h, i) => (
                      <div key={i} className="rounded-xl border-l-4 border-orange-500 bg-[#0F0F0F] p-3 text-sm text-[#E0E0E0]">&ldquo;{h}&rdquo;</div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">CTAs</h3>
                  <div className="space-y-2">
                    {CTA_EXAMPLES.map((c, i) => (
                      <div key={i} className="rounded-xl border-l-4 border-orange-500 bg-[#0F0F0F] p-3 text-sm text-[#E0E0E0]">&ldquo;{c}&rdquo;</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-[#A0A0A0] mt-6 mb-8">Use this guide when creating your content—our AI will reference these patterns in your scripts.</p>

            <div className="flex justify-between">
              <Button variant="ghost" className="text-[#A0A0A0]" onClick={() => setStep(4)}>← Back</Button>
              <Button className="bg-orange-500 hover:bg-orange-600 gap-2" onClick={() => setStep(6)}>
                Next: Choose Format →
              </Button>
            </div>
          </>
        )}

        {/* STEP 6: Choose Product Format */}
        {step === 6 && (
          <>
            <h2 className="text-lg font-medium text-orange-500 mb-1">Step 6 of 6</h2>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Choose Your Product Format</h1>
            <p className="text-[#A0A0A0] mb-8">How should we package your content? We&apos;ll generate a format-specific product.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {PRODUCT_FORMATS.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setProductFormat(f.id)}
                    className={`rounded-xl border-2 p-5 text-left transition-all ${
                      productFormat === f.id ? "border-orange-500 bg-orange-500/10" : "border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#3A3A3A]"
                    }`}
                  >
                    <Icon className="w-8 h-8 text-orange-500 mb-3" />
                    <p className="font-semibold text-white mb-1">{f.label}</p>
                    <p className="text-xs text-[#A0A0A0]">{f.desc}</p>
                    <p className="text-xs text-orange-500 mt-2">{productFormat === f.id ? "Selected" : "Select"}</p>
                  </button>
                );
              })}
            </div>

            {productFormat === "course" && (
              <Card className={`${cardClass} mb-6`}>
                <CardContent className="p-5">
                  <p className="font-medium text-white mb-3">Course options</p>
                  <div className="space-y-3 text-sm">
                    <label className="flex items-center gap-2 text-[#E0E0E0] cursor-pointer">
                      <input type="checkbox" checked={courseIncludeAvatar} onChange={(e) => setCourseIncludeAvatar(e.target.checked)} className="rounded border-[#2A2A2A] bg-[#0F0F0F] text-orange-500" />
                      Include avatar presenter
                    </label>
                    <label className="flex items-center gap-2 text-[#E0E0E0] cursor-pointer">
                      <input type="checkbox" checked={courseVoiceOver} onChange={(e) => setCourseVoiceOver(e.target.checked)} className="rounded border-[#2A2A2A] bg-[#0F0F0F] text-orange-500" />
                      Generate AI voiceover
                    </label>
                    {courseVoiceOver && (
                      <div className="flex items-center gap-2">
                        <span className="text-[#A0A0A0]">Voice:</span>
                        <select value={courseVoiceType} onChange={(e) => setCourseVoiceType(e.target.value)} className="rounded-lg bg-[#0F0F0F] border border-[#2A2A2A] text-white px-3 py-1.5 text-sm">
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
              <Button variant="ghost" className="text-[#A0A0A0]" onClick={() => setStep(5)}>← Back</Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600 gap-2"
                onClick={handleCreateProduct}
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
          </>
        )}
      </div>

    </main>
  );
}
