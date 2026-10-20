import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { TickerTape } from "@/components/shell/ticker-tape";
import { Topbar } from "@/components/shell/topbar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Stock Analyses — Global Market Terminal", template: "%s · Stock Analyses" },
  description: "Real-time global markets dashboard: world indices, rates, FX, commodities, crypto, calendars and AI stock analysis.",
};

export const viewport: Viewport = {
  themeColor: "#05070b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <div className="flex min-h-dvh">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <TickerTape />
              <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 pb-24 pt-4 sm:px-4 lg:px-6 lg:pb-10">{children}</main>
            </div>
          </div>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
