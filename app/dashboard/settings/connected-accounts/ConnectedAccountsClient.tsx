"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Loader2, Unplug } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

/** Platforms whose OAuth is temporarily blocked — shown faded with a manual-token bypass. */
const OAUTH_UNAVAILABLE: ConnectedPlatform[] = ["instagram", "facebook"];

type ConnectedPlatform = "tiktok" | "youtube" | "instagram" | "facebook";

type ConnectedAccount = {
  id: string;
  platform: string;
  platformUsername: string | null;
  platformUserId: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type ApiResponse = {
  connected: ConnectedAccount[];
  platforms: ConnectedPlatform[];
};

const PLATFORM_LABELS: Record<ConnectedPlatform, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
};

const PLATFORM_DESCRIPTIONS: Record<ConnectedPlatform, string> = {
  tiktok: "Auto-upload videos to your TikTok account",
  youtube: "Upload to your YouTube channel",
  instagram: "Sign in with Facebook to link a Page connected to your Instagram Business account",
  facebook: "Share videos to your Facebook page",
};

export default function ConnectedAccountsClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<ConnectedPlatform | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<{ platform: ConnectedPlatform; accountId?: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [instagramPreConnectOpen, setInstagramPreConnectOpen] = useState(false);
  const [igBusinessConfirmed, setIgBusinessConfirmed] = useState(false);
  const [igFacebookLinkedConfirmed, setIgFacebookLinkedConfirmed] = useState(false);
  const [manualTokenOpen, setManualTokenOpen] = useState(false);
  const [manualTokenPlatform, setManualTokenPlatform] = useState<ConnectedPlatform | null>(null);
  const [manualTokenValue, setManualTokenValue] = useState("");
  const [manualTokenUsername, setManualTokenUsername] = useState("");
  const [manualTokenUserId, setManualTokenUserId] = useState("");
  const [manualTokenSaving, setManualTokenSaving] = useState(false);

  // Post-OAuth YouTube channel picker — driven by URL params
  const router = useRouter();
  const searchParams = useSearchParams();
  const ytNewAccountId = searchParams.get("yt_new") ?? "";
  const ytDetected = searchParams.get("yt_detected") ?? "";
  const [ytPickerHandle, setYtPickerHandle] = useState("");
  const [ytPickerSaving, setYtPickerSaving] = useState(false);

  // Pre-OAuth: ask channel name BEFORE going to Google
  const [ytPreConnectOpen, setYtPreConnectOpen] = useState(false);
  const [ytPreConnectHandle, setYtPreConnectHandle] = useState("");
  const [ytPreConnecting, setYtPreConnecting] = useState(false);

  // Fallback account ID for picker: either from URL param or first unlabeled YouTube row
  const [ytFallbackAccountId, setYtFallbackAccountId] = useState("");
  const activePickerAccountId = ytNewAccountId || ytFallbackAccountId;

  // After accounts load, check if any YouTube row has no label — auto-prompt to label it
  useEffect(() => {
    if (!data) return;
    const ytAccounts = data.connected.filter((a) => a.platform === "youtube");
    const unlabeled = ytAccounts.find((a) => !a.platformUsername?.trim());
    if (unlabeled && !ytNewAccountId) {
      setYtFallbackAccountId(unlabeled.id);
      const saved = typeof window !== "undefined" ? (localStorage.getItem("yt_intended_handle") ?? "") : "";
      setYtPickerHandle(saved.replace(/^@+/, ""));
      if (saved) localStorage.removeItem("yt_intended_handle");
    }
  }, [data, ytNewAccountId]);

  // Pre-fill post-OAuth picker — prefers the pre-OAuth handle stored in localStorage
  useEffect(() => {
    if (ytNewAccountId) {
      const saved = typeof window !== "undefined" ? (localStorage.getItem("yt_intended_handle") ?? "") : "";
      setYtPickerHandle((saved || ytDetected).replace(/^@+/, ""));
      if (saved) localStorage.removeItem("yt_intended_handle");
    }
  }, [ytNewAccountId, ytDetected]);

  const { toast } = useToast();

  const canStartInstagramOAuth = igBusinessConfirmed && igFacebookLinkedConfirmed;

  const closeInstagramPreConnect = () => {
    setInstagramPreConnectOpen(false);
    setIgBusinessConfirmed(false);
    setIgFacebookLinkedConfirmed(false);
  };

  const openInstagramPreConnect = () => {
    setIgBusinessConfirmed(false);
    setIgFacebookLinkedConfirmed(false);
    setInstagramPreConnectOpen(true);
  };

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connected-accounts");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not load connected accounts",
        variant: "destructive",
      });
      setData({ connected: [], platforms: ["tiktok", "youtube", "instagram", "facebook"] });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const error = params.get("error");
    const connected = params.get("connected");
    const ytNew = params.get("yt_new");

    if (error) {
      toast({ title: "Connection failed", description: decodeURIComponent(error), variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (ytNew) {
      // New YouTube connection — channel picker is shown via URL params (ytNewAccountId)
      fetchAccounts();
    } else if (connected) {
      toast({ title: "Connected", description: "Account linked successfully." });
      window.history.replaceState({}, "", window.location.pathname);
      fetchAccounts();
    }
  }, [fetchAccounts, toast]);

  const handleConnect = async (platform: ConnectedPlatform, addAnother = false, intendedHandle?: string) => {
    setConnecting(platform);
    try {
      // Store the intended channel handle so the post-OAuth modal is pre-filled correctly
      if (intendedHandle && typeof window !== "undefined") {
        localStorage.setItem("yt_intended_handle", intendedHandle.replace(/^@+/, ""));
      }
      const res = await fetch("/api/connected-accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, addAnother }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Cannot connect",
          description: json.error ?? "OAuth not configured for this platform.",
          variant: "destructive",
        });
        return;
      }
      if (json.authUrl) window.location.href = json.authUrl;
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to start connection",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const openManualToken = (platform: ConnectedPlatform) => {
    const pw = window.prompt("Password:");
    if (pw !== "cherry08") return;
    setManualTokenPlatform(platform);
    setManualTokenValue("");
    setManualTokenUsername("");
    setManualTokenUserId("");
    setManualTokenOpen(true);
  };

  const handleManualToken = async () => {
    if (!manualTokenPlatform || !manualTokenValue.trim()) return;
    setManualTokenSaving(true);
    try {
      const res = await fetch("/api/connected-accounts/manual-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: manualTokenPlatform,
          accessToken: manualTokenValue.trim(),
          platformUsername: manualTokenUsername.trim() || undefined,
          platformUserId: manualTokenUserId.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to save token");
      toast({ title: "Token saved", description: `${PLATFORM_LABELS[manualTokenPlatform]} token stored.` });
      setManualTokenOpen(false);
      fetchAccounts();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not save token",
        variant: "destructive",
      });
    } finally {
      setManualTokenSaving(false);
    }
  };

  const handleYtPickerSave = async () => {
    if (!ytPickerHandle.trim() || !activePickerAccountId) return;
    setYtPickerSaving(true);
    try {
      const res = await fetch(`/api/connected-accounts/youtube`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activePickerAccountId, channelHandle: ytPickerHandle.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to save");
      const handle = ytPickerHandle.trim().startsWith("@") ? ytPickerHandle.trim() : `@${ytPickerHandle.trim()}`;
      toast({ title: "Channel saved!", description: `Connected as ${handle}` });
      // Optimistically update local data so the fallback effect doesn't re-trigger
      // (race: URL clears → searchParams update → effect fires with stale unlabeled row)
      const savedId = activePickerAccountId;
      setData((prev) =>
        prev
          ? {
              ...prev,
              connected: prev.connected.map((a) =>
                a.id === savedId ? { ...a, platformUsername: handle } : a
              ),
            }
          : prev
      );
      setYtFallbackAccountId("");
      router.replace("/dashboard/settings/connected-accounts");
      fetchAccounts();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Could not save", variant: "destructive" });
    } finally {
      setYtPickerSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    try {
      const qs = disconnectTarget.accountId
        ? `?accountId=${encodeURIComponent(disconnectTarget.accountId)}`
        : "";
      const res = await fetch(`/api/connected-accounts/${disconnectTarget.platform}${qs}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to disconnect");
      }
      toast({ title: "Disconnected", description: `${PLATFORM_LABELS[disconnectTarget.platform]} has been disconnected.` });
      setDisconnectTarget(null);
      fetchAccounts();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not disconnect",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const connectedByPlatform =
    data?.connected.reduce(
      (acc, c) => {
        const key = c.platform as ConnectedPlatform;
        if (!acc[key]) acc[key] = [];
        acc[key].push(c);
        return acc;
      },
      {} as Record<ConnectedPlatform, ConnectedAccount[]>
    ) ?? {};
  const platforms = data?.platforms ?? (["tiktok", "youtube", "instagram", "facebook"] as ConnectedPlatform[]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <Card className="border-[#E5E7EB] bg-white dark:border-[#2A2A2A] dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Connected accounts
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Connect your social accounts to auto-publish videos from the Content Calendar. Tokens are
            stored securely and used only for publishing.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {platforms.map((platform) => {
            const accounts = connectedByPlatform[platform] ?? [];
            const isConnected = accounts.length > 0;
            const isConnecting = connecting === platform;
            const canAddAnother =
              (platform === "youtube" || platform === "instagram") && isConnected;
            const oauthBlocked = OAUTH_UNAVAILABLE.includes(platform) && !isConnected;

            return (
              <div key={platform} className="space-y-2">
                <div className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] bg-gray-50/50 p-4 dark:border-[#2A2A2A] dark:bg-[#0F0F0F]/50${oauthBlocked ? " opacity-50" : ""}`}>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{PLATFORM_LABELS[platform]}</p>
                    <p className="text-sm text-muted-foreground">{PLATFORM_DESCRIPTIONS[platform]}</p>

                    {isConnected && (
                      <div className="mt-2 space-y-1">
                        {accounts.map((account, idx) => {
                          const handle = account.platformUsername
                            ? account.platformUsername.startsWith("@")
                              ? account.platformUsername
                              : `@${account.platformUsername}`
                            : null;
                          return (
                            <p key={account.id} className="text-xs text-muted-foreground">
                              {handle
                                ? <><span className="font-medium text-foreground">{handle}</span>{" "}connected</>
                                : `Channel #${idx + 1} connected`}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled
                          className="bg-emerald-600 text-white hover:bg-emerald-600"
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Connected
                        </Button>
                        {canAddAnother && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              platform === "instagram"
                                ? openInstagramPreConnect()
                                : (setYtPreConnectHandle(""), setYtPreConnectOpen(true))
                            }
                            disabled={isConnecting}
                          >
                            {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            + Add another account
                          </Button>
                        )}
                      </>
                    ) : oauthBlocked ? (
                      <div className="flex flex-col items-end gap-1">
                        <Button size="sm" disabled className="bg-gray-300 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed">
                          Temporarily unavailable
                        </Button>
                        <button
                          type="button"
                          onClick={() => openManualToken(platform)}
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          Enter token manually →
                        </button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          platform === "instagram"
                            ? openInstagramPreConnect()
                            : platform === "youtube"
                              ? (setYtPreConnectHandle(""), setYtPreConnectOpen(true))
                              : void handleConnect(platform)
                        }
                        disabled={isConnecting}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>

                {isConnected && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {accounts.map((account, idx) => {
                      const handle = account.platformUsername
                        ? account.platformUsername.startsWith("@")
                          ? account.platformUsername
                          : `@${account.platformUsername}`
                        : `${PLATFORM_LABELS[platform]} #${idx + 1}`;
                      return (
                        <Button
                          key={account.id}
                          variant="outline"
                          size="sm"
                          onClick={() => setDisconnectTarget({ platform, accountId: account.id })}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Unplug className="mr-1 h-4 w-4" />
                          Disconnect {handle}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog
        open={instagramPreConnectOpen}
        onOpenChange={(open) => {
          if (open) {
            setInstagramPreConnectOpen(true);
          } else {
            closeInstagramPreConnect();
          }
        }}
      >
        <DialogContent className="border-[#E5E7EB] bg-white dark:border-[#2A2A2A] dark:bg-[#1A1A1A] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Before connecting Instagram</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex gap-3 rounded-lg border border-[#E5E7EB] bg-gray-50/50 p-3 dark:border-[#2A2A2A] dark:bg-[#0F0F0F]/50">
              <Checkbox
                id="ig-business-creator"
                checked={igBusinessConfirmed}
                onCheckedChange={(v) => setIgBusinessConfirmed(v === true)}
                className="mt-0.5"
              />
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="ig-business-creator"
                  className="cursor-pointer text-sm font-normal leading-snug text-gray-900 dark:text-white"
                >
                  My Instagram is a Business or Creator account
                </Label>
                <a
                  href="https://www.instagram.com/accounts/convert_to_professional_account"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:underline dark:text-orange-400"
                >
                  Switch here
                </a>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-[#E5E7EB] bg-gray-50/50 p-3 dark:border-[#2A2A2A] dark:bg-[#0F0F0F]/50">
              <Checkbox
                id="ig-facebook-linked"
                checked={igFacebookLinkedConfirmed}
                onCheckedChange={(v) => setIgFacebookLinkedConfirmed(v === true)}
                className="mt-0.5"
              />
              <div className="min-w-0 space-y-1">
                <Label
                  htmlFor="ig-facebook-linked"
                  className="cursor-pointer text-sm font-normal leading-snug text-gray-900 dark:text-white"
                >
                  My Instagram is linked to a Facebook Page
                </Label>
                <a
                  href="https://www.facebook.com/settings/?tab=linked_instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:underline dark:text-orange-400"
                >
                  Link here
                </a>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-gray-300 text-gray-700 dark:border-[#2A2A2A] dark:text-gray-300" onClick={closeInstagramPreConnect}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canStartInstagramOAuth || connecting === "instagram"}
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                closeInstagramPreConnect();
                void handleConnect("instagram");
              }}
            >
              {connecting === "instagram" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect Instagram
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualTokenOpen} onOpenChange={(open) => { if (!open) setManualTokenOpen(false); }}>
        <DialogContent className="border-[#E5E7EB] bg-white dark:border-[#2A2A2A] dark:bg-[#1A1A1A] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Enter {manualTokenPlatform ? PLATFORM_LABELS[manualTokenPlatform] : ""} token manually
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="manual-token" className="text-sm text-gray-900 dark:text-white">Access token</Label>
              <Input
                id="manual-token"
                type="password"
                placeholder="Paste access token..."
                value={manualTokenValue}
                onChange={(e) => setManualTokenValue(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-username" className="text-sm text-gray-900 dark:text-white">Username (optional)</Label>
              <Input
                id="manual-username"
                placeholder="@username"
                value={manualTokenUsername}
                onChange={(e) => setManualTokenUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-userid" className="text-sm text-gray-900 dark:text-white">Platform user ID (optional)</Label>
              <Input
                id="manual-userid"
                placeholder="numeric user ID"
                value={manualTokenUserId}
                onChange={(e) => setManualTokenUserId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-gray-300 text-gray-700 dark:border-[#2A2A2A] dark:text-gray-300" onClick={() => setManualTokenOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!manualTokenValue.trim() || manualTokenSaving}
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => void handleManualToken()}
            >
              {manualTokenSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── YouTube pre-connect: ask channel name BEFORE OAuth ── */}
      <Dialog open={ytPreConnectOpen} onOpenChange={(open) => { if (!open) setYtPreConnectOpen(false); }}>
        <DialogContent className="border-[#E5E7EB] bg-white dark:border-[#2A2A2A] dark:bg-[#1A1A1A] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Which channel are you adding?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 text-sm text-gray-700 dark:text-gray-300">
            <p>Enter the channel handle, then you&apos;ll be taken to Google.</p>
            <div className="space-y-1">
              <Label htmlFor="yt-pre-handle" className="text-sm text-gray-900 dark:text-white">Channel handle</Label>
              <div className="flex items-center gap-2 rounded-md border border-input px-3">
                <span className="text-muted-foreground select-none">@</span>
                <input
                  id="yt-pre-handle"
                  placeholder="smartincomecircle"
                  value={ytPreConnectHandle.replace(/^@+/, "")}
                  onChange={(e) => setYtPreConnectHandle(e.target.value)}
                  className="flex-1 bg-transparent py-2 text-sm outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs text-orange-800 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-300 space-y-1">
              <p className="font-semibold">On the Google screen:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Google will ask you to sign in — this is normal, even if you&apos;re already logged in</li>
                <li>After signing in, you&apos;ll see a list of accounts — <strong>select the brand channel</strong> that matches the handle above</li>
                <li>Grant the permissions and you&apos;ll be redirected back here</li>
              </ol>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-gray-300 text-gray-700 dark:border-[#2A2A2A] dark:text-gray-300"
              onClick={() => setYtPreConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!ytPreConnectHandle.trim() || ytPreConnecting}
              className="bg-orange-500 hover:bg-orange-600"
              onClick={async () => {
                setYtPreConnecting(true);
                setYtPreConnectOpen(false);
                await handleConnect("youtube", true, ytPreConnectHandle.trim());
                setYtPreConnecting(false);
              }}
            >
              {ytPreConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Go to Google →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── YouTube channel picker (post-OAuth) ── */}
      <Dialog
        open={Boolean(activePickerAccountId)}
        onOpenChange={(open) => {
          if (!open) {
            setYtFallbackAccountId("");
            router.replace("/dashboard/settings/connected-accounts");
          }
        }}
      >
        <DialogContent className="border-[#E5E7EB] bg-white dark:border-[#2A2A2A] dark:bg-[#1A1A1A] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Which YouTube channel is this?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 text-sm text-gray-700 dark:text-gray-300">
            <p>
              Enter the handle for the channel you just connected. This is the <span className="font-semibold">@handle</span> shown on your YouTube channel page.
            </p>
            <div className="space-y-1">
              <Label htmlFor="yt-handle" className="text-sm text-gray-900 dark:text-white">Channel handle</Label>
              <div className="flex items-center gap-2 rounded-md border border-input px-3">
                <span className="text-muted-foreground select-none">@</span>
                <input
                  id="yt-handle"
                  placeholder="historyai"
                  value={ytPickerHandle.replace(/^@+/, "")}
                  onChange={(e) => setYtPickerHandle(e.target.value)}
                  className="flex-1 bg-transparent py-2 text-sm outline-none"
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-gray-300 text-gray-700 dark:border-[#2A2A2A] dark:text-gray-300"
              onClick={() => { setYtFallbackAccountId(""); router.replace("/dashboard/settings/connected-accounts"); }}>
              Skip
            </Button>
            <Button
              type="button"
              disabled={!ytPickerHandle.trim() || ytPickerSaving}
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => void handleYtPickerSave()}
            >
              {ytPickerSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {disconnectTarget ? PLATFORM_LABELS[disconnectTarget.platform] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Stored access tokens will be removed. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
