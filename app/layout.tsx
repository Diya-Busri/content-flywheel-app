import { PaymentStatusAlert } from "@/components/payment/payment-status-alert";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/utilities/providers";
import LayoutWrapper from "@/components/layout-wrapper";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Content Flywheel - AI Video Generation for Social Media",
  description:
    "Turn products into sales-driving videos for TikTok, Instagram, and YouTube. AI-powered video creation focused on conversion, not vanity metrics.",
};

// Root layout is synchronous - no blocking auth() call. Sign-in/sign-up pages load instantly.
// PaymentStatusAlert uses useAuth() and renders nothing when unauthenticated.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.className} min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300`} suppressHydrationWarning>
          <Providers
            attribute="class"
            defaultTheme="light"
            enableSystem
            storageKey="content-flywheel-theme"
          >
            <LayoutWrapper>
              <PaymentStatusAlert />
              {children}
            </LayoutWrapper>
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
