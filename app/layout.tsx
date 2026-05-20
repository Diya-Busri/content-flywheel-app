import { PaymentStatusAlert } from "@/components/payment/payment-status-alert";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/utilities/providers";
import LayoutWrapper from "@/components/layout-wrapper";
import { ClerkProvider } from "@clerk/nextjs";
import { CoachOpenProvider } from "@/components/coach/CoachOpenContext";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Content Flywheel — Create & Sell Digital Products with AI",
  description:
    "Build ebooks, planners and templates with AI. Sell from your own store. Market with email sequences, affiliates and discount codes. All in one platform.",
  metadataBase: new URL("https://contentflywheel.co.uk"),
  icons: { icon: "/icon.svg" },
  alternates: {
    canonical: "https://contentflywheel.co.uk",
  },
  openGraph: {
    title: "Content Flywheel — Create & Sell Digital Products with AI",
    description:
      "Build ebooks, planners and templates with AI. Sell from your own store. Market with email sequences, affiliates and discount codes. All in one platform.",
    url: "https://contentflywheel.co.uk",
    siteName: "Content Flywheel",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Content Flywheel — Create & Sell Digital Products with AI",
    description:
      "Build ebooks, planners and templates with AI. Sell from your own store. Market with email sequences, affiliates and discount codes.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
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
      fallbackRedirectUrl="/dashboard"
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Content Flywheel",
                "url": "https://contentflywheel.co.uk",
                "logo": "https://contentflywheel.co.uk/logo.png",
              }),
            }}
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=Nunito:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          className={`${inter.className} min-h-screen bg-background text-foreground transition-colors duration-300 antialiased`}
          suppressHydrationWarning
        >
          <Providers
            attribute="class"
            defaultTheme="light"
            enableSystem
            storageKey="content-flywheel-theme"
          >
            <CoachOpenProvider>
              <LayoutWrapper>
                <PaymentStatusAlert />
                {children}
              </LayoutWrapper>
              <Toaster />
            </CoachOpenProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
