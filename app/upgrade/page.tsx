/**
 * Upgrade redirect - sends users to pricing/checkout.
 * Used by UGC Lab and other premium feature upgrade prompts.
 */
import { redirect } from "next/navigation";

export default function UpgradePage() {
  redirect("/pricing");
}
