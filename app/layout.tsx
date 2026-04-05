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

export const metadata: Metadata = {
  title: "Vocalis",
  description: "AI phone receptionist for your business",
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
