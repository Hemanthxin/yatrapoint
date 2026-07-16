// Exports ONLY the newly added all-India destinations to a fresh Excel workbook.
// One "New Destinations" sheet with a clean, human-readable column layout
// (name, full location, entry fee, map link, etc.). Run:
//   npx tsx scripts/export-new-india.ts
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { indiaDestinations } from "../src/lib/db/seed-india";
import { placeMapUrl } from "../src/lib/maps";
import { categoryLabel } from "../src/lib/catalog/categories";

// Stable output name (no timestamp) so it is easy to find and re-generate.
const OUT = path.join(process.cwd(), "exports", "new-india-destinations.xlsx");

const rows = indiaDestinations.map((d, i) => ({
  "#": i + 1,
  Name: d.name,
  State: d.state,
  District: d.district ?? "",
  Location: [d.district, d.state].filter(Boolean).join(", "),
  Category: categoryLabel(d.category),
  "Place Type": d.placeType ?? "",
  "Entry Fee (INR, Indian adult)": d.entryFees ?? 0,
  "Entry Fee (display)": (d.entryFees ?? 0) === 0 ? "Free" : `₹${d.entryFees}`,
  "Opening Timings": d.openingTimings ?? "Open 24 hours",
  "Budget / day (INR)": d.budgetPerDay,
  "Recommended Days": d.recommendedDays,
  "Best Months": d.bestMonths ?? "",
  Latitude: d.latitude ?? "",
  Longitude: d.longitude ?? "",
  "Coordinates": [d.latitude, d.longitude].filter(Boolean).join(", "),
  "Google Maps Link": placeMapUrl(d as any),
  Popularity: d.popularity,
  "Hidden Gem": d.isHidden ? "Yes" : "No",
  Slug: d.slug,
  "Short Description": d.shortDescription,
  Description: d.description,
}));

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);

// Sensible column widths so the sheet is readable on open.
ws["!cols"] = [
  { wch: 5 }, // #
  { wch: 34 }, // Name
  { wch: 20 }, // State
  { wch: 20 }, // District
  { wch: 34 }, // Location
  { wch: 14 }, // Category
  { wch: 18 }, // Place Type
  { wch: 14 }, // Entry Fee INR
  { wch: 12 }, // Entry Fee display
  { wch: 30 }, // Opening Timings
  { wch: 14 }, // Budget/day
  { wch: 10 }, // Recommended Days
  { wch: 22 }, // Best Months
  { wch: 12 }, // Latitude
  { wch: 12 }, // Longitude
  { wch: 22 }, // Coordinates
  { wch: 60 }, // Google Maps Link
  { wch: 10 }, // Popularity
  { wch: 10 }, // Hidden Gem
  { wch: 28 }, // Slug
  { wch: 60 }, // Short Description
  { wch: 90 }, // Description
];

XLSX.utils.book_append_sheet(wb, ws, "New Destinations");

// A second sheet: per-state summary counts.
const perState = new Map<string, number>();
for (const d of indiaDestinations) perState.set(d.state, (perState.get(d.state) ?? 0) + 1);
const summary = [...perState.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([State, Count]) => ({ State, "Places Added": Count }));
summary.push({ State: "TOTAL", "Places Added": indiaDestinations.length });
const ws2 = XLSX.utils.json_to_sheet(summary);
ws2["!cols"] = [{ wch: 30 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, ws2, "Summary by State");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
XLSX.writeFile(wb, OUT);
console.log(`Wrote ${rows.length} new destinations to ${OUT}`);
