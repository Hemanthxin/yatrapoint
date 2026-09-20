import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { readFileSync, existsSync } from "node:fs";

// Builds the unified `places` table from destinations + nearby_destinations +
// city_places, collapsing the duplicate clusters approved in merge-plan.json.
//
// The three source tables are LEFT UNTOUCHED. This only creates and fills
// `places`, so the whole step is reversible by dropping that one table.
//
//   npx tsx scripts/merge/apply-place-merge.ts            # dry run, no writes
//   npx tsx scripts/merge/apply-place-merge.ts --write    # actually write
//
// Re-running with --write rebuilds `places` from scratch, so it is safe to run
// again after editing the plan.

const WRITE = process.argv.includes("--write");
// Repoint galleries only, without rebuilding the table — used to resume after a
// dropped connection.
const GALLERIES_ONLY = process.argv.includes("--galleries-only");
const PLAN_PATH = "scripts/merge/merge-plan.json";

interface PlanRef {
  src: "destination" | "nearby" | "city";
  id: string;
  slug: string;
  name: string;
}
interface PlanCluster {
  survivor: PlanRef & { gallery: number; hasImage: boolean };
  absorbed: (PlanRef & { gallery: number; hasImage: boolean })[];
  approved: boolean;
  confidence: "high" | "review";
}

const KIND_OF = { destination: "destination", nearby: "day-trip", city: "city" } as const;

// Slug for a place that has none of its own (shouldn't happen, but a null slug
// would break every route).
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150) || "place";
}

