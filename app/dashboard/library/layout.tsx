import { FeatureGate } from "@/components/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="my_library" label="My Library">
      {children}
    </FeatureGate>
  );
}
