import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./storybook.css";
import { Providers } from "@/components/Providers";
import { SEO_KEYWORDS } from "@/lib/seo";
import { PaintDefs } from "@/components/storybook/PaintDefs";
import { StorybookEffects } from "@/components/storybook/StorybookEffects";

// The four typefaces are self-hosted (src/app/fonts, latin subset, from Google Fonts, SIL OFL).
// Fetching them from Google at build time broke deploys when Google changed what it returned.
const sans = localFont({
  src: [
    { path: "./fonts/inter-normal-100.woff2", weight: "100", style: "normal" },
    { path: "./fonts/inter-normal-200.woff2", weight: "200", style: "normal" },
    { path: "./fonts/inter-normal-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/inter-normal-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-normal-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-normal-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-normal-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/inter-normal-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/inter-normal-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const script = localFont({
  src: [
    { path: "./fonts/caveat-normal-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/caveat-normal-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/caveat-normal-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/caveat-normal-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-script",
  display: "swap",
});
// Editorial display serif for desktop section headlines (magazine/WordPress
// feel) — mobile keeps the sans headings untouched, this is opt-in via
// `font-serif` only in desktop-only markup.
const serif = localFont({
  src: [
    { path: "./fonts/fraunces-italic-400.woff2", weight: "400", style: "italic" },
    { path: "./fonts/fraunces-italic-500.woff2", weight: "500", style: "italic" },
    { path: "./fonts/fraunces-italic-600.woff2", weight: "600", style: "italic" },
    { path: "./fonts/fraunces-italic-700.woff2", weight: "700", style: "italic" },
    { path: "./fonts/fraunces-normal-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/fraunces-normal-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/fraunces-normal-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/fraunces-normal-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
});

// Hand-lettered storybook sans for the painted desktop theme (storybook.css
// points --font-sans at this on screens ≥1024px; phones keep Inter).
const ui = localFont({
  src: [
    { path: "./fonts/alegreya-italic-400.woff2", weight: "400", style: "italic" },
    { path: "./fonts/alegreya-italic-500.woff2", weight: "500", style: "italic" },
    { path: "./fonts/alegreya-italic-700.woff2", weight: "700", style: "italic" },
    { path: "./fonts/alegreya-italic-800.woff2", weight: "800", style: "italic" },
    { path: "./fonts/alegreya-normal-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/alegreya-normal-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/alegreya-normal-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/alegreya-normal-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://saafera.com"),
  title: {
    default: "Saafera – Smart Travel Planning for India",
    template: "%s | Saafera",
  },
  description:
    "Plan memorable India trips with Saafera. Discover places, build budget-friendly routes, compare stays, and explore festivals and hidden gems.",
  keywords: SEO_KEYWORDS,
  applicationName: "Saafera",
  manifest: "/manifest.webmanifest",
  authors: [{ name: "Saafera" }],
  creator: "Saafera",
  publisher: "Saafera",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://saafera.com",
    siteName: "Saafera",
    title: "Saafera – Smart Travel Planning for India",
    description:
      "Plan memorable India trips with Saafera. Discover places, build budget-friendly routes, and explore festivals and hidden gems.",
    images: [
      {
        url: "/saafera-logo.jpg",
        width: 1200,
        height: 630,
        alt: "Saafera travel planning app",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Saafera – Smart Travel Planning for India",
    description:
      "Plan memorable India trips with Saafera. Discover places, build budget-friendly routes, and explore festivals and hidden gems.",
    images: ["/saafera-logo.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/icons/icon-512.png",
    shortcut: "/icons/icon-512.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f6b45",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${script.variable} ${serif.variable} ${ui.variable}`} data-theme="light">
      <head>
        {/* Apply the saved theme before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('yatra-point/theme');if(t==='dark'||t==='vibrant'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <PaintDefs />
        <Providers>{children}</Providers>
        <StorybookEffects />
      </body>
    </html>
  );
}
