import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Corrects `places.district` values that are not districts.
//
//   npx tsx scripts/merge/fix-districts.ts           # dry run, writes nothing
//   npx tsx scripts/merge/fix-districts.ts --write   # apply
//
// The catalogue stores a district per place, but many rows hold a TOWN instead
// ("Mulbagal" is a taluk of Kolar; "Bodh Gaya" is a town in Gaya), a retired
// name ("Ahmednagar" is now Ahilyanagar), or a spelling the district reference
// does not use ("Kutch" / "Kachchh"). Those places cannot be found by district,
// which is what the district filter and area planning are built on.
//
// Every mapping below is a plain geographic fact. Cases where the right answer
// is genuinely ambiguous are deliberately NOT mapped and are reported instead —
// "Mumbai" could be Mumbai City or Mumbai Suburban, and picking one at random
// would be inventing data rather than correcting it.

const WRITE = process.argv.includes("--write");

// state -> { wrong district value: correct district }
const FIX: Record<string, Record<string, string>> = {
  "Andhra Pradesh": {
    Anantapur: "Ananthapuramu", // renamed
    Kadapa: "YSR Kadapa", // renamed
    Vijayawada: "NTR", // city, in NTR district
    Srisailam: "Nandyal", // town
    Amravati: "Guntur", // Amaravati, the capital, sits in Guntur
    Puttaparthi: "Sri Sathya Sai", // town that gives the district its name
  },
  Assam: {
    Hajo: "Kamrup", // town
    Kaziranga: "Golaghat", // the park spans Golaghat and Nagaon
  },
  Bihar: {
    Kaimur: "Kaimur (Bhabua)", // same district, fuller name
    "West Champaran": "Pashchim Champaran", // same district, Hindi name
    "East Champaran": "Purba Champaran", // same district, Hindi name
    "Bodh Gaya": "Gaya", // town
  },
  Chhattisgarh: {
    Dantewada: "Dakshin Bastar Dantewada", // same district, fuller name
    Gariaband: "Gariyaband", // spelling
    Kabirdham: "Kabeerdham", // spelling
    "Baloda Bazar": "Baloda Bazar-Bhatapara", // same district, fuller name
  },
  Gujarat: {
    Kutch: "Kachchh", // spelling
    "Rann of Kutch": "Kachchh", // the salt marsh, in Kachchh
    Bhuj: "Kachchh", // district headquarters town
    Mehsana: "Mahesana", // spelling
  },
  "Himachal Pradesh": {
    "Lahaul-Spiti": "Lahaul and Spiti", // spelling
    "Spiti Valley": "Lahaul and Spiti", // valley within it
    Palampur: "Kangra", // town
    "Bir Billing": "Kangra", // paragliding site in Kangra
    Dalhousie: "Chamba", // hill town
    dalhousie: "Chamba", // same, lower-cased in the data
    Narkanda: "Shimla", // town
    Kufri: "Shimla", // hill station
    Shoja: "Kullu", // village
    Manali: "Kullu", // town
    Barot: "Mandi", // valley village
  },
  Karnataka: {
    Bengaluru: "Bengaluru Urban", // the city proper
    Mulbagal: "Kolar", // taluk of Kolar, NOT a district
    Murudeshwar: "Uttara Kannada", // temple town
  },
  Kerala: {
    Kochi: "Ernakulam", // city, in Ernakulam district
    Kumarakom: "Kottayam", // village
    Munnar: "Idukki", // hill town
    Thekkady: "Idukki", // Periyar reserve
    Nelliyampathy: "Palakkad", // hill station
  },
  Ladakh: {
    Dras: "Drass", // spelling
    "Nubra Valley": "Nubra", // now its own district
    Hemis: "Leh", // monastery, in Leh
  },
  "Madhya Pradesh": {
    Orchha: "Niwari", // town
    Chitrakoot: "Satna", // the MP side sits in Satna
    Pachmarhi: "Narmadapuram", // hill station
    Amarkantak: "Anuppur", // pilgrimage town
    Mandu: "Dhar", // fort town
  },
  Maharashtra: {
    Ahmednagar: "Ahilyanagar", // renamed
    Shirdi: "Ahilyanagar", // town in the same district
    Matheran: "Raigad", // hill station
    Lonavala: "Pune", // hill town
  },
  Meghalaya: {
    Cherrapunji: "East Khasi Hills", // town (Sohra)
  },
  Odisha: {
    Keonjhar: "Kendujhar", // spelling
    Berhampur: "Ganjam", // city
    Bhubaneswar: "Khordha", // capital, in Khordha
    Rourkela: "Sundargarh", // city
  },
  Sikkim: {
    Ravangla: "Namchi", // town
  },
  "Tamil Nadu": {
    Kanchipuram: "Kancheepuram", // spelling
    Kanyakumari: "Kanniyakumari", // spelling
    Nilgiris: "The Nilgiris", // same district
    Ooty: "The Nilgiris", // Udhagamandalam, the HQ town
    Kodaikanal: "Dindigul", // hill town
    Tiruttani: "Tiruvallur", // temple town
    Yercaud: "Salem", // hill station
    Mahabalipuram: "Chengalpattu", // Mamallapuram
    Chidambaram: "Cuddalore", // temple town
  },
  "Uttar Pradesh": {
    "Lakhimpur Kheri": "Kheri", // same district
    Noida: "Gautam Buddha Nagar", // city
    "Greater Noida": "Gautam Buddha Nagar", // city
    Kanpur: "Kanpur Nagar", // the city district
    "Fatehpur Sikri": "Agra", // town
    Sarnath: "Varanasi", // site just outside the city
  },
  Uttarakhand: {
    Auli: "Chamoli", // ski resort
    Ranikhet: "Almora", // hill town
  },
  "West Bengal": {
    Bolpur: "Birbhum", // town (Santiniketan)
  },
};

