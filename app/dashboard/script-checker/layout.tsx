import { FeatureGate } from "@/components/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="script_checker" label="Script Checker">
      {children}
    </FeatureGate>
  );
}
