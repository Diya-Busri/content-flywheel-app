import { FeatureGate } from "@/components/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="brand_builder" label="Brand Builder">
      {children}
    </FeatureGate>
  );
}
