"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  ExternalLink,
  Home,
  ChevronRight,
  Store,
  ChevronDown,
  Check,
  X,
  Minus,
  Star,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Difficulty = "Easy" | "Medium" | "Advanced";

type ExternalPlatform = {
  native?: false;
  name: string;
  description: string;
  price: string;
  link: string;
  bestFor: string;
  difficulty: Difficulty;
  setupSteps: string[];
};

type NativePlatform = {
  native: true;
  name: string;
  description: string;
  price: string;
  bestFor: string;
  primaryLink: string;
  primaryLabel: string;
  secondaryLink: string;
  secondaryLabel: string;
  setupSteps: string[];
};

type SellingPlatform = ExternalPlatform | NativePlatform;

// ─── Comparison table ────────────────────────────────────────────────────────

type CompareRow = {
  platform: string;
  native?: boolean;
  fees: string;
  marketplace: "yes" | "partial" | "no";
  email: "yes" | "partial" | "no";
  analytics: "yes" | "partial" | "no";
  bestFor: string;
};

const COMPARE_ROWS: CompareRow[] = [
  {
    platform: "CF Store",
    native: true,
    fees: "Free (Beta)",
    marketplace: "yes",
    email: "yes",
    analytics: "yes",
    bestFor: "Content Flywheel creators",
  },
  {
    platform: "Stan Store",
    fees: "From $29/mo",
    marketplace: "no",
    email: "yes",
    analytics: "partial",
    bestFor: "Social media sellers",
  },
  {
    platform: "Gumroad",
    fees: "10% fee",
    marketplace: "partial",
    email: "no",
    analytics: "partial",
    bestFor: "Simple one-off products",
  },
  {
    platform: "Beacons",
    fees: "Free plan",
    marketplace: "no",
    email: "yes",
    analytics: "partial",
    bestFor: "Link-in-bio beginners",
  },
  {
    platform: "Kajabi",
    fees: "From $69/mo",
    marketplace: "no",
    email: "yes",
    analytics: "yes",
    bestFor: "Course creators",
  },
  {
    platform: "Shopify",
    fees: "From $39/mo",
    marketplace: "no",
    email: "partial",
    analytics: "yes",
    bestFor: "Scaling e-commerce",
  },
];

// ─── Platform data ───────────────────────────────────────────────────────────

