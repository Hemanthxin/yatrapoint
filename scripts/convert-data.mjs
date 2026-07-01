// Parses every file in /Data into clean, normalized JSON under
// src/lib/db/data/. Uses SheetJS for robust CSV + XLSX parsing.
// Run: node scripts/convert-data.mjs
import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const DATA = "Data";
const OUT = "src/lib/db/data";
fs.mkdirSync(OUT, { recursive: true });

// ---- helpers ---------------------------------------------------------------
const num = (v) => {
  if (v == null) return null;
  const m = String(v).replace(/[,₹\s]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const int = (v) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};
const str = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

function readSheet(file, sheetName = null, range = 0) {
  const wb = XLSX.read(fs.readFileSync(path.join(DATA, file)), { type: "buffer" });
  const sn = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[sn];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, range, blankrows: false });
}
function write(name, arr) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(arr, null, 0));
  console.log(`  ${name}: ${arr.length}`);
}
const uniqSlug = (base, seen) => {
  let s = base || "item";
  let i = 2;
  while (seen.has(s)) s = `${base}-${i++}`;
  seen.add(s);
  return s;
};

console.log("Converting Data/ →", OUT);

// ---- 1) Karnataka state-controlled temples (real, geocoded) ----------------
{
  const rows = readSheet("20230129_ka_temples_under_state_control_geocoded.csv");
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const name = str(r.TempleName);
    const lat = num(r.Latitude);
    const lng = num(r.Longitude);
    if (!name || lat == null || lng == null) continue;
    out.push({
      slug: uniqSlug("ka-temple-" + slugify(name), seen),
      name,
      area: str(r.Address),
      city: str(r.City) || "Karnataka",
      district: str(r.District),
      zip: str(r.ZipCode),
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    });
  }
  write("temples.json", out);
}

// ---- 2) Top Indian places (browse enrichment for destinations) -------------
{
  const rows = readSheet("Top Indian Places to Visit.csv");
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const name = str(r.Name);
    const state = str(r.State);
    if (!name || !state) continue;
    out.push({
      slug: uniqSlug(slugify(name), seen),
      name,
      state,
      city: str(r.City),
      zone: str(r.Zone),
      type: str(r.Type),
      establishmentYear: str(r["Establishment Year"]),
      timeHrs: num(r["time needed to visit in hrs"]),
      rating: num(r["Google review rating"]),
      entryFee: int(r["Entrance Fee in INR"]) ?? 0,
      airportNearby: str(r["Airport with 50km Radius"]),
      weeklyOff: str(r["Weekly Off"]),
      significance: str(r["Significance"]),
      dslrAllowed: str(r["DSLR Allowed"]),
      reviewsLakhs: num(r["Number of google review in lakhs"]),
      bestTime: str(r["Best Time to visit"]),
    });
  }
  write("top-places.json", out);
}

// ---- 3) Hotels (merged, deduped) -------------------------------------------
{
  const seen = new Set();
  const byKey = new Map(); // name|city -> hotel (first wins, then fill gaps)
  const add = (h) => {
    if (!h.name) return;
    const key = h.name.toLowerCase() + "|" + (h.city || "").toLowerCase();
    if (byKey.has(key)) {
      // fill missing fields from later sources
      const ex = byKey.get(key);
      for (const k of Object.keys(h)) if (ex[k] == null && h[k] != null) ex[k] = h[k];
      return;
    }
    byKey.set(key, h);
  };

  // 3a) booking.com — India-wide, has GPS + ratings, no price
  {
    const rows = readSheet("booking_com-travel_sample.csv");
    for (const r of rows) {
      const name = str(r.property_name);
      if (!name) continue;
      add({
        name,
        city: str(r.city),
        area: str(r.locality),
        state: str(r.state) || str(r.province),
        lat: num(r.latitude) != null ? num(r.latitude).toFixed(6) : null,
        lng: num(r.longitude) != null ? num(r.longitude).toFixed(6) : null,
        pricePerNight: null,
        taxPerNight: null,
        rating: num(r.site_review_rating),
        starRating: num(r.hotel_star_rating),
        reviews: int(r.site_review_count),
        brand: str(r.hotel_brand),
        propertyType: str(r.property_type),
        roomType: str(r.room_type),
        nearestLandmark: null,
        source: "booking.com",
      });
    }
  }
  // 3b) OYO — India-wide, has price + rating
  {
    const rows = readSheet("OYO_HOTEL_ROOMS.csv");
    for (const r of rows) {
      const name = str(r.Hotel_name);
      if (!name) continue;
      const loc = str(r.Location) || "";
      const city = loc.includes(",") ? str(loc.split(",").pop()) : loc || null;
      add({
        name,
        city,
        area: loc,
        state: null,
        lat: null,
        lng: null,
        pricePerNight: int(r.Price),
        taxPerNight: null,
        rating: null,
        starRating: null,
        reviews: int(r.Rating),
        brand: "OYO",
        propertyType: "Hotel",
        roomType: null,
        nearestLandmark: null,
        source: "OYO",
      });
    }
  }
  // 3c) bangalore.csv — Bengaluru, price + tax + star + landmark
  {
    const rows = readSheet("bangalore.csv");
    for (const r of rows) {
      const name = str(r["Hotel Name"]);
      if (!name) continue;
      add({
        name,
        city: "Bengaluru",
        area: str(r.Location),
        state: "Karnataka",
        lat: null,
        lng: null,
        pricePerNight: int(r.Price),
        taxPerNight: int(r.Tax),
        rating: num(r.Rating),
        starRating: int(r["Star Rating"]),
        reviews: int(r.Reviews),
        brand: null,
        propertyType: "Hotel",
        roomType: null,
        nearestLandmark: str(r["Nearest Landmark"]),
        source: "bangalore",
      });
    }
  }
  // 3d) curated Bengaluru night-stay sheet — price + area + address
  {
    const rows = readSheet("Bengaluru_Hotels_Night_Stay.xlsx", "Bengaluru Hotels - Night Stay", 2);
    for (const r of rows) {
      const name = str(r["Hotel / Lodge"]);
      if (!name) continue;
      add({
        name,
        city: "Bengaluru",
        area: str(r.Area),
        state: "Karnataka",
        lat: null,
        lng: null,
        pricePerNight: int(r["Rate per Night (₹)"]),
        taxPerNight: null,
        rating: null,
        starRating: null,
        reviews: null,
        brand: null,
        propertyType: str(r.Category),
        roomType: null,
        nearestLandmark: str(r.Address),
        source: "curated",
      });
    }
  }

  const out = [];
  for (const h of byKey.values()) {
    h.slug = uniqSlug(slugify(h.name) + (h.city ? "-" + slugify(h.city) : ""), seen);
    out.push(h);
  }
  write("hotels.json", out);
}

