/**
 * Script Checker flow (Flow 3) - Check script compliance with platform guidelines
 */
import type { Metadata } from "next";
import ScriptCheckerFlow from "./ScriptCheckerFlow";

export const metadata: Metadata = {
  title: "Script Checker | Content Flywheel",
  description: "Check your scripts for platform compliance",
};

export default function ScriptCheckerPage() {
  return <ScriptCheckerFlow />;
}
