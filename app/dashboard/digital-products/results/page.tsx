/**
 * Digital Products - Step 4: Final videos + download (after generation)
 */
import type { Metadata } from "next";
import ResultsFlow from "./ResultsFlow";

export const metadata: Metadata = {
  title: "Your Videos | Digital Products | Content Flywheel",
  description: "Download your generated videos",
};

export default function DigitalProductsResultsPage() {
  return <ResultsFlow />;
}
