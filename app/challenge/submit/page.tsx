import type { Metadata } from "next";
import { LightNavbar } from "@/components/marketing/light-navbar";
import { LightFooter } from "@/components/marketing/light-footer";
import { ChallengeSubmissionForm } from "@/components/challenge/ChallengeSubmissionForm";

const SITE_URL = "https://contentflywheel.co.uk";

export const metadata: Metadata = {
  title: "Submit Your Product — 100 Product Challenge | Content Flywheel",
  description: "Submit your digital product to the 100 Product Challenge. Free to submit, no account required, public or anonymous options available.",
  alternates: { canonical: `${SITE_URL}/challenge/submit` },
};

export default function ChallengeSubmitPage() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: "#fff" }}>
      <LightNavbar />
      <main style={{ background: "#f9fafb", padding: "48px 16px 80px" }}>
        <ChallengeSubmissionForm />
      </main>
      <LightFooter />
    </div>
  );
}
