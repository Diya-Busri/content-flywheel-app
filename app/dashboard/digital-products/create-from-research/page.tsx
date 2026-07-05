import type { Metadata } from "next";
import { Suspense } from "react";
import CreateFromResearch from "./CreateFromResearch";

export const metadata: Metadata = {
  title: "Create Product | Content Flywheel",
  description: "Build your product from AI research",
};

export default function CreateFromResearchPage() {
  return (
    <Suspense>
      <CreateFromResearch />
    </Suspense>
  );
}
