import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// One sans-serif family for the entire product — Geist Sans — with Geist Mono
// for code/ids. Clean, neutral, enterprise-grade; no mixed display faces.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#090d16] text-slate-100 antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
