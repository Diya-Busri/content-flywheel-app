"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  saveProfileAction,
  deleteAccountAction,
  type SettingsDisplay,
  type ProfileForSettings,
} from "@/actions/settings-actions";

type Props = {
  profile: ProfileForSettings | null;
  settings: SettingsDisplay | null;
  userEmail: string;
  userImageUrl: string | null;
  settingsTableMissing?: boolean;
};

export default function SettingsContent({
  profile,
  settings,
  userEmail,
  userImageUrl,
  settingsTableMissing = false,
}: Props) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(settings?.displayName ?? "");
  const [profileSaving, setProfileSaving] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [nicheIndustry, setNicheIndustry] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1a1a1a");
  const [secondaryColor, setSecondaryColor] = useState("#475569");
  const [brandProfileSaving, setBrandProfileSaving] = useState(false);
  const [brandProfileLoaded, setBrandProfileLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brand-profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setBrandName(data.brandName ?? "");
        setNicheIndustry(data.nicheIndustry ?? "");
        setBrandVoice(data.brandVoice ?? "");
        setPrimaryColor(data.primaryColor ?? "#1a1a1a");
        setSecondaryColor(data.secondaryColor ?? "#475569");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBrandProfileLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [dangerLoading, setDangerLoading] = useState<"delete" | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const planLabel =
    profile?.planDuration === "yearly"
      ? "Yearly"
      : profile?.planDuration === "monthly"
        ? "Monthly"
        : profile?.membership === "pro"
          ? "Pro"
          : "—";
  const nextBilling = profile?.billingCycleEnd
    ? new Date(profile.billingCycleEnd)
    : null;
  const subscriptionStatus = (profile?.status ?? "—") as string;

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    const res = await saveProfileAction(displayName.trim() || null);
    setProfileSaving(false);
    if (res.success) {
      toast({ title: "Saved", description: "Profile updated." });
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  const handleSaveBrandProfile = async () => {
    setBrandProfileSaving(true);
    try {
      const body = {
        brandName: brandName.trim() || null,
        nicheIndustry: nicheIndustry.trim() || null,
        brandVoice: brandVoice.trim() || null,
        primaryColor: primaryColor || "#1a1a1a",
        secondaryColor: secondaryColor || "#475569",
      };
      const res = await fetch("/api/brand-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 404) {
        const createRes = await fetch("/api/brand-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!createRes.ok) throw new Error("Failed to create brand profile");
      } else if (!res.ok) {
        throw new Error("Failed to save");
      }
      toast({ title: "Saved", description: "Brand profile updated." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not save brand profile",
        variant: "destructive",
      });
    } finally {
      setBrandProfileSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDangerLoading("delete");
    const res = await deleteAccountAction();
    setDangerLoading(null);
    setDeleteAccountOpen(false);
    if (res.success) {
      window.location.href = "/";
    } else {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* 1. PROFILE */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Profile
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">Your display name and account info</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-2 border-orange-900">
              {userImageUrl ? (
                <AvatarImage src={userImageUrl} alt="Profile" />
              ) : null}
              <AvatarFallback className="bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xl">
                {(displayName || userEmail || "U").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="display-name" className="text-gray-700 dark:text-gray-300">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="max-w-sm border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white focus-visible:ring-orange-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700 dark:text-gray-300">Email</Label>
            <Input
              value={userEmail || "—"}
              readOnly
              disabled
              className="max-w-sm bg-gray-50 dark:bg-[#0F0F0F] border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-500 cursor-not-allowed"
            />
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={profileSaving || settingsTableMissing}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {profileSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Save
          </Button>
          {settingsTableMissing && (
            <p className="text-sm text-amber-400">Create the database table above to save.</p>
          )}
        </CardContent>
      </Card>

      {/* 2. BRAND PROFILE */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]" id="brand-profile">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Brand Profile
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Used across digital products and auto-design. Optional but helps keep your content on-brand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-name" className="text-gray-700 dark:text-gray-300">Brand name</Label>
              <Input
                id="brand-name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Acme Co"
                className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white focus-visible:ring-orange-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="niche-industry" className="text-gray-700 dark:text-gray-300">Niche / industry</Label>
              <Input
                id="niche-industry"
                value={nicheIndustry}
                onChange={(e) => setNicheIndustry(e.target.value)}
                placeholder="e.g. Fitness, Coaching"
                className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white focus-visible:ring-orange-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-voice" className="text-gray-700 dark:text-gray-300">Brand voice</Label>
            <Input
              id="brand-voice"
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              placeholder="e.g. Friendly, professional, motivational"
              className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white focus-visible:ring-orange-500"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary-color" className="text-gray-700 dark:text-gray-300">Primary colour</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  id="primary-color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded border border-[#E5E7EB] dark:border-[#2A2A2A] cursor-pointer bg-transparent"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#1a1a1a"
                  className="flex-1 border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white focus-visible:ring-orange-500 font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color" className="text-gray-700 dark:text-gray-300">Secondary colour</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  id="secondary-color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-14 rounded border border-[#E5E7EB] dark:border-[#2A2A2A] cursor-pointer bg-transparent"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#475569"
                  className="flex-1 border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white focus-visible:ring-orange-500 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <Button
            onClick={handleSaveBrandProfile}
            disabled={brandProfileSaving || !brandProfileLoaded}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {brandProfileSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Save brand profile
          </Button>
        </CardContent>
      </Card>

      {/* 3. PLAN & BILLING */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Plan & Billing
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">Your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Current plan
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {planLabel}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              Subscription status
            </p>
            <p className="text-gray-900 dark:text-white capitalize">
              {subscriptionStatus}
            </p>
          </div>
          {nextBilling && (
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Next billing date
              </p>
              <p className="text-gray-900 dark:text-white">
                {nextBilling.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          )}
          {profile?.stripeCustomerId ? (
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={portalLoading}
              onClick={async () => {
                setPortalLoading(true);
                try {
                  const res = await fetch("/api/stripe-portal", { method: "POST" });
                  const data = await res.json();
                  if (data?.url) window.location.href = data.url;
                  else throw new Error("Portal failed");
                } catch (e) {
                  toast({
                    title: "Error",
                    description: "Payment system error. Please try again later.",
                    variant: "destructive",
                  });
                } finally {
                  setPortalLoading(false);
                }
              }}
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Manage Subscription
            </Button>
          ) : (
            <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link href="/pricing">Subscribe</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* DANGER ZONE */}
      <Card className="border-red-200 dark:border-red-900/50 bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Irreversible actions. Use with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="destructive"
            onClick={() => setDeleteAccountOpen(true)}
            disabled={dangerLoading !== null}
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account confirmation */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated
              data. You will be signed out. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteAccount}
              disabled={dangerLoading === "delete"}
            >
              {dangerLoading === "delete" ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
