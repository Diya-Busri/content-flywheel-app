import type { Metadata } from "next";
import TodayFlow from "./TodayFlow";

export const metadata: Metadata = {
  title: "Today's Schedule | Goal Tracker | Content Flywheel",
  description: "Full daily schedule across all goals",
};

export default function TodaySchedulePage() {
  return <TodayFlow />;
}