async function run() {
  const { db } = await import("../../src/lib/db");
  const { sql } = await import("drizzle-orm");
  const { destinations, nearbyDestinations, cityPlaces, placeImages } = await import(
    "../../src/lib/db/schema"
  );

  if (!existsSync(PLAN_PATH)) {
    throw new Error(`${PLAN_PATH} not found — run scripts/merge/plan-place-merge.ts first.`);
  }
  const plan = JSON.parse(readFileSync(PLAN_PATH, "utf8")) as PlanCluster[];
  const approved = plan.filter((c) => c.approved);

  // Read in pages. Pulling all ~10k rows in one response — every one carrying a
  // full description — overruns the serverless driver's HTTP response and drops
  // the socket (UND_ERR_SOCKET) partway through.
  const PAGE = 500;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  async function fetchAll(table: any): Promise<any[]> {
    const out: any[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await db.select().from(table).limit(PAGE).offset(offset);
      out.push(...page);
      if (page.length < PAGE) break;
    }
    return out;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const dest = await fetchAll(destinations);
  const near = await fetchAll(nearbyDestinations);
  const city = await fetchAll(cityPlaces);
  const imgs = await fetchAll(placeImages);
  console.log(`read ${dest.length} destinations, ${near.length} day trips, ${city.length} city places, ${imgs.length} gallery images`);

  // key -> cluster survivor key, for every absorbed row.
  const absorbedInto = new Map<string, string>();
  for (const c of approved) {
    const survivorKey = `${c.survivor.src}:${c.survivor.id}`;
    for (const a of c.absorbed) absorbedInto.set(`${a.src}:${a.id}`, survivorKey);
  }

  type Facets = {
    destination?: Record<string, any>;
    nearby?: Record<string, any>;
    city?: Record<string, any>;
  };
  // survivor key -> the source rows that make up that place
  const merged = new Map<string, Facets>();
  const legacySlugs = new Map<string, string[]>();

  const place = (key: string) => {
    if (!merged.has(key)) merged.set(key, {});
    return merged.get(key)!;
  };

  const assign = (src: "destination" | "nearby" | "city", row: { id: string; slug: string }) => {
    const own = `${src}:${row.id}`;
    const target = absorbedInto.get(own) ?? own;
    const f = place(target);
    // Two rows of the SAME source can land in one cluster (e.g. two
    // destination rows for one place). Keep the first; the second only
    // contributes its slug, so its old URL still resolves.
    if (!f[src]) (f[src] as unknown) = row;
    if (target !== own) {
      if (!legacySlugs.has(target)) legacySlugs.set(target, []);
      legacySlugs.get(target)!.push(row.slug);
    }
  };

  for (const r of dest) assign("destination", r);
  for (const r of near) assign("nearby", r);
  for (const r of city) assign("city", r);

  // Build one `places` row per surviving place.
  const takenSlugs = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  // old "src:id" -> new places.id, for repointing galleries and foreign keys.
  const idMap = new Map<string, string>();

  for (const [key, f] of merged) {
    const d = f.destination;
    const n = f.nearby;
    const c = f.city;
    const primary = d ?? n ?? c;
    if (!primary) continue;

    const kinds = [
      d ? KIND_OF.destination : null,
      n ? KIND_OF.nearby : null,
      c ? KIND_OF.city : null,
    ].filter(Boolean) as string[];

    // Canonical slug: the surviving row's own. Collisions across the three
    // tables are possible (different places, same slug), so a taken slug gets
    // a suffix and the original is preserved as a legacy slug.
    let slug = primary.slug || slugify(primary.name);
    const extraLegacy = [...(legacySlugs.get(key) ?? [])];
    for (const other of [d?.slug, n?.slug, c?.slug]) {
      if (other && other !== slug) extraLegacy.push(other);
    }
    if (takenSlugs.has(slug)) {
      extraLegacy.push(slug);
      let i = 2;
      while (takenSlugs.has(`${slug}-${i}`)) i++;
      slug = `${slug}-${i}`;
    }
    takenSlugs.add(slug);

    const id = primary.id;
    for (const src of ["destination", "nearby", "city"] as const) {
      const row = f[src];
      if (row) idMap.set(`${src}:${row.id}`, id);
    }
    // Absorbed rows point at the survivor too.
    for (const [from, to] of absorbedInto) if (to === key) idMap.set(from, id);

    // Field-level winner: the richest source that actually has a value.
    const pick = <T>(...vals: (T | null | undefined)[]): T | null => {
      for (const v of vals) if (v !== null && v !== undefined && v !== "") return v;
      return null;
    };

    rows.push({
      id,
      slug,
      legacy_slugs: extraLegacy.length ? JSON.stringify([...new Set(extraLegacy)]) : null,
      name: primary.name,
      kinds: kinds.join(","),
      category: d?.category ?? n?.category ?? c?.category ?? "Other",
      description: pick(d?.description, n?.description, c?.description) ?? "",
      short_description: pick(d?.shortDescription, n?.shortDescription, c?.shortDescription) ?? "",
      // The photo that actually exists wins, whichever copy held it.
      image_url: pick(d?.imageUrl, n?.imageUrl, c?.imageUrl),
      latitude: pick(d?.latitude, n?.latitude, c?.latitude),
      longitude: pick(d?.longitude, n?.longitude, c?.longitude),
      popularity: Math.max(d?.popularity ?? 0, n?.popularity ?? 0, c?.popularity ?? 0) || 50,
      booking_url: pick(d?.bookingUrl, n?.bookingUrl, c?.bookingUrl),
      entry_fee_per_person: d?.entryFees ?? n?.entryFeePerPerson ?? c?.entryFeePerPerson ?? 0,
      is_hidden: d?.isHidden ?? false,

      state: d?.state ?? null,
      district: d?.district ?? null,
      place_type: d?.placeType ?? null,
      opening_timings: d?.openingTimings ?? null,
      entry_fees_foreigner: d?.entryFeesForeigner ?? null,
      entry_fees_child: d?.entryFeesChild ?? null,
      ticket_options: d?.ticketOptions ?? null,
      visitor_guidelines: d?.visitorGuidelines ?? null,
      budget_per_day: d?.budgetPerDay ?? null,
      recommended_days: d?.recommendedDays ?? null,
      best_months: d?.bestMonths ?? null,
      added_by_email: d?.addedByEmail ?? null,
      added_by_name: d?.addedByName ?? null,

      base_city: n?.baseCity ?? null,
      distance_km: n?.distanceKm ?? null,
      driving_minutes: n?.drivingMinutes ?? null,
      ideal_hours_at_place: n?.idealHoursAtPlace ?? null,
      best_start_time: n?.bestStartTime ?? null,
      highlights: n?.highlights ?? null,

      city: c?.city ?? null,
      city_kind: c?.kind ?? null,
      area: c?.area ?? null,
      avg_cost_for_two: c?.avgCostForTwo ?? null,
      ideal_minutes_at_place: c?.idealMinutesAtPlace ?? null,
      open_time: c?.openTime ?? null,
      close_time: c?.closeTime ?? null,
      open_days: c?.openDays ?? null,
      tags: c?.tags ?? null,

      google_place_id: pick(d?.googlePlaceId, n?.googlePlaceId, c?.googlePlaceId),
      google_rating: pick(d?.googleRating, n?.googleRating, c?.googleRating),
      google_rating_count: pick(d?.googleRatingCount, n?.googleRatingCount, c?.googleRatingCount),
      google_weekly_hours: pick(d?.googleWeeklyHours, n?.googleWeeklyHours, c?.googleWeeklyHours),
      google_business_status: pick(
        d?.googleBusinessStatus, n?.googleBusinessStatus, c?.googleBusinessStatus
      ),
      google_synced_at: pick(d?.googleSyncedAt, n?.googleSyncedAt, c?.googleSyncedAt),
      created_at: d?.createdAt ?? n?.createdAt ?? c?.createdAt ?? new Date(),
    });
  }

  // Galleries follow their place. This is the fix for the reported symptom: a
  // gallery stranded on the day-trip copy now belongs to the one merged row.
  const SRC_OF_TYPE = { destination: "destination", nearby: "nearby", city: "city" } as const;
  const galleryMoves: { imageId: string; toPlaceId: string }[] = [];
  // Current place_type per image, so an already-repointed image is skipped.
  const byImageId = new Map<string, string>(imgs.map((i: any) => [i.id, i.placeType]));
  let galleryOrphans = 0;
  for (const img of imgs) {
    if (img.placeType === "place") { galleryMoves.push({ imageId: img.id, toPlaceId: img.placeId }); continue; }
    const src = SRC_OF_TYPE[img.placeType as keyof typeof SRC_OF_TYPE];
    if (!src) { galleryOrphans++; continue; }
    const to = idMap.get(`${src}:${img.placeId}`);
    if (!to) { galleryOrphans++; continue; }
    galleryMoves.push({ imageId: img.id, toPlaceId: to });
  }

  const kindCounts = rows.reduce<Record<string, number>>((a, r) => {
    a[r.kinds as string] = (a[r.kinds as string] ?? 0) + 1;
    return a;
  }, {});

  console.log(`source rows:        ${dest.length + near.length + city.length}`);
  console.log(`  destinations      ${dest.length}`);
  console.log(`  one-day trips     ${near.length}`);
  console.log(`  city places       ${city.length}`);
  console.log(`approved clusters:  ${approved.length} of ${plan.length}`);
  console.log(`places rows:        ${rows.length}`);
  console.log(`kinds breakdown:    ${JSON.stringify(kindCounts)}`);
  console.log(`gallery images:     ${imgs.length} (${galleryMoves.length} mapped, ${galleryOrphans} orphaned)`);
  console.log(`rows with >1 kind:  ${rows.filter((r) => (r.kinds as string).includes(",")).length}`);

  // Galleries follow their place, in bulk and idempotently. One UPDATE per
  // image meant ~630 sequential HTTP round-trips, which the serverless driver
  // dropped partway through; a single statement per chunk is both far faster
  // and safe to re-run, since an image already moved to place_type 'place' is
  // simply not selected again.
  async function repointGalleries() {
    const pending = galleryMoves.filter((m) => byImageId.get(m.imageId) !== "place");
    if (pending.length === 0) {
      console.log("galleries: already repointed, nothing to do.");
      return;
    }
    const CH = 100;
    for (let i = 0; i < pending.length; i += CH) {
      const slice = pending.slice(i, i + CH);
      const tuples = slice.map((m) => sql`(${m.imageId}, ${m.toPlaceId})`);
      await db.execute(
        sql`UPDATE "place_images" AS pi
            SET "place_id" = v.new_place_id, "place_type" = 'place'
            FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(image_id, new_place_id)
            WHERE pi."id" = v.image_id`
      );
      process.stdout.write(`\r  galleries ${Math.min(i + CH, pending.length)}/${pending.length}`);
    }
    console.log("");
  }

  if (GALLERIES_ONLY) {
    if (!WRITE) {
      console.log(`\nDRY RUN — would repoint ${galleryMoves.filter((m) => byImageId.get(m.imageId) !== "place").length} gallery image(s).`);
      return;
    }
    await repointGalleries();
    console.log("gallery repointing complete.");
    return;
  }

  if (!WRITE) {
    console.log("\nDRY RUN — nothing written. Re-run with --write to apply.");
    return;
  }

  console.log("\nwriting...");
  // Rebuild from scratch so the script is safe to re-run after plan edits.
  await db.execute(sql`DROP TABLE IF EXISTS "places" CASCADE`);
  await db.execute(sql`CREATE TABLE "places" (
    "id" text PRIMARY KEY,
    "slug" varchar(160) NOT NULL UNIQUE,
    "legacy_slugs" text,
    "name" varchar(220) NOT NULL,
    "kinds" varchar(60) NOT NULL,
    "category" varchar(40) NOT NULL,
    "description" text NOT NULL,
    "short_description" varchar(240) NOT NULL,
    "image_url" text,
    "latitude" varchar(20),
    "longitude" varchar(20),
    "popularity" integer DEFAULT 50 NOT NULL,
    "booking_url" text,
    "entry_fee_per_person" integer DEFAULT 0 NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "state" varchar(60),
    "district" varchar(80),
    "place_type" varchar(60),
    "opening_timings" varchar(120),
    "entry_fees_foreigner" integer,
    "entry_fees_child" integer,
    "ticket_options" text,
    "visitor_guidelines" text,
    "budget_per_day" integer,
    "recommended_days" integer,
    "best_months" text,
    "added_by_email" varchar(255),
    "added_by_name" varchar(120),
    "base_city" varchar(60),
    "distance_km" integer,
    "driving_minutes" integer,
    "ideal_hours_at_place" integer,
    "best_start_time" varchar(10),
    "highlights" text,
    "city" varchar(120),
    "city_kind" varchar(40),
    "area" varchar(200),
    "avg_cost_for_two" integer,
    "ideal_minutes_at_place" integer,
    "open_time" varchar(10),
    "close_time" varchar(10),
    "open_days" varchar(30),
    "tags" text,
    "google_place_id" text,
    "google_rating" real,
    "google_rating_count" integer,
    "google_weekly_hours" text,
    "google_business_status" varchar(24),
    "google_synced_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
  )`);

  const cols = Object.keys(rows[0]);
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = slice.map(
      (r) => sql`(${sql.join(cols.map((c) => sql`${r[c] ?? null}`), sql`, `)})`
    );
    await db.execute(
      sql`INSERT INTO "places" (${sql.join(cols.map((c) => sql.raw(`"${c}"`)), sql`, `)}) VALUES ${sql.join(values, sql`, `)}`
    );
    process.stdout.write(`\r  inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log("");

  for (const idx of [
    `CREATE INDEX IF NOT EXISTS "places_kinds_idx" ON "places" ("kinds")`,
    `CREATE INDEX IF NOT EXISTS "places_state_idx" ON "places" ("state")`,
    `CREATE INDEX IF NOT EXISTS "places_district_idx" ON "places" ("district")`,
    `CREATE INDEX IF NOT EXISTS "places_category_idx" ON "places" ("category")`,
    `CREATE INDEX IF NOT EXISTS "places_popularity_idx" ON "places" ("popularity")`,
    `CREATE INDEX IF NOT EXISTS "places_base_city_idx" ON "places" ("base_city")`,
  ]) {
    await db.execute(sql.raw(idx));
  }

  await repointGalleries();

  console.log(`wrote ${rows.length} places, repointed ${galleryMoves.length} gallery images.`);
  console.log("Source tables untouched — drop `places` to roll back.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
