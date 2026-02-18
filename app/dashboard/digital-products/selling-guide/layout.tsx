import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Selling Platforms Guide | Digital Products",
  description: "Where to sell your digital product — Stan Store, Beacons, Gumroad, Etsy, Creative Market, Shopify, Payhip",
};

export default function SellingGuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
