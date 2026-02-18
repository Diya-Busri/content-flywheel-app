"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, ExternalLink, Home, ChevronRight, Store, ChevronDown } from "lucide-react";
import { useState } from "react";

type Difficulty = "Easy" | "Medium" | "Advanced";

type SellingPlatform = {
  name: string;
  description: string;
  price: string;
  link: string;
  bestFor: string;
  difficulty: Difficulty;
  setupSteps: string[];
};

const PLATFORMS: { category: string; subtitle?: string; platforms: SellingPlatform[] }[] = [
  {
    category: "BEGINNER FRIENDLY",
    subtitle: "No website needed",
    platforms: [
      {
        name: "Stan Store",
        description: "All-in-one creator store. Set up in 5 minutes. Best for social media sellers.",
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
        description: "Simple digital product selling. Just upload and share your link.",
        price: "Free, 10% transaction fee",
        link: "https://gumroad.com",
        bestFor: "Simple one-off products",
        difficulty: "Easy",
        setupSteps: [
          "Create a free Gumroad account",
          "Click “New product” and add title, description, price",
          "Upload your file (PDF, ZIP, etc.)",
          "Publish and copy your product link",
          "Share the link on socials or in your bio",
        ],
      },
    ],
  },
  {
    category: "MARKETPLACES",
    subtitle: "Built-in audience",
    platforms: [
      {
        name: "Etsy",
        description: "Huge marketplace. People are already searching for digital products.",
        price: "$0.20 listing fee + 6.5% transaction",
        link: "https://etsy.com",
        bestFor: "Printables, templates, planners",
        difficulty: "Medium",
        setupSteps: [
          "Create an Etsy seller account",
          "Open a shop and choose a name",
          "Create a listing (title, description, category, price)",
          "Upload your digital file(s) or use Etsy’s digital delivery",
          "Publish and optimize with keywords for search",
        ],
      },
      {
        name: "Creative Market",
        description: "Premium digital marketplace for designers and creators.",
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
    category: "ADVANCED",
    subtitle: "Full control",
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
          "Add a product (digital download app or link delivery)",
          "Set up payments and (optional) domain",
          "Launch and drive traffic to your store",
        ],
      },
      {
        name: "Payhip",
        description: "Simple storefront with 0% fees on premium plan.",
        price: "Free plan with 5% fee",
        link: "https://payhip.com",
        bestFor: "Ebooks, courses, memberships",
        difficulty: "Medium",
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

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-green-500/20 text-green-400 border-green-500/40",
  Medium: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  Advanced: "bg-orange-500/20 text-orange-400 border-orange-500/40",
};

function PlatformCard({ platform }: { platform: SellingPlatform }) {
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
              <CardTitle className="text-lg text-gray-900 dark:text-white">{platform.name}</CardTitle>
              <span
                className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded border ${DIFFICULTY_STYLES[platform.difficulty]}`}
              >
                {platform.difficulty}
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{platform.description}</p>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
          <span className="text-gray-500">
            <span className="text-gray-600 dark:text-gray-400">Price:</span> {platform.price}
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-amber-600 dark:text-amber-400/90">
            <span className="text-gray-600 dark:text-gray-400">Best for:</span> {platform.bestFor}
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

export default function SellingGuidePage() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
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
        <p className="text-gray-600 dark:text-gray-400 text-lg mb-10">
          You need a storefront to sell your product. Here are the best options:
        </p>

        <div className="space-y-10">
          {PLATFORMS.map((section) => (
            <section key={section.category}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-orange-500 mb-1">
                {section.category}
              </h2>
              {section.subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">{section.subtitle}</p>
              )}
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {section.platforms.map((platform) => (
                  <PlatformCard key={platform.name} platform={platform} />
                ))}
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
