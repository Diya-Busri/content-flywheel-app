/**
 * My Library - Unified content library (products, videos, scripts)
 * Server component: fetches disabled feature flags so Library tabs
 * cascade-hide when an admin disables a feature (e.g. Template Studio → hides
 * Template Packs + Templates tabs; YouTube Upload → hides YouTube tab).
 */
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { getDisabledFeatures } from "@/lib/feature-flags";
import LibraryFlow from "./LibraryFlow";

export const metadata: Metadata = {
  title: "My Library | Content Flywheel",
  description: "Your digital products, videos, and scripts in one place",
};

export default async function LibraryPage() {
  const { userId } = await auth();
  const disabledFeatures = userId
    ? Array.from(await getDisabledFeatures(userId))
    : [];

  return <LibraryFlow disabledFeatures={disabledFeatures} />;
}
