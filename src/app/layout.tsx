import type { Metadata, Viewport } from "next";
import { Inter, Caveat, Fraunces, Alegreya_Sans } from "next/font/google";
import "./globals.css";
import "./storybook.css";
import { Providers } from "@/components/Providers";
import { SEO_KEYWORDS } from "@/lib/seo";
import { PaintDefs } from "@/components/storybook/PaintDefs";
import { StorybookEffects } from "@/components/storybook/StorybookEffects";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const script = Caveat({ subsets: ["latin"], variable: "--font-script" });
// Editorial display serif for desktop section headlines (magazine/WordPress
// feel) — mobile keeps the sans headings untouched, this is opt-in via
// `font-serif` only in desktop-only markup.
const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

// Hand-lettered storybook sans for the painted desktop theme (storybook.css
// points --font-sans at this on screens ≥1024px; phones keep Inter).
const ui = Alegreya_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  style: ["normal", "italic"],
  weight: ["400", "500", "700", "800"],
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