// Wrong STATE, not just wrong district — Porbandar is in Gujarat.
const STATE_FIX: { state: string; district: string; toState: string; toDistrict: string }[] = [
  { state: "Uttar Pradesh", district: "Porbandar", toState: "Gujarat", toDistrict: "Porbandar" },
];

async function run() {
  const { db } = await import("../../src/lib/db");
  const { places } = await import("../../src/lib/db/schema");
  const { and, eq, sql } = await import("drizzle-orm");
  const { INDIA_DISTRICTS } = await import("../../src/lib/india-districts");
  const { districtMatches } = await import("../../src/lib/district-match");

  // Sanity: never map onto a district that is not in the reference.
  let invalid = 0;
  for (const [state, map] of Object.entries(FIX)) {
    const list = INDIA_DISTRICTS[state] ?? [];
    for (const [from, to] of Object.entries(map)) {
      if (!list.some((d) => districtMatches(d, to))) {
        console.log(`INVALID TARGET  ${state}: "${from}" -> "${to}" is not a district of ${state}`);
        invalid++;
      }
    }
  }
  if (invalid > 0) throw new Error(`${invalid} mapping(s) point at a non-existent district`);

  let planned = 0;
  for (const [state, map] of Object.entries(FIX)) {
    for (const [from, to] of Object.entries(map)) {
      const rows = await db
        .select({ id: places.id, name: places.name })
        .from(places)
        .where(and(eq(places.state, state), eq(places.district, from)));
      if (rows.length === 0) continue;
      planned += rows.length;
      console.log(`${state}: "${from}" -> "${to}"  (${rows.length}) ${rows.map((r) => r.name).join("; ").slice(0, 90)}`);
      if (WRITE) {
        await db
          .update(places)
          .set({ district: to })
          .where(and(eq(places.state, state), eq(places.district, from)));
      }
    }
  }

  for (const f of STATE_FIX) {
    const rows = await db
      .select({ id: places.id, name: places.name })
      .from(places)
      .where(and(eq(places.state, f.state), eq(places.district, f.district)));
    if (rows.length === 0) continue;
    planned += rows.length;
    console.log(`${f.state}/"${f.district}" -> ${f.toState}/"${f.toDistrict}"  (${rows.length}) ${rows.map((r) => r.name).join("; ")}`);
    if (WRITE) {
      await db
        .update(places)
        .set({ state: f.toState, district: f.toDistrict })
        .where(and(eq(places.state, f.state), eq(places.district, f.district)));
    }
  }

  // What is still unresolved afterwards?
  const rows = await db
    .select({ state: places.state, district: places.district, n: sql<number>`count(*)::int` })
    .from(places)
    .where(sql`${places.state} is not null and ${places.district} is not null`)
    .groupBy(places.state, places.district);
  const left = rows.filter((r) => {
    const list = INDIA_DISTRICTS[r.state!] ?? [];
    if (list.length === 0) return false;
    // On a dry run the rows still hold their old values, so discount anything
    // this script would have changed — otherwise the "still unresolved" figure
    // reports the problem as untouched.
    if (!WRITE) {
      if (FIX[r.state!]?.[r.district!]) return false;
      if (STATE_FIX.some((f) => f.state === r.state && f.district === r.district)) return false;
    }
    return !list.some((d) => districtMatches(d, r.district!));
  });

  console.log(`\n${WRITE ? "APPLIED" : "WOULD FIX"}: ${planned} places`);
  console.log(`still unresolved ${WRITE ? "now" : "after this"}: ${left.reduce((a, r) => a + r.n, 0)} places across ${left.length} values`);
  for (const r of left.sort((a, b) => b.n - a.n)) console.log(`  ${r.state} / "${r.district}" — ${r.n}`);
  if (!WRITE) console.log("\nDRY RUN — nothing written. Re-run with --write to apply.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
