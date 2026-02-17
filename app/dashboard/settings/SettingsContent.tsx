"use client";

import { useState } from "react";
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
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 dark:text-white">
            Profile
          </CardTitle>
          <CardDescription>Your display name and account info</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 border-2 border-orange-200 dark:border-orange-900">
              {userImageUrl ? (
                <AvatarImage src={userImageUrl} alt="Profile" />
              ) : null}
              <AvatarFallback className="bg-orange-100 dark:bg-orange-950 text-orange-600 text-xl">
                {(displayName || userEmail || "U").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="max-w-sm border-slate-200 dark:border-slate-700 focus-visible:ring-orange-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={userEmail || "—"}
              readOnly
              disabled
              className="max-w-sm bg-slate-50 dark:bg-slate-900 cursor-not-allowed"
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
            <p className="text-sm text-amber-600 dark:text-amber-400">Create the database table above to save.</p>
          )}
        </CardContent>
      </Card>

      {/* 2. PLAN & BILLING */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 dark:text-white">
            Plan & Billing
          </CardTitle>
          <CardDescription>Your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Current plan
            </p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {planLabel}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subscription status
            </p>
            <p className="text-slate-900 dark:text-white capitalize">
              {subscriptionStatus}
            </p>
          </div>
          {nextBilling && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Next billing date
              </p>
              <p className="text-slate-900 dark:text-white">
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
                  else throw new Error(data?.error || "Failed to open portal");
                } catch (e) {
                  toast({
                    title: "Error",
                    description: e instanceof Error ? e.message : "Could not open billing portal",
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
      <Card className="border-red-200 dark:border-red-900/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
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
