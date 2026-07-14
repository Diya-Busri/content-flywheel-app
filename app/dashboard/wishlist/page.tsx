import { isFeatureEnabledForVisitors } from "@/lib/feature-flags";
import WishlistClient from "./WishlistClient";

export default async function WishlistPage() {
  const marketplaceEnabled = await isFeatureEnabledForVisitors("marketplace");
  return <WishlistClient marketplaceEnabled={marketplaceEnabled} />;
}
