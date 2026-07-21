import type { MetadataRoute } from "next";

const baseUrl = "https://saafera.com";

const routes = [
  "/",
  "/about",
  "/budget-planner",
  "/community",
  "/dashboard",
  "/destinations",
  "/faq",
  "/festivals",
  "/multi-stop",
  "/one-day-trips",
  "/privacy",
  "/stays",
  "/terms",
  "/trip-cart",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
