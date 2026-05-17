import type { Metadata } from "next";
import { DesignStudioLanding } from "./DesignStudioLanding";

export const metadata: Metadata = {
  title: "Design Studio | Content Flywheel",
  description: "Create posters, invitations, social posts, and more",
};

export default function DesignStudioPage() {
  return <DesignStudioLanding />;
}
