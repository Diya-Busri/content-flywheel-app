import { FeatureGate } from "@/components/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="video_credits" label="Video Credits">
      {children}
    </FeatureGate>
  );
}
