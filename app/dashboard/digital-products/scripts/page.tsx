/**
 * Digital Products - Step 2: Customize Your Video Scripts
 */
import type { Metadata } from "next";
import ScriptsFlow from "./ScriptsFlow";

export const metadata: Metadata = {
  title: "Customize Scripts | Digital Products | Content Flywheel",
  description: "Edit and customize your video scripts before generating videos",
};

export default function DigitalProductsScriptsPage() {
  return <ScriptsFlow />;
}
