import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "智能书签管家 (AI Bookmark)",
  description: "AI-powered bookmark manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="dark">
      <body className={`${outfit.variable} font-sans antialiased text-zinc-900 dark:text-zinc-50 bg-zinc-50 dark:bg-black selection:bg-blue-500/30 selection:text-blue-200`}>
        {/* Animated Gradient Background */}
        <div className="fixed inset-0 z-[-1] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 dark:from-indigo-500/20 dark:via-purple-500/10 dark:to-emerald-500/10 pointer-events-none" />
        <div className="fixed inset-0 z-[-1] bg-[url('/noise.svg')] opacity-[0.03] dark:opacity-[0.05] pointer-events-none mix-blend-overlay" />
        
        {children}
      </body>
    </html>
  );
}
