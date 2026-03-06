import { ContentStudioProvider } from "./ContentStudioContext";

export default function ContentStudioCreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ContentStudioProvider>{children}</ContentStudioProvider>;
}
