import type { Metadata } from "next";
import { Inter, Caveat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const script = Caveat({ subsets: ["latin"], variable: "--font-script" });

export const metadata: Metadata = {
  metadataBase: new URL("https://saafera.com"),
  title: {
    default: "Saafera – Smart Travel Planning for India",
    template: "%s | Saafera",
  },
  description:
    "Plan memorable India trips with Saafera. Discover places, build budget-friendly routes, compare stays, and explore festivals and hidden gems.",
  keywords: [
    "India travel planner",
    "trip planner",
    "budget travel India",
    "tourist places",
    "festivals in India",
    "hidden places",
    "one day trip planner",
  ],
  applicationName: "Saafera",
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
    icon: "/saafera-logo.jpg",
    shortcut: "/saafera-logo.jpg",
    apple: "/saafera-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${script.variable}`} data-theme="light">
      <head>
        {/* Apply the saved theme before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('yatra-point/theme');if(t==='dark'||t==='vibrant'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
