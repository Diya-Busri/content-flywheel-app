import { redirect } from "next/navigation";

export const metadata = {
  title: "How It Works | Content Flywheel",
  description: "From idea to income in one afternoon. See how Content Flywheel takes you from idea to paying customers.",
};

export default function JourneyPage() {
  redirect("/#journey");
}