// ---- 4) Bengaluru BMTC bus fares (ordinary + Vajra AC) ----------------------
{
  const ord = readSheet("Karnataka_Combined_Fare_Matrix.xlsx", "BMTC Corrected Fare");
  const vaj = readSheet("Karnataka_Combined_Fare_Matrix.xlsx", "BMTC Vajra Fare");
  const acBy = new Map();
  for (const r of vaj) acBy.set(`${str(r.Origin)}|${str(r.Destination)}`, int(r["Vajra AC Fare"]));
  const out = [];
  for (const r of ord) {
    const origin = str(r.Origin), destination = str(r.Destination);
    if (!origin || !destination) continue;
    out.push({
      origin,
      destination,
      distanceKm: num(r.Distance),
      fare: int(r.Fare),
      acFare: acBy.get(`${origin}|${destination}`) ?? null,
    });
  }
  write("bus-fares.json", out);
}

// ---- 5) Karnataka railway fares --------------------------------------------
{
  const rows = readSheet("Karnataka_Combined_Fare_Matrix.xlsx", "Karnataka Railway Fares");
  const out = [];
  for (const r of rows) {
    const source = str(r["Source Station"]), destination = str(r["Destination Station"]);
    if (!source || !destination) continue;
    out.push({
      source,
      destination,
      distanceKm: num(r["Estimated Track Distance (km)"]),
      passenger: int(r["Passenger/Unreserved Fare (₹)"]),
      sleeper: int(r["Sleeper Class (SL) Fare (₹)"]),
      ac3: int(r["AC 3-Tier (3A) Fare (₹)"]),
      ac2: int(r["AC 2-Tier (2A) Fare (₹)"]),
    });
  }
  write("train-fares.json", out);
}

// ---- 6) Karnataka flight fares ---------------------------------------------
{
  const rows = readSheet("Karnataka_Combined_Fare_Matrix.xlsx", "Karnataka Flight Fares");
  const out = [];
  for (const r of rows) {
    const origin = str(r["Origin Airport"]), destination = str(r["Destination Airport"]);
    if (!origin || !destination) continue;
    out.push({
      origin,
      destination,
      distanceKm: num(r["Aerial Distance (km)"]),
      durationHrs: num(r["Estimated Flight Duration"]),
      routeType: str(r["Route Type"]),
      minFare: int(r["Min/Advance Fare (₹)"]),
      maxFare: int(r["Max/Last-Minute Fare (₹)"]),
    });
  }
  write("flight-fares.json", out);
}

// ---- 7) Karnataka district fuel rates --------------------------------------
{
  const wb = XLSX.read(fs.readFileSync(path.join(DATA, "Karnataka_Fuel_Price_Calculator (1).xlsx")), { type: "buffer" });
  const grid = XLSX.utils.sheet_to_json(wb.Sheets["Karnataka Fuel Rates"], { header: 1, raw: false, blankrows: false });
  const hdr = grid.findIndex((row) => (row[0] || "").toString().trim().toLowerCase() === "district");
  const out = [];
  if (hdr >= 0) {
    for (let i = hdr + 1; i < grid.length; i++) {
      const district = str(grid[i][0]);
      if (!district || /^Note:/i.test(district)) continue;
      out.push({ district, petrol: num(grid[i][1]), diesel: num(grid[i][2]) });
    }
  }
  write("fuel-rates.json", out);
}

console.log("Done.");
