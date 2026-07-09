import { FeatureGate } from "@/components/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="ugc_lab" label="UGC Lab">
      {children}
    </FeatureGate>
  );
}
