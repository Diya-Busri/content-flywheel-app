"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Store, Inbox, Star, Tag, Gift, Mail, Send,
  BarChart2, Receipt, Wallet, Shirt, Palette, Link2,
  ArrowRight,
} from "lucide-react";

type Section = "store" | "marketing" | "analytics" | "finance" | "brand";

const TABS: { id: Section; label: string }[] = [
  { id: "store",     label: "🏪 Store"     },
  { id: "marketing", label: "📣 Marketing" },
  { id: "analytics", label: "📊 Analytics" },
  { id: "finance",   label: "💳 Finance"   },
  { id: "brand",     label: "🎨 Brand"     },
];

type NavCard = {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  highlight?: boolean;
};

const SECTIONS: Record<Section, { heading: string; sub: string; cards: NavCard[] }> = {
  store: {
    heading: "Your Store",
    sub: "Manage products, orders, and customer reviews.",
    cards: [
      { icon: <Store className="w-5 h-5" />,  label: "My Store",      description: "View and manage your digital storefront",    href: "/dashboard/store",          highlight: true },
      { icon: <Inbox className="w-5 h-5" />,  label: "Orders",        description: "See every purchase and fulfilment status",   href: "/dashboard/orders"          },
      { icon: <Star className="w-5 h-5" />,   label: "Reviews",       description: "Read and respond to customer reviews",       href: "/dashboard/reviews"         },
      { icon: <Shirt className="w-5 h-5" />,  label: "Print on Demand", description: "Design and sell merch with no upfront cost", href: "/dashboard/print-on-demand", highlight: true },
    ],
  },
  marketing: {
    heading: "Marketing",
    sub: "Grow your audience and drive repeat sales.",
    cards: [
      { icon: <Mail className="w-5 h-5" />,   label: "Email Marketing",  description: "Send campaigns to your subscribers",          href: "/dashboard/email-marketing",  highlight: true },
      { icon: <Send className="w-5 h-5" />,   label: "Email Sequences",  description: "Automated welcome and nurture flows",          href: "/dashboard/email-sequences"   },
      { icon: <Tag className="w-5 h-5" />,    label: "Discount Codes",   description: "Create and manage promo codes",                href: "/dashboard/discount-codes"    },
      { icon: <Gift className="w-5 h-5" />,   label: "Affiliates",       description: "Let others promote your products for a cut",   href: "/dashboard/affiliates"        },
    ],
  },
  analytics: {
    heading: "Analytics",
    sub: "Understand what's working and where to focus.",
    cards: [
      { icon: <BarChart2 className="w-5 h-5" />, label: "Analytics", description: "Sales, traffic, conversions and revenue over time", href: "/dashboard/analytics", highlight: true },
    ],
  },
  finance: {
    heading: "Finance",
    sub: "Keep your money organised and compliant.",
    cards: [
      { icon: <Receipt className="w-5 h-5" />, label: "Tax & VAT",  description: "Track tax obligations and VAT settings", href: "/dashboard/store/tax"     },
      { icon: <Wallet className="w-5 h-5" />,  label: "Payouts",    description: "See your earnings and payout history",  href: "/dashboard/store/payouts", highlight: true },
    ],
  },
  brand: {
    heading: "Brand",
    sub: "Build and present your brand consistently everywhere.",
    cards: [
      { icon: <Palette className="w-5 h-5" />, label: "Brand Kit",    description: "Your colours, fonts, and logo in one place",           href: "/dashboard/brand-kit",  highlight: true },
      { icon: <Link2 className="w-5 h-5" />,   label: "Link in Bio",  description: "Branded bio page with email waitlist for TikTok/IG",   href: "/dashboard/bio-page",   highlight: true },
    ],
  },
};

function NavCard({ card }: { card: NavCard }) {
  return (
    <Link
      href={card.href}
      className={`group flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${
        card.highlight
          ? "border-orange-200 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/10 hover:border-orange-400 hover:shadow-orange-100 dark:hover:shadow-orange-950/20"
          : "border-gray-100 dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] hover:border-gray-300 dark:hover:border-[#3A3A3A]"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        card.highlight ? "bg-orange-100 dark:bg-orange-900/30 text-orange-500" : "bg-gray-100 dark:bg-[#2A2A2A] text-gray-500 dark:text-gray-400"
      }`}>
        {card.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">{card.label}</p>
        <p className="text-xs text-gray-500 dark:text-[#A0A0A0] leading-relaxed">{card.description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 dark:text-[#444] group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
    </Link>
  );
}

export default function GrowHubPage() {
  const [active, setActive] = useState<Section>("store");
  const section = SECTIONS[active];

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-1">Grow</h1>
        <p className="text-gray-500 dark:text-[#A0A0A0] mb-8">Everything you need to sell, market, and scale your brand.</p>

        {/* Tab bar */}
        <div className="flex gap-1 flex-wrap mb-8 p-1 rounded-xl bg-gray-100 dark:bg-[#111]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active === tab.id
                  ? "bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-[#A0A0A0] hover:text-gray-700 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Section */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{section.heading}</h2>
          <p className="text-sm text-gray-500 dark:text-[#A0A0A0] mt-0.5">{section.sub}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {section.cards.map((card) => (
            <NavCard key={card.href} card={card} />
          ))}
        </div>
      </div>
    </main>
  );
}
