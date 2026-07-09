import { FeatureGate } from "@/components/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="ai_coach" label="AI Coach">
      {children}
    </FeatureGate>
  );
}
