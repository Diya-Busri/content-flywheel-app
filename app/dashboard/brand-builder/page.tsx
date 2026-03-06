import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BrandBuilderClient from "./BrandBuilderClient";

export const metadata: Metadata = {
  title: "Brand Builder | Content Flywheel",
  description: "Content calendar, captions, drop scripts, and launch checklist for your brand",
};

export default function BrandBuilderPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <BrandBuilderClient />
    </main>
  );
}
