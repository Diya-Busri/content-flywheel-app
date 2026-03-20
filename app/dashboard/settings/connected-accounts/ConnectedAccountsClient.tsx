"use client";

import { useState, useEffect, useCallback } from "react";
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
import { ArrowLeft, Check, Loader2, Unplug } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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
  instagram: "Post reels to your Instagram account",
  facebook: "Share videos to your Facebook page",
};

export default function ConnectedAccountsClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<ConnectedPlatform | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<{ platform: ConnectedPlatform; accountId?: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();

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
    if (error) {
      toast({ title: "Connection failed", description: error, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (connected) {
      toast({ title: "Connected", description: "Account linked successfully." });
      window.history.replaceState({}, "", window.location.pathname);
      fetchAccounts();
    }
  }, [fetchAccounts, toast]);

  const handleConnect = async (platform: ConnectedPlatform) => {
    setConnecting(platform);
    try {
      const res = await fetch("/api/connected-accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
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

            return (
              <div key={platform} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] bg-gray-50/50 p-4 dark:border-[#2A2A2A] dark:bg-[#0F0F0F]/50">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{PLATFORM_LABELS[platform]}</p>
                    <p className="text-sm text-muted-foreground">{PLATFORM_DESCRIPTIONS[platform]}</p>

                    {isConnected && (
                      <div className="mt-2 space-y-1">
                        {accounts.map((account, idx) => (
                          <p key={account.id} className="text-xs text-muted-foreground">
                            Connected #{idx + 1}
                            {account.platformUsername ? ` as @${account.platformUsername}` : ""}
                          </p>
                        ))}
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
                            onClick={() => void handleConnect(platform)}
                            disabled={isConnecting}
                          >
                            {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            + Add another account
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(platform)}
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
                    {accounts.map((account, idx) => (
                      <Button
                        key={account.id}
                        variant="outline"
                        size="sm"
                        onClick={() => setDisconnectTarget({ platform, accountId: account.id })}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Unplug className="mr-1 h-4 w-4" />
                        Disconnect {PLATFORM_LABELS[platform]} #{idx + 1}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Required env: TikTok (<code>TIKTOK_CLIENT_KEY</code>, <code>TIKTOK_CLIENT_SECRET</code>), YouTube (
        <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>), Facebook (
        <code>FACEBOOK_APP_ID</code>, <code>FACEBOOK_APP_SECRET</code>), Instagram Business Login (
        <code>INSTAGRAM_APP_ID</code> (Instagram App ID from Meta → Instagram → Business login; required for Instagram
        connect), <code>INSTAGRAM_APP_SECRET</code> or <code>FACEBOOK_APP_SECRET</code> for the token exchange). Set{" "}
        <code>NEXT_PUBLIC_APP_URL</code> to your app URL.
        Add <code>https://contentflywheel.co.uk/api/connected-accounts/callback</code> under Facebook Login → Valid
        OAuth Redirect URIs and under Instagram → API setup with Instagram login → OAuth redirect URIs.
      </p>

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
