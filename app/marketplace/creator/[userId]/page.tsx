import { redirect } from "next/navigation";

export default function CreatorMarketplacePage({ params }: { params: { userId: string } }) {
  redirect(`/c/${params.userId}`);
}
