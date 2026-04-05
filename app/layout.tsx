import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppProvider } from "@/components/providers/app-provider";
import { ClinicOnboardingGate } from "@/components/onboarding/clinic-onboarding-gate";
import { Toaster } from "@/components/ui/sonner";

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
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
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
