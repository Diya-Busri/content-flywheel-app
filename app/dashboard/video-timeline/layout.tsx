import { FeatureGate } from "@/components/FeatureGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate featureKey="video_timeline" label="Video Timeline">
      {children}
    </FeatureGate>
  );
}
