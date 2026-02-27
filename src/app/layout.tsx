/**
 * layout.tsx — Root layout for the entire application
 *
 * PURPOSE:
 *   Sets up the global HTML shell, fonts, providers, and toast notifications.
 *   Every page in the app renders inside this layout.
 *
 * WHAT IT PROVIDES:
 *   - Geist Sans + Geist Mono fonts (loaded locally for performance)
 *   - TanStack Query provider (via Providers component) for server state
 *   - Sonner toast notifications (global, available on every page)
 *   - Dark theme base styling via Tailwind
 *
 * ARCHITECTURE:
 *   - Wraps: Providers (TanStack Query) → children → Toaster (Sonner)
 *   - Used by: Every page and layout in the app
 */

import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "webinar.ai — Dynamic Video A/B Testing",
  description:
    "Test hooks, bodies, and CTAs in any combination through a single embed code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
