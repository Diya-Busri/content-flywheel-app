/**
 * Digital Products - Two-path onboarding landing
 */
import type { Metadata } from "next";
import DigitalProductsLanding from "./DigitalProductsLanding";

export const metadata: Metadata = {
  title: "Digital Products | Content Flywheel",
  description: "Create AI-powered videos for your digital products",
};

export default function DigitalProductsPage() {
  return <DigitalProductsLanding />;
}
