import { FeatureGate } from "@/components/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="drop_campaign" label="Drop Campaign">
      {children}
    </FeatureGate>
  );
}
