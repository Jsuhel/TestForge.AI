import type { Metadata } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import { EngineStatusBanner } from "@/components/layout/EngineStatusBanner";
import "./globals.css";

// Typography mirrors the marketing landing page (testforge-qa.vercel.app):
// Sora for display/headlines, Inter for UI text, JetBrains Mono for code and
// ids — one system across both sites.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TestForge AI - AI-Powered QA Automation Platform",
  description: "AI-powered test automation from requirements to execution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable} min-h-screen bg-[#0a0a0b] text-zinc-100 antialiased font-sans`}
      >
        <EngineStatusBanner />
        {children}
      </body>
    </html>
  );
}
