import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    // Community photo uploads are sent as data URLs through a Server Action;
    // the default 1 MB limit is too small even for a compressed photo.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
