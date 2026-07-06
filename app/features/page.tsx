import { redirect } from "next/navigation";

export const metadata = {
  title: "Features | Content Flywheel",
  description: "AI-powered tools to build, sell, and market digital products. One platform, everything connected.",
};

export default function FeaturesPage() {
  redirect("/#features");
}
