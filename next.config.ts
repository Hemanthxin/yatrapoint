import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow any HTTPS image host. Place photos come from many sources
    // (Wikimedia, LoremFlickr, Picsum, Google, admin-supplied URLs); an
    // allowlist silently blanked heroes whose domain wasn't listed.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // Community photo uploads are sent as data URLs through a Server Action;
    // the default 1 MB limit is too small even for a compressed photo.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
