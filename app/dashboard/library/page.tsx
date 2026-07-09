/**
 * My Library - Unified content library (products, videos, scripts)
 */
import type { Metadata } from "next";
import LibraryFlow from "./LibraryFlow";

export const metadata: Metadata = {
  title: "My Library | Content Flywheel",
  description: "Your digital products, videos, and scripts in one place",
};

export default function LibraryPage() {
  return <LibraryFlow />;
}