const SECTIONS: { category: string; subtitle: string; platforms: SellingPlatform[] }[] = [
  {
    category: "⭐ Built into Content Flywheel",
    subtitle: "Sell directly from your Content Flywheel account — no extra tools needed",
    platforms: [
      {
        native: true,
        name: "Content Flywheel Store",
        description:
          "Your built-in storefront. Sell digital products directly from your Content Flywheel account with zero setup friction. Your store is already waiting — just add products and hit publish.",
        price: "Free while in Beta",
        bestFor: "Creators already using Content Flywheel",
        primaryLink: "/dashboard/my-store",
        primaryLabel: "Open My Store",
        secondaryLink: "/dashboard/digital-products/new",
        secondaryLabel: "Publish Product",
        setupSteps: [
          "Complete your store profile (name, bio, avatar)",
          "Publish your first product with a title and description",
          "Add pricing, a thumbnail, and product file",
          "Submit your product to the CF Marketplace",
          "Share your unique store link with your audience",
          "Track views, sales, and analytics from your dashboard",
        ],
      },
    ],
  },
  {
    category: "🚀 Beginner Friendly",
    subtitle: "No website needed — start selling in under an hour",
    platforms: [
      {
        name: "Stan Store",
        description:
          "All-in-one creator store. Set up in 5 minutes. Best for social media sellers.",
        price: "From $29/month",
        link: "https://stan.store",
        bestFor: "TikTok/Instagram creators",
        difficulty: "Easy",
        setupSteps: [
          "Create account at stan.store",
          "Add your first product (name, description, price)",
          "Upload your digital file (PDF, etc.)",
          "Connect your link-in-bio or socials",
          "Share your store link and start selling",
        ],
      },
      {
        name: "Beacons",
        description: "Free link-in-bio with built-in store. Great starter option.",
        price: "Free plan available",
        link: "https://beacons.ai",
        bestFor: "Beginners, link-in-bio sellers",
        difficulty: "Easy",
        setupSteps: [
          "Sign up at beacons.ai (free)",
          "Choose a template and customize your page",
          "Add a product block and set your price",
          "Upload your digital product file",
          "Add your Beacons link to your social bios",
        ],
      },
      {
        name: "Gumroad",
        description:
          "Simple digital product selling. Just upload and share your link.",
        price: "Free, 10% transaction fee",
        link: "https://gumroad.com",
        bestFor: "Simple one-off products",
        difficulty: "Easy",
        setupSteps: [
          "Create a free Gumroad account",
          'Click "New product" and add title, description, price',
          "Upload your file (PDF, ZIP, etc.)",
          "Publish and copy your product link",
          "Share the link on socials or in your bio",
        ],
      },
    ],
  },
  {
    category: "🛒 Marketplaces",
    subtitle: "Tap into an existing buyer audience",
    platforms: [
      {
        name: "Etsy",
        description:
          "Huge marketplace. People are already searching for digital products.",
        price: "$0.20 listing + 6.5% transaction",
        link: "https://etsy.com",
        bestFor: "Printables, templates, planners",
        difficulty: "Medium",
        setupSteps: [
          "Create an Etsy seller account",
          "Open a shop and choose a name",
          "Create a listing (title, description, category, price)",
          "Upload your digital file(s) or use Etsy's digital delivery",
          "Publish and optimize with keywords for search",
        ],
      },
      {
        name: "Creative Market",
        description:
          "Premium digital marketplace for designers and creators.",
        price: "50% commission",
        link: "https://creativemarket.com",
        bestFor: "Design assets, fonts, templates",
        difficulty: "Medium",
        setupSteps: [
          "Apply to become a Creative Market seller",
          "Set up your shop and profile",
          "Upload your product (fonts, templates, graphics)",
          "Set price and add preview images/description",
          "Submit for review and go live when approved",
        ],
      },
    ],
  },
  {
    category: "🌐 Build Your Own Website",
    subtitle: "Full control — your brand, your rules",
    platforms: [
      {
        name: "Shopify",
        description: "Full e-commerce store. Most customizable.",
        price: "From $39/month",
        link: "https://shopify.com",
        bestFor: "Scaling to a real brand",
        difficulty: "Advanced",
        setupSteps: [
          "Start a Shopify trial and pick a plan",
          "Choose a theme and customize your store",
          "Add a digital download app (e.g. Sky Pilot) or file delivery link",
          "Set up payments and a custom domain",
          "Launch and drive traffic to your store",
        ],
      },
      {
        name: "WooCommerce",
        description:
          "Free plugin for WordPress. Ideal if you already have a WordPress site.",
        price: "Free plugin (hosting ~$10–30/mo)",
        link: "https://woocommerce.com",
        bestFor: "WordPress site owners",
        difficulty: "Advanced",
        setupSteps: [
          "Install WordPress and the WooCommerce plugin",
          "Run the setup wizard (currency, payments, shipping)",
          'Create a product and mark it as "Virtual / Downloadable"',
          "Upload your file and set a download limit",
          "Publish and link from your site or social",
        ],
      },
      {
        name: "Squarespace",
        description:
          "Beautiful templates with built-in digital product support.",
        price: "From $23/month",
        link: "https://squarespace.com",
        bestFor: "Portfolio-style stores, designers",
        difficulty: "Medium",
        setupSteps: [
          "Choose a Squarespace template and start a trial",
          'Add a "Digital Products" block via the store panel',
          "Upload your file and write a product description",
          "Set pricing and connect Stripe or PayPal",
          "Publish your site and share your store URL",
        ],
      },
      {
        name: "Wix",
        description: "Drag-and-drop website builder with e-commerce add-ons.",
        price: "From $17/month",
        link: "https://wix.com",
        bestFor: "Non-technical creators who want a website",
        difficulty: "Medium",
        setupSteps: [
          "Create a Wix account and pick a template",
          "Add the Wix Stores app from the Wix App Market",
          "Create a product, mark as digital, and upload your file",
          "Set up payment methods and checkout",
          "Publish your site and start promoting",
        ],
      },
    ],
  },
  {
    category: "📚 Course Platforms",
    subtitle: "Purpose-built for online courses, communities, and coaching",
    platforms: [
      {
        name: "Kajabi",
        description:
          "All-in-one platform for courses, communities, and email — the gold standard for course creators.",
        price: "From $69/month",
        link: "https://kajabi.com",
        bestFor: "Serious course creators",
        difficulty: "Medium",
        setupSteps: [
          "Start a Kajabi trial and choose your niche",
          "Build your course using the course builder",
          "Add a landing page and pricing plan",
          "Set up your email sequences and community",
          "Launch to your audience and track completions",
        ],
      },
      {
        name: "Teachable",
        description:
          "Popular course platform with a generous free plan. Easy to get started.",
        price: "Free plan available (+ transaction fee)",
        link: "https://teachable.com",
        bestFor: "Video course beginners",
        difficulty: "Easy",
        setupSteps: [
          "Sign up for a free Teachable account",
          "Create a new course (title, description, image)",
          "Upload your video lessons or downloadable content",
          "Set a price and connect your bank account",
          "Publish and share your course checkout link",
        ],
      },
      {
        name: "Thinkific",
        description:
          "Clean course builder with no transaction fees on any plan.",
        price: "Free plan, paid from $36/month",
        link: "https://thinkific.com",
        bestFor: "Course creators avoiding per-sale fees",
        difficulty: "Easy",
        setupSteps: [
          "Create a free Thinkific account",
          "Build a course using the drag-and-drop builder",
          "Upload lessons (video, quiz, PDF, audio)",
          "Customize your school branding and landing page",
          "Publish and promote your course link",
        ],
      },
      {
        name: "Payhip",
        description:
          "Simple storefront with 0% fees on premium plan. Supports courses and memberships.",
        price: "Free plan with 5% fee",
        link: "https://payhip.com",
        bestFor: "Ebooks, courses, memberships",
        difficulty: "Easy",
        setupSteps: [
          "Sign up at Payhip (free or paid plan)",
          "Create a product and add title, description, price",
          "Upload your file or connect a course/membership",
          "Customize your checkout page and branding",
          "Share your product link or embed on your site",
        ],
      },
    ],
  },
];

