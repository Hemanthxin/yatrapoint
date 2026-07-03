import type { Metadata } from "next";
import { Inter, Caveat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const script = Caveat({ subsets: ["latin"], variable: "--font-script" });

export const metadata: Metadata = {
  title: "Saafera – Explore More. Fulfill Soul.",
  description:
    "Budget-friendly travel planning. From ancient temples to majestic waterfalls, find the perfect trip within your budget.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${script.variable}`}>
      <body className="min-h-screen bg-white text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
