import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppProvider } from "@/components/providers/app-provider";
import { ClinicOnboardingGate } from "@/components/onboarding/clinic-onboarding-gate";
import { Toaster } from "@/components/ui/sonner";

/** Avoid CDN / browser serving stale HTML that references old `_next/static` chunks after deploy. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vocalis.team";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Vocalis",
    template: "%s | Vocalis",
  },
  description:
    "AI-powered voice receptionist for clinics and service businesses—answers calls 24/7, schedules, troubleshoots, and escalates when it matters.",
  applicationName: "Vocalis",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/png" },
      { url: "/icon", type: "image/png", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Vocalis",
    title: "Vocalis — AI voice receptionist",
    description:
      "AI-powered voice agent handles inbound calls around the clock—appointments, troubleshooting, and consistent caller experience.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vocalis — AI voice receptionist",
    description:
      "AI-powered voice agent handles inbound calls around the clock—appointments, troubleshooting, and consistent caller experience.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppProvider>
          <ClinicOnboardingGate>{children}</ClinicOnboardingGate>
          <Toaster />
        </AppProvider>
      </body>
    </html>
  );
}