// ─── Difficulty styles ───────────────────────────────────────────────────────

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-green-500/20 text-green-400 border-green-500/40",
  Medium: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  Advanced: "bg-orange-500/20 text-orange-400 border-orange-500/40",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function CompareCell({ value }: { value: "yes" | "partial" | "no" }) {
  if (value === "yes") return <Check className="w-4 h-4 text-green-500 mx-auto" />;
  if (value === "partial") return <Minus className="w-4 h-4 text-amber-400 mx-auto" />;
  return <X className="w-4 h-4 text-gray-400 dark:text-gray-600 mx-auto" />;
}

function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] mb-10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#1A1A1A]">
            {["Platform", "Fees", "Marketplace", "Email Tools", "Analytics", "Best For"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap first:rounded-tl-xl last:rounded-tr-xl"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((row, i) => (
            <tr
              key={row.platform}
              className={`border-b border-[#E5E7EB] dark:border-[#2A2A2A] last:border-0 transition-colors ${
                row.native
                  ? "bg-orange-500/5 dark:bg-orange-500/10"
                  : i % 2 === 0
                  ? "bg-white dark:bg-[#111111]"
                  : "bg-gray-50/50 dark:bg-[#161616]"
              }`}
            >
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                {row.native ? (
                  <span className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                    {row.platform}
                    <span className="text-xs font-normal bg-orange-500/20 text-orange-500 border border-orange-500/30 px-1.5 py-0.5 rounded-full">
                      Recommended
                    </span>
                  </span>
                ) : (
                  row.platform
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {row.fees}
              </td>
              <td className="px-4 py-3 text-center">
                <CompareCell value={row.marketplace} />
              </td>
              <td className="px-4 py-3 text-center">
                <CompareCell value={row.email} />
              </td>
              <td className="px-4 py-3 text-center">
                <CompareCell value={row.analytics} />
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                {row.bestFor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NativePlatformCard({ platform }: { platform: NativePlatform }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-2 border-orange-500/50 dark:border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-transparent dark:from-orange-500/10 overflow-hidden shadow-sm shadow-orange-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-orange-500/30">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl text-gray-900 dark:text-white">
                  {platform.name}
                </CardTitle>
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-500 text-white px-2.5 py-1 rounded-full shadow-sm">
                  <Star className="w-3 h-3 fill-white" />
                  Recommended
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  Built into Content Flywheel
                </span>
                <span className="text-gray-400 dark:text-gray-600">·</span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  <Sparkles className="w-3 h-3 inline mr-0.5 text-amber-400" />
                  {platform.price}
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
          {platform.description}
        </p>
        <p className="text-xs text-orange-600 dark:text-orange-400/80 mt-2">
          Best for: {platform.bestFor}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 shadow-sm shadow-orange-500/20"
          >
            <Link href={platform.primaryLink}>{platform.primaryLabel}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 gap-1.5"
          >
            <Link href={platform.secondaryLink}>{platform.secondaryLabel}</Link>
          </Button>
        </div>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 dark:text-gray-400 hover:text-orange-500 hover:bg-orange-500/10 w-full justify-between"
            >
              <span>Quick Setup Guide (6 steps)</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 pt-3 border-t border-orange-500/20 mt-2">
              {platform.setupSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-500 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function PlatformCard({ platform }: { platform: ExternalPlatform }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] overflow-hidden hover:border-orange-500/40 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
              <Store className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-lg text-gray-900 dark:text-white">
                {platform.name}
              </CardTitle>
              <span
                className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded border ${DIFFICULTY_STYLES[platform.difficulty]}`}
              >
                {platform.difficulty}
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {platform.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
          <span className="text-gray-500">
            <span className="text-gray-600 dark:text-gray-400">Price:</span>{" "}
            {platform.price}
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-amber-600 dark:text-amber-400/90">
            <span className="text-gray-600 dark:text-gray-400">Best for:</span>{" "}
            {platform.bestFor}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
          >
            <a href={platform.link} target="_blank" rel="noopener noreferrer">
              Visit Site
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Button>
        </div>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 dark:text-gray-400 hover:text-orange-500 hover:bg-orange-500/10 w-full justify-between"
            >
              <span>Quick Setup Guide</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-[#E5E7EB] dark:border-[#2A2A2A] mt-2">
              {platform.setupSteps.map((step, i) => (
                <li key={i} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SellingGuidePage() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600" />
          <Link
            href="/dashboard/digital-products"
            className="hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Digital Products
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600" />
          <span className="text-gray-900 dark:text-white">Selling Guide</span>
        </nav>

        <Link
          href="/dashboard/digital-products"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Digital Products
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Where to Sell Your Digital Product
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
          Compare your options and pick the platform that fits your goals.
        </p>

        {/* Comparison table */}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Platform Comparison
        </h2>
        <ComparisonTable />

        {/* Platform sections */}
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.category}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-0.5">
                {section.category}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                {section.subtitle}
              </p>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {section.platforms.map((platform) =>
                  platform.native ? (
                    <div key={platform.name} className="lg:col-span-2">
                      <NativePlatformCard platform={platform} />
                    </div>
                  ) : (
                    <PlatformCard key={platform.name} platform={platform as ExternalPlatform} />
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
          <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <Link href="/dashboard/digital-products">
              <ArrowLeft className="w-4 h-4" />
              Back to Digital Products
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
