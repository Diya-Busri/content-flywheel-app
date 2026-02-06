/**
 * TikTok Shop flow (Flow 2) - Generate videos for TikTok Shop
 */
import type { Metadata } from "next";
import TikTokShopFlow from "./TikTokShopFlow";

export const metadata: Metadata = {
  title: "TikTok Shop | Content Flywheel",
  description: "Generate AI-powered videos for TikTok Shop",
};

export default function TikTokShopPage() {
  return <TikTokShopFlow />;
}
