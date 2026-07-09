"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import WhopPricingCard from "./whop-pricing-card";
import { Check } from "lucide-react";

interface PricingPageClientProps {
  userId: string | null;
  activePaymentProvider: string;
  whopRedirectUrl: string;
  whopMonthlyLink: string;
  whopYearlyLink: string;
  whopMonthlyPlanId: string;
  whopYearlyPlanId: string;
  stripeMonthlyLink: string;
  stripeYearlyLink: string;
  monthlyPrice: string;
  yearlyPrice: string;
}

const BENEFITS = [
  "Unlimited video scripts & timelines",
  "AI-powered content studio",
  "Print on Demand integration",
  "Link in Bio + email waitlist",
  "Brand kit & caption library",
  "Priority customer support",
];

function buildStripeLink(link: string, userId: string | null) {
  if (!userId) return link;
  return `${link}${link.includes("?") ? "&" : "?"}ref=${userId}`;
}

function buildWhopLink(link: string, userId: string | null, redirectUrl: string) {
  if (!userId) return link;
  const base = link.split("?")[0];
  const params = new URLSearchParams({ d2c: "true", redirect: redirectUrl, userId, "metadata[userId]": userId });
  return `${base}?${params.toString()}`;
}

export default function PricingPageClient({
  userId,
  activePaymentProvider,
  whopRedirectUrl,
  whopMonthlyLink,
  whopYearlyLink,
  whopMonthlyPlanId,
  whopYearlyPlanId,
  stripeMonthlyLink,
  stripeYearlyLink,
  monthlyPrice,
  yearlyPrice,
}: PricingPageClientProps) {
  const monthlyCost = parseInt(monthlyPrice.replace(/[^0-9]/g, ""), 10) || 0;
  const yearlyCost = parseInt(yearlyPrice.replace(/[^0-9]/g, ""), 10) || 0;
  const savingsPct = monthlyCost > 0 ? Math.round(((monthlyCost * 12 - yearlyCost) / (monthlyCost * 12)) * 100) : 0;
  const savingsAmt = monthlyCost * 12 - yearlyCost;

  return (
    <div className="container mx-auto py-16 max-w-4xl px-4">
      <div className="text-center space-y-3 mb-12">
        <h1 className="text-5xl font-bold">Pick Your Plan</h1>
        <p className="text-xl text-muted-foreground">Start monthly, save big annually.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* Monthly card */}
        <Card className="rounded-2xl border shadow-sm overflow-hidden">
          <CardHeader className="px-6 py-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Monthly</div>
            <CardTitle className="text-2xl font-bold">Business</CardTitle>
            <CardDescription className="text-base text-gray-500 mt-1">
              Perfect for getting started.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-6">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-bold">{monthlyPrice}</span>
                <span className="text-gray-400 text-base">/month</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">Billed monthly. Cancel anytime.</p>
            </div>
            {activePaymentProvider === "stripe" ? (
              <Button className="w-full h-12 text-base font-semibold" variant="outline" asChild>
                <a href={buildStripeLink(stripeMonthlyLink, userId)} className={cn(stripeMonthlyLink === "#" && "pointer-events-none opacity-50")}>
                  Get Started Monthly
                </a>
              </Button>
            ) : (
              <Button className="w-full h-12 text-base font-semibold" variant="outline" asChild>
                <a href={buildWhopLink(whopMonthlyLink, userId, whopRedirectUrl)}>
                  Get Started Monthly
                </a>
              </Button>
            )}
            <ul className="space-y-2.5">
              {BENEFITS.map((b, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Check className="w-4 h-4 text-gray-400 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Yearly card — highlighted */}
        <Card className="rounded-2xl border-2 border-black shadow-lg overflow-hidden relative">
          {/* "Best value" banner */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-400 to-orange-600" />
          <div className="absolute top-3 right-4">
            <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              Save {savingsPct}%, ${savingsAmt} off
            </span>
          </div>

          <CardHeader className="px-6 pt-8 pb-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-orange-500 mb-1">Annual · Best value</div>
            <CardTitle className="text-2xl font-bold">Business</CardTitle>
            <CardDescription className="text-base text-gray-500 mt-1">
              Best for serious creators.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-6">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-bold">{yearlyPrice}</span>
                <span className="text-gray-400 text-base">/year</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-400 line-through">${monthlyCost * 12}/yr</span>
                <span className="text-sm text-green-600 font-semibold">You save ${savingsAmt}</span>
              </div>
            </div>
            {activePaymentProvider === "stripe" ? (
              <Button className="w-full h-12 text-base font-semibold bg-black hover:bg-gray-900 text-white" asChild>
                <a href={buildStripeLink(stripeYearlyLink, userId)} className={cn(stripeYearlyLink === "#" && "pointer-events-none opacity-50")}>
                  Get Started Annually
                </a>
              </Button>
            ) : (
              <WhopPricingCard
                title=""
                price={yearlyPrice}
                description=""
                buttonText="Get Started Annually"
                planId={whopYearlyPlanId}
                redirectUrl={whopRedirectUrl}
                billingCycle="yearly"
                savingsPercentage={savingsPct}
                savingsAmount={`$${savingsAmt}`}
                buttonOnly
              />
            )}
            <ul className="space-y-2.5">
              {BENEFITS.map((b, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700 font-medium">
                  <Check className="w-4 h-4 text-orange-500 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-gray-400 mt-8">
        All plans include a 14-day money-back guarantee. No questions asked.
      </p>
    </div>
  );
}
