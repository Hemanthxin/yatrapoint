import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import fs from "node:fs";
import path from "node:path";

// Seeds the imported Data/ datasets: creates the hotels table, loads hotels,
// KA temples → city_places, and top Indian places → destinations. Idempotent
// (insert-or-ignore by slug). Run: npm run db:seed:imports
const DIR = path.join(process.cwd(), "src/lib/db/data");
const readJson = <T>(f: string): T[] => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const CAT_BY_TYPE = (type: string | null): string => {
  const t = (type || "").toLowerCase();
  if (/beach/.test(t)) return "beach";
  if (/hill|mountain|peak|valley/.test(t)) return "hill_station";
  if (/temple|church|mosque|gurudwara|ashram|shrine|monaster|dargah|math/.test(t)) return "pilgrimage";
  if (/park|wildlife|sanctuary|zoo|bird|tiger|national/.test(t)) return "wildlife";
  if (/lake|waterfall|fall|dam|garden|trek|cave|river|adventure|hot spring/.test(t)) return "adventure";
  return "heritage"; // fort, palace, monument, museum, memorial, historical, tomb…
};

async function run() {
  const { db } = await import("../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const { hotels, cityPlaces, destinations } = await import("../src/lib/db/schema");

  // 1) hotels table (idempotent)
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "hotels" (
    "id" text PRIMARY KEY,
    "slug" varchar(160) NOT NULL UNIQUE,
    "name" varchar(220) NOT NULL,
    "city" varchar(120),
    "area" varchar(200),
    "state" varchar(80),
    "latitude" varchar(20),
    "longitude" varchar(20),
    "price_per_night" integer,
    "tax_per_night" integer,
    "rating" real,
    "star_rating" integer,
    "reviews" integer,
    "brand" varchar(120),
    "property_type" varchar(120),
    "room_type" varchar(200),
    "nearest_landmark" text,
    "source" varchar(40),
    "created_at" timestamp DEFAULT now() NOT NULL
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "hotels_city_idx" ON "hotels" (lower("city"))`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "hotels_price_idx" ON "hotels" ("price_per_night")`);

  // 2) hotels rows
  type H = {
    slug: string; name: string; city: string | null; area: string | null; state: string | null;
    lat: string | null; lng: string | null; pricePerNight: number | null; taxPerNight: number | null;
    rating: number | null; starRating: number | null; reviews: number | null; brand: string | null;
    propertyType: string | null; roomType: string | null; nearestLandmark: string | null; source: string | null;
  };
  const hRows = readJson<H>("hotels.json").map((h) => ({
    slug: h.slug,
    name: h.name.slice(0, 220),
    city: h.city?.slice(0, 120) ?? null,
    area: h.area?.slice(0, 200) ?? null,
    state: h.state?.slice(0, 80) ?? null,
    latitude: h.lat,
    longitude: h.lng,
    pricePerNight: h.pricePerNight,
    taxPerNight: h.taxPerNight,
    rating: h.rating,
    starRating: h.starRating,
    reviews: h.reviews,
    brand: h.brand?.slice(0, 120) ?? null,
    propertyType: h.propertyType?.slice(0, 120) ?? null,
    roomType: h.roomType?.slice(0, 200) ?? null,
    nearestLandmark: h.nearestLandmark ?? null,
    source: h.source?.slice(0, 40) ?? null,
  }));
  let hInserted = 0;
  for (const batch of chunk(hRows, 500)) {
    await db.insert(hotels).values(batch).onConflictDoNothing({ target: hotels.slug });
    hInserted += batch.length;
    process.stdout.write(".");
  }
  console.log(`\nHotels processed: ${hInserted}`);

  // 3) KA temples → city_places (kind=temple)
  type T = { slug: string; name: string; area: string | null; city: string; district: string | null; lat: string; lng: string };
  const tRows = readJson<T>("temples.json").map((t) => ({
    slug: t.slug,
    name: t.name.slice(0, 200),
    city: (t.city || "Karnataka").slice(0, 80),
    kind: "temple",
    category: "spiritual",
    area: (t.area || t.district || t.city)?.slice(0, 120) ?? null,
    description: `${t.name} is a temple located in ${t.city}${t.district ? `, ${t.district} district` : ""}, Karnataka.`,
    shortDescription: `Temple in ${(t.area || t.city).slice(0, 200)}.`.slice(0, 240),
    entryFeePerPerson: 0,
    idealMinutesAtPlace: 30,
    latitude: t.lat,
    longitude: t.lng,
    popularity: 55,
  }));
  let tInserted = 0;
  for (const batch of chunk(tRows, 500)) {
    await db.insert(cityPlaces).values(batch).onConflictDoNothing({ target: cityPlaces.slug });
    tInserted += batch.length;
    process.stdout.write(".");
  }
  console.log(`\nTemples → city_places processed: ${tInserted}`);

  // 4) Top Indian places → destinations
  type P = {
    slug: string; name: string; state: string; city: string | null; type: string | null;
    rating: number | null; entryFee: number; significance: string | null; bestTime: string | null; timeHrs: number | null;
  };
  const pRows = readJson<P>("top-places.json").map((p) => {
    const cat = CAT_BY_TYPE(p.type);
    const where = [p.city, p.state].filter(Boolean).join(", ");
    return {
      slug: p.slug,
      name: p.name.slice(0, 120),
      state: p.state.slice(0, 60),
      district: p.city?.slice(0, 80) ?? null,
      category: cat,
      placeType: p.type?.slice(0, 60) ?? null,
      description:
        `${p.name} is a ${p.type || "notable"} attraction in ${where}.` +
        (p.significance ? ` Significance: ${p.significance}.` : "") +
        (p.bestTime ? ` Best time to visit: ${p.bestTime}.` : ""),
      shortDescription: `${p.type || "Attraction"} in ${where}.`.slice(0, 220),
      entryFees: p.entryFee || 0,
      budgetPerDay: 1500,
      recommendedDays: 1,
      bestMonths: null,
      isHidden: false,
      popularity: p.rating ? Math.max(30, Math.min(100, Math.round(p.rating * 20))) : 55,
      latitude: null,
      longitude: null,
    };
  });
  let pInserted = 0;
  for (const batch of chunk(pRows, 500)) {
    await db.insert(destinations).values(batch).onConflictDoNothing({ target: destinations.slug });
    pInserted += batch.length;
    process.stdout.write(".");
  }
  console.log(`\nTop places → destinations processed: ${pInserted}`);

  const [[h], [c], [d]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(hotels),
    db.select({ n: sql<number>`count(*)::int` }).from(cityPlaces),
    db.select({ n: sql<number>`count(*)::int` }).from(destinations),
  ]);
  console.log(`\nDone. hotels=${h.n}, city_places=${c.n}, destinations=${d.n}.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
