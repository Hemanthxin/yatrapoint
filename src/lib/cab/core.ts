// Shared server logic for the cab marketplace. Used by the driver-app API
// routes (/api/driver/*), the user-facing routes (/api/cars/*) and the admin
// screen, so there is one definition of what a booking is and how it moves.
import { createHash, randomBytes, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { createId } from "@/lib/utils/id";
import { ensureCabTables } from "@/lib/db/ensure-cabs";
import { sendPush } from "./push";

export const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "tempo", "luxury"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export type BookingStatus = "requested" | "accepted" | "declined" | "cancelled" | "arrived" | "started" | "completed" | "expired";

// A request nobody answers is released after this long.
export const REQUEST_TTL_MIN = 30;
// A driver can't mark arrival / start a trip more than this long before the pickup time.
const EARLY_MIN = 90;
// Two accepted bookings whose pickups are closer than this overlap.
const OVERLAP_HOURS = 3;
// A single booking longer than this (straight-line km) is almost certainly a mistyped place.
const MAX_TRIP_KM = 1200;
const SESSION_DAYS = 60;

// ── row helpers ───────────────────────────────────────────────────────────────
const snakeToCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** NOTE: never pass a JS Date straight into a query — the driver serialises it in the server's local zone and
 *  the zone-less timestamp column keeps that wall clock (a 5½-hour shift on an India-time machine). Send
 *  `${d.toISOString()}::timestamptz AT TIME ZONE 'UTC'` instead. */
/** Postgres hands back timestamp columns as zone-less strings ("2026-10-13 12:00:00").
 *  They are stored as UTC, so tag them as such — clients then parse them correctly. */
function asIso(k: string, v: unknown): unknown {
  if (typeof v === "string" && /At$/.test(k) && /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(v)) {
    const s = v.replace(" ", "T");
    return /(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s + "Z";
  }
  return v;
}

/** neon-http returns `{ rows }`; other drivers return the array. Keys become camelCase. */
export function rowsOf<T = Record<string, unknown>>(res: unknown): T[] {
  const list = ((res as { rows?: unknown[] })?.rows ?? res) as Array<Record<string, unknown>>;
  return list.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => {
        const key = snakeToCamel(k);
        return [key, asIso(key, v)];
      }),
    ),
  ) as T[];
}

async function q<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T[]> {
  await ensureCabTables();
  return rowsOf<T>(await db.execute(query));
}

// ── types ─────────────────────────────────────────────────────────────────────
export interface Driver {
  id: string;
  phone: string;
  name: string;
  licenceNo: string | null;
}

export interface Vehicle {
  id: string;
  driverId: string;
  type: VehicleType;
  makeModel: string;
  colour: string | null;
  plate: string;
  year: number | null;
  seats: number;
  ac: boolean;
  city: string;
  ratePerKm: number;
  baseFare: number;
  rcNo: string | null;
  photoUrl: string | null;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  available: boolean;
}

export interface Booking {
  id: string;
  vehicleId: string;
  driverId: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  pickupText: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropText: string;
  dropLat: number | null;
  dropLng: number | null;
  pickupAt: string;
  passengers: number;
  distanceKm: number | null;
  fare: number;
  note: string | null;
  otp: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rating: number | null;
  review: string | null;
}

export interface DriverNotification {
  id: string;
  bookingId: string | null;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

// ── driver sessions ───────────────────────────────────────────────────────────
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function findOrCreateDriver(phone: string, name?: string): Promise<{ driver: Driver; isNew: boolean } | null> {
  const [found] = await q<Driver>(sql`SELECT id, phone, name, licence_no FROM cab_drivers WHERE phone = ${phone}`);
  if (found) return { driver: found, isNew: false };
  if (!name?.trim()) return null; // a first-time driver has to give a name
  const id = createId();
  await q(sql`INSERT INTO cab_drivers (id, phone, name) VALUES (${id}, ${phone}, ${name.trim().slice(0, 120)})`);
  return { driver: { id, phone, name: name.trim().slice(0, 120), licenceNo: null }, isNew: true };
}

// ── password sign-in ──────────────────────────────────────────────────────────
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 10;
// A hash to compare against when the number isn't registered, so a wrong number
// takes as long to reject as a wrong password (no account enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function signUpDriver(phone: string, name: string, password: string): Promise<{ ok: true; driver: Driver } | { ok: false; error: string }> {
  const [exists] = await q<{ id: string }>(sql`SELECT id FROM cab_drivers WHERE phone = ${phone}`);
  if (exists) return { ok: false, error: "An account with this mobile number already exists. Please sign in." };
  const id = createId();
  const cleanName = name.trim().slice(0, 120);
  const passwordHash = await bcrypt.hash(password, 10);
  await q(sql`INSERT INTO cab_drivers (id, phone, name, password_hash) VALUES (${id}, ${phone}, ${cleanName}, ${passwordHash})`);
  return { ok: true, driver: { id, phone, name: cleanName, licenceNo: null } };
}

export async function signInDriver(phone: string, password: string): Promise<{ ok: true; driver: Driver } | { ok: false; error: string }> {
  const wrong = { ok: false as const, error: "Wrong mobile number or password." };
  const [row] = await q<Driver & { passwordHash: string | null; failedLogins: number; locked: boolean }>(sql`
    SELECT id, phone, name, licence_no, password_hash, failed_logins,
           (locked_until IS NOT NULL AND locked_until > (now() AT TIME ZONE 'UTC')) AS locked
    FROM cab_drivers WHERE phone = ${phone}`);

  if (!row) {
    await bcrypt.compare(password, DUMMY_HASH);
    return wrong;
  }
  if (row.locked) return { ok: false, error: `Too many wrong attempts. Try again in ${LOCK_MINUTES} minutes, or ask Saafera support to reset your password.` };
  if (!row.passwordHash) return { ok: false, error: "This account has no password yet. Please contact Saafera support to set one." };

  if (!(await bcrypt.compare(password, row.passwordHash))) {
    await q(sql`UPDATE cab_drivers SET failed_logins = failed_logins + 1,
      locked_until = CASE WHEN failed_logins + 1 >= ${MAX_FAILED_LOGINS} THEN ((now() + make_interval(mins => ${LOCK_MINUTES})) AT TIME ZONE 'UTC') ELSE locked_until END
      WHERE id = ${row.id}`);
    return wrong;
  }
  if (row.failedLogins > 0) await q(sql`UPDATE cab_drivers SET failed_logins = 0, locked_until = NULL WHERE id = ${row.id}`);
  return { ok: true, driver: { id: row.id, phone: row.phone, name: row.name, licenceNo: row.licenceNo } };
}

/** A readable one-time password for an admin reset: no look-alike characters (0/O, 1/l/I). */
function temporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[randomInt(0, chars.length)];
  return out;
}

/** Admin reset: sets a new temporary password, clears any lockout and signs the driver out everywhere. */
export async function resetDriverPassword(driverId: string): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const [d] = await q<{ id: string }>(sql`SELECT id FROM cab_drivers WHERE id = ${driverId}`);
  if (!d) return { ok: false, error: "Driver not found." };
  const password = temporaryPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  await q(sql`UPDATE cab_drivers SET password_hash = ${passwordHash}, failed_logins = 0, locked_until = NULL WHERE id = ${driverId}`);
  await q(sql`DELETE FROM cab_driver_sessions WHERE driver_id = ${driverId}`);
  return { ok: true, password };
}

/** The driver changes their own password. Other devices stay signed in only if `keepToken` is given. */
export async function changeDriverPassword(driverId: string, current: string, next: string, keepToken: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await q<{ passwordHash: string | null }>(sql`SELECT password_hash FROM cab_drivers WHERE id = ${driverId}`);
  if (!row?.passwordHash || !(await bcrypt.compare(current, row.passwordHash))) return { ok: false, error: "Your current password is not right." };
  const passwordHash = await bcrypt.hash(next, 10);
  await q(sql`UPDATE cab_drivers SET password_hash = ${passwordHash}, failed_logins = 0, locked_until = NULL WHERE id = ${driverId}`);
  // sign out every other device
  await q(sql`DELETE FROM cab_driver_sessions WHERE driver_id = ${driverId} AND token_hash <> ${keepToken ? hash(keepToken) : ""}`);
  return { ok: true };
}

export async function issueDriverToken(driverId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await q(sql`INSERT INTO cab_driver_sessions (token_hash, driver_id, expires_at) VALUES (${hash(token)}, ${driverId}, (${expires.toISOString()}::timestamptz AT TIME ZONE 'UTC'))`);
  return token;
}

export async function revokeDriverToken(token: string): Promise<void> {
  await q(sql`DELETE FROM cab_driver_sessions WHERE token_hash = ${hash(token)}`);
}

export function bearerOf(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() || null : null;
}

export async function driverFromRequest(req: Request): Promise<Driver | null> {
  const token = bearerOf(req);
  if (!token) return null;
  const [d] = await q<Driver>(sql`
    SELECT d.id, d.phone, d.name, d.licence_no
    FROM cab_driver_sessions s JOIN cab_drivers d ON d.id = s.driver_id
    WHERE s.token_hash = ${hash(token)} AND s.expires_at > now()`);
  return d ?? null;
}

// ── vehicles ──────────────────────────────────────────────────────────────────
export interface VehicleInput {
  type: VehicleType;
  makeModel: string;
  colour?: string | null;
  plate: string;
  year?: number | null;
  seats: number;
  ac: boolean;
  city: string;
  ratePerKm: number;
  baseFare: number;
  rcNo?: string | null;
  photoUrl?: string | null;
  licenceNo?: string | null;
}

export const normalisePlate = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function getDriverVehicle(driverId: string): Promise<Vehicle | null> {
  const [v] = await q<Vehicle>(sql`SELECT * FROM cab_vehicles WHERE driver_id = ${driverId} ORDER BY created_at ASC LIMIT 1`);
  return v ?? null;
}

/** Registers the driver's vehicle, or re-submits it. Any edit sends it back for approval. */
export async function saveDriverVehicle(driverId: string, v: VehicleInput): Promise<{ ok: true; vehicle: Vehicle } | { ok: false; error: string }> {
  const plate = normalisePlate(v.plate);
  const [clash] = await q<{ driverId: string }>(sql`SELECT driver_id FROM cab_vehicles WHERE plate = ${plate} AND driver_id <> ${driverId}`);
  if (clash) return { ok: false, error: "That number plate is already registered to another driver." };

  if (v.licenceNo !== undefined) await q(sql`UPDATE cab_drivers SET licence_no = ${v.licenceNo ?? null} WHERE id = ${driverId}`);

  const existing = await getDriverVehicle(driverId);
  if (existing) {
    await q(sql`UPDATE cab_vehicles SET
      type = ${v.type}, make_model = ${v.makeModel}, colour = ${v.colour ?? null}, plate = ${plate}, year = ${v.year ?? null},
      seats = ${v.seats}, ac = ${v.ac}, city = ${v.city}, rate_per_km = ${v.ratePerKm}, base_fare = ${v.baseFare},
      rc_no = ${v.rcNo ?? null}, photo_url = COALESCE(${v.photoUrl ?? null}, photo_url),
      status = 'pending', reject_reason = NULL, available = false, updated_at = now()
      WHERE id = ${existing.id}`);
  } else {
    await q(sql`INSERT INTO cab_vehicles (id, driver_id, type, make_model, colour, plate, year, seats, ac, city, rate_per_km, base_fare, rc_no, photo_url)
      VALUES (${createId()}, ${driverId}, ${v.type}, ${v.makeModel}, ${v.colour ?? null}, ${plate}, ${v.year ?? null}, ${v.seats}, ${v.ac},
              ${v.city}, ${v.ratePerKm}, ${v.baseFare}, ${v.rcNo ?? null}, ${v.photoUrl ?? null})`);
  }
  const vehicle = (await getDriverVehicle(driverId))!;
  return { ok: true, vehicle };
}

export async function setAvailability(driverId: string, available: boolean): Promise<Vehicle | null> {
  await q(sql`UPDATE cab_vehicles SET available = ${available}, updated_at = now() WHERE driver_id = ${driverId} AND status = 'approved'`);
  return getDriverVehicle(driverId);
}

/** What a Saafera user can browse and book: approved, and the driver is taking bookings. */
export async function listBookableVehicles(filter: { type?: string; city?: string } = {}) {
  const type = filter.type && VEHICLE_TYPES.includes(filter.type as VehicleType) ? filter.type : null;
  const city = filter.city?.trim() || null;
  return q<Vehicle & { driverName: string; avgRating: number | null; ratingCount: number; trips: number }>(sql`
    SELECT v.*, d.name AS driver_name,
      (SELECT round(avg(b.rating)::numeric, 1)::float FROM cab_bookings b WHERE b.vehicle_id = v.id AND b.rating IS NOT NULL) AS avg_rating,
      (SELECT count(*)::int FROM cab_bookings b WHERE b.vehicle_id = v.id AND b.rating IS NOT NULL) AS rating_count,
      (SELECT count(*)::int FROM cab_bookings b WHERE b.vehicle_id = v.id AND b.status = 'completed') AS trips
    FROM cab_vehicles v JOIN cab_drivers d ON d.id = v.driver_id
    WHERE v.status = 'approved' AND v.available = true
      AND (${type}::text IS NULL OR v.type = ${type})
      AND (${city}::text IS NULL OR lower(v.city) = lower(${city}))
    ORDER BY v.rate_per_km ASC`);
}

export async function listVehiclesForAdmin() {
  return q<Vehicle & { driverName: string; driverPhone: string; licenceNo: string | null; createdAt: string }>(sql`
    SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, d.licence_no
    FROM cab_vehicles v JOIN cab_drivers d ON d.id = v.driver_id
    ORDER BY CASE v.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, v.created_at DESC`);
}

/** Every registered driver — including ones who haven't added a vehicle yet — for password resets. */
export async function listDriversForAdmin() {
  return q<{ id: string; name: string; phone: string; createdAt: string; hasPassword: boolean; locked: boolean; vehicle: string | null; vehicleStatus: string | null }>(sql`
    SELECT d.id, d.name, d.phone, d.created_at, (d.password_hash IS NOT NULL) AS has_password,
           (d.locked_until IS NOT NULL AND d.locked_until > (now() AT TIME ZONE 'UTC')) AS locked,
           v.make_model AS vehicle, v.status AS vehicle_status
    FROM cab_drivers d LEFT JOIN cab_vehicles v ON v.driver_id = d.id
    ORDER BY d.created_at DESC`);
}

export async function reviewVehicle(vehicleId: string, approve: boolean, reason?: string): Promise<void> {
  await q(sql`UPDATE cab_vehicles SET status = ${approve ? "approved" : "rejected"},
    reject_reason = ${approve ? null : (reason ?? "Details could not be verified").slice(0, 240)},
    available = false, updated_at = now() WHERE id = ${vehicleId}`);
}

// ── notifications ─────────────────────────────────────────────────────────────
export async function notifyDriver(driverId: string, bookingId: string | null, kind: string, title: string, body: string) {
  await q(sql`INSERT INTO cab_notifications (id, driver_id, booking_id, kind, title, body)
    VALUES (${createId()}, ${driverId}, ${bookingId}, ${kind}, ${title}, ${body.slice(0, 300)})`);
  // Real time: the stored alert above is what the app lists; the push reaches the phone even when the app is closed.
  await sendPush("driver", driverId, { title, body, url: "/drive", tag: bookingId ? `booking-${bookingId}` : kind });
}

/** Tells a traveller about their booking (web push to their devices). */
export async function notifyUser(userId: string, bookingId: string, title: string, body: string) {
  await sendPush("user", userId, { title, body, url: "/cars/bookings", tag: `booking-${bookingId}` });
}

const IST = "Asia/Kolkata";
export const istWhen = (d: Date | string) => new Date(d).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export async function recentNotifications(driverId: string) {
  return q<DriverNotification>(sql`SELECT id, booking_id, kind, title, body, read_at, created_at
    FROM cab_notifications WHERE driver_id = ${driverId} ORDER BY created_at DESC LIMIT 30`);
}

export async function markNotificationsRead(driverId: string) {
  await q(sql`UPDATE cab_notifications SET read_at = now() WHERE driver_id = ${driverId} AND read_at IS NULL`);
}

// ── bookings ──────────────────────────────────────────────────────────────────
const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  const dLa = (b.lat - a.lat) * r;
  const dLo = (b.lng - a.lng) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

type Point = { lat: number; lng: number };
/** A found place with a readable name, so the traveller can check we understood them. */
export type Place = Point & { label: string };
/** `settlement` is true when it is a city/town/district itself rather than a landmark inside one. */
type Found = Place & { settlement: boolean };

// Roughly India's bounding box. Lookups outside it are ignored, so "majestic" can never
// resolve to a place in another country and produce a thousands-of-km fare.
const INDIA = { minLat: 6, maxLat: 36.5, minLng: 68, maxLng: 98 };
const inIndia = (p: Point) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= INDIA.minLat && p.lat <= INDIA.maxLat && p.lng >= INDIA.minLng && p.lng <= INDIA.maxLng;

const SETTLEMENT_TYPES = new Set(["city", "town", "municipality", "village", "state", "state_district", "district", "county", "island"]);
const isSettlement = (key?: string, value?: string) => (key === "place" && SETTLEMENT_TYPES.has(value ?? "")) || (key === "boundary" && value === "administrative");

/** "Majestic, KMS Street, Lock Nagar, Ward 1, Bengaluru, Karnataka, 560009, India" → the first few parts. */
const shortLabel = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x && !/^\d{6}$/.test(x) && x !== "India")
    .slice(0, 4)
    .join(", ");

async function viaNominatim(text: string): Promise<Found | null> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(text)}`, {
    headers: { "User-Agent": "Saafera-Cabs/1.0 (booking distance lookup)" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as Array<{ lat: string; lon: string; class?: string; type?: string; display_name?: string }>;
  return d[0] ? { lat: Number(d[0].lat), lng: Number(d[0].lon), label: shortLabel(d[0].display_name ?? text), settlement: isSettlement(d[0].class, d[0].type) } : null;
}

async function viaPhoton(text: string): Promise<Found | null> {
  // bbox = lon_min,lat_min,lon_max,lat_max — keeps Photon inside India
  const bbox = `${INDIA.minLng},${INDIA.minLat},${INDIA.maxLng},${INDIA.maxLat}`;
  const res = await fetch(`https://photon.komoot.io/api/?limit=1&lang=en&bbox=${bbox}&q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  type Props = { name?: string; street?: string; district?: string; city?: string; state?: string; osm_key?: string; osm_value?: string };
  const d = (await res.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Props }> };
  const f = d.features?.[0];
  const c = f?.geometry?.coordinates;
  if (!c) return null;
  const p = f?.properties ?? {};
  const label = [p.name, p.street, p.district, p.city, p.state].filter(Boolean).join(", ") || text;
  return { lat: c[1], lng: c[0], label: shortLabel(label), settlement: isSettlement(p.osm_key, p.osm_value) };
}

/** First good answer wins. Both services are asked at once (a slow or blocked one can't hold things
 *  up — on a serverless host that wait is what turns into a timeout), India only. */
async function lookup(text: string): Promise<Found | null> {
  return new Promise((resolve) => {
    let pending = 2;
    const settle = (p: Found | null) => {
      if (p && inIndia(p)) return resolve(p);
      if (--pending === 0) resolve(null);
    };
    viaNominatim(text).then(settle, () => settle(null));
    viaPhoton(text).then(settle, () => settle(null));
  });
}

/** Finds a place. A bare name such as "majestic" could be anywhere, so it is also tried inside the car's city
 *  ("majestic, Bengaluru").
 *  - Pickup: always read inside the car's city — a pickup is where the car already operates.
 *  - Drop: if what was typed is itself a city or town ("Mysuru", "Kochi") that wins, since long trips go to other
 *    cities; otherwise it is taken to be a landmark in the car's city.
 *  Names can still be ambiguous, which is why the traveller is shown what was found before confirming. */
async function geocode(text: string, cityHint: string | null, role: "pickup" | "drop"): Promise<Place | null> {
  const bare = !text.includes(",") && !!cityHint && !text.toLowerCase().includes(cityHint.toLowerCase());
  if (!bare) return lookup(text);
  const [plain, hinted] = await Promise.all([lookup(text), lookup(`${text}, ${cityHint}`)]);
  if (role === "drop" && plain?.settlement) return plain;
  return hinted ?? plain;
}

type BookableVehicle = Vehicle & { driverName: string };

async function loadBookableVehicle(vehicleId: string): Promise<{ ok: true; v: BookableVehicle } | { ok: false; error: string }> {
  const [v] = await q<BookableVehicle>(sql`
    SELECT v.*, d.name AS driver_name FROM cab_vehicles v JOIN cab_drivers d ON d.id = v.driver_id WHERE v.id = ${vehicleId}`);
  if (!v || v.status !== "approved") return { ok: false, error: "That vehicle is not available." };
  if (!v.available) return { ok: false, error: "This driver is not taking bookings right now. Pick another vehicle." };
  return { ok: true, v };
}

export interface TripQuote {
  pickup: Place;
  drop: Place;
  distanceKm: number;
  fare: number;
}

/** Works out where the trip goes and what it costs. `given` places (already confirmed by the traveller) skip the lookup. */
async function resolveTrip(
  v: BookableVehicle,
  pickupText: string,
  dropText: string,
  given?: { pickup?: Place | null; drop?: Place | null },
): Promise<({ ok: true } & TripQuote) | { ok: false; error: string }> {
  if (pickupText.trim().toLowerCase() === dropText.trim().toLowerCase()) {
    return { ok: false, error: "Pickup and drop are the same place. Enter where you're going." };
  }
  const usable = (p?: Place | null) => (p && inIndia(p) ? p : null);
  const [pickup, drop] = await Promise.all([
    usable(given?.pickup) ?? geocode(pickupText, v.city, "pickup"),
    usable(given?.drop) ?? geocode(dropText, v.city, "drop"),
  ]);
  // A fare needs a distance, so a place that can't be found stops things here
  // rather than creating a ₹0 request the driver would be asked to accept.
  if (!pickup) return { ok: false, error: `We couldn't find the pickup "${pickupText}". Try a landmark with the city, e.g. "Majestic, ${v.city}".` };
  if (!drop) return { ok: false, error: `We couldn't find the drop "${dropText}". Try a landmark with the city, e.g. "Mysuru Palace, Mysuru".` };
  const straight = haversineKm(pickup, drop);
  if (straight < 0.2) return { ok: false, error: "Pickup and drop resolve to the same spot. Be more specific about where you're going." };
  if (straight > MAX_TRIP_KM) return { ok: false, error: `That's about ${Math.round(straight * 1.3)} km — too far for a single booking. Check the pickup and drop (include the city).` };
  const distanceKm = Math.max(1, +(straight * 1.3).toFixed(1));
  const fare = Math.max(1, Math.round(v.baseFare + distanceKm * v.ratePerKm));
  return { ok: true, pickup, drop, distanceKm, fare };
}

/** The "check price" step: nothing is created, the traveller just sees what we understood. */
export async function quoteCabTrip(vehicleId: string, pickupText: string, dropText: string): Promise<({ ok: true } & TripQuote) | { ok: false; error: string }> {
  const loaded = await loadBookableVehicle(vehicleId);
  if (!loaded.ok) return loaded;
  return resolveTrip(loaded.v, pickupText, dropText);
}

export interface BookingInput {
  userId: string;
  userName: string | null;
  userPhone: string | null;
  vehicleId: string;
  pickupText: string;
  dropText: string;
  /** places the traveller confirmed in the quote step (optional; looked up again if missing) */
  pickupPlace?: Place | null;
  dropPlace?: Place | null;
  pickupAt: Date;
  passengers: number;
  note?: string;
}

/** What the driver reads: what the traveller typed, plus the place we matched when that adds information. */
const describePlace = (typed: string, p: Place) => {
  const t = typed.trim();
  return (t.includes(",") || !p.label ? t : `${t} — ${p.label}`).slice(0, 240);
};

export async function createCabBooking(input: BookingInput): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const loaded = await loadBookableVehicle(input.vehicleId);
  if (!loaded.ok) return loaded;
  const v = loaded.v;
  if (input.passengers > v.seats) return { ok: false, error: `This vehicle seats ${v.seats}.` };
  if (input.pickupAt.getTime() < Date.now() - 5 * 60000) return { ok: false, error: "Pickup time is in the past." };

  const trip = await resolveTrip(v, input.pickupText, input.dropText, { pickup: input.pickupPlace, drop: input.dropPlace });
  if (!trip.ok) return trip;
  const { pickup, drop, distanceKm, fare } = trip;
  const pickupText = describePlace(input.pickupText, pickup);
  const dropText = describePlace(input.dropText, drop);
  const id = createId();
  const otp = String(randomInt(1000, 10000));

  await q(sql`INSERT INTO cab_bookings
    (id, vehicle_id, driver_id, user_id, user_name, user_phone, pickup_text, pickup_lat, pickup_lng, drop_text, drop_lat, drop_lng,
     pickup_at, passengers, distance_km, fare, note, otp)
    VALUES (${id}, ${v.id}, ${v.driverId}, ${input.userId}, ${input.userName}, ${input.userPhone}, ${pickupText},
            ${pickup.lat}, ${pickup.lng}, ${dropText}, ${drop.lat}, ${drop.lng},
            (${input.pickupAt.toISOString()}::timestamptz AT TIME ZONE 'UTC'), ${input.passengers}, ${distanceKm}, ${fare}, ${input.note?.slice(0, 300) ?? null}, ${otp})`);

  await notifyDriver(
    v.driverId,
    id,
    "booking_new",
    "New booking request",
    `${input.userName ?? "A traveller"} wants ${v.makeModel} from ${pickupText} to ${dropText}. ₹${fare}.`,
  );

  const [booking] = await q<Booking>(sql`SELECT * FROM cab_bookings WHERE id = ${id}`);
  return { ok: true, booking };
}

/** Frees up requests the driver never answered. Cheap enough to run on every sync. */
export async function expireStaleRequests(): Promise<void> {
  const gone = await q<{ id: string; userId: string; dropText: string }>(sql`UPDATE cab_bookings SET status = 'expired', updated_at = now()
    WHERE status = 'requested' AND created_at < now() - make_interval(mins => ${REQUEST_TTL_MIN}) RETURNING id, user_id, drop_text`);
  for (const b of gone) await notifyUser(b.userId, b.id, "No response from the driver", `Your request to ${b.dropText} wasn't answered. Please pick another car.`);
}

export async function driverBookings(driverId: string) {
  await expireStaleRequests();
  return q<Booking>(sql`SELECT * FROM cab_bookings WHERE driver_id = ${driverId} ORDER BY created_at DESC LIMIT 80`);
}

export async function userBookings(userId: string) {
  await expireStaleRequests();
  const rows = await q<Booking & { makeModel: string; plate: string; driverName: string; driverPhone: string; vehicleType: string }>(sql`
    SELECT b.*, v.make_model, v.plate, v.type AS vehicle_type, d.name AS driver_name, d.phone AS driver_phone
    FROM cab_bookings b
    JOIN cab_vehicles v ON v.id = b.vehicle_id
    JOIN cab_drivers d ON d.id = b.driver_id
    WHERE b.user_id = ${userId} ORDER BY b.created_at DESC LIMIT 50`);
  return rows.map((r) => ({ ...r, expiresAt: requestExpiresAt(r.createdAt) }));
}

export type DriverAction = "accept" | "decline" | "arrived" | "start" | "complete" | "cancel";

// action → [new status, statuses it may move from]
const TRANSITIONS: Record<DriverAction, [BookingStatus, BookingStatus[]]> = {
  accept: ["accepted", ["requested"]],
  decline: ["declined", ["requested"]],
  arrived: ["arrived", ["accepted"]],
  start: ["started", ["arrived", "accepted"]],
  complete: ["completed", ["started"]],
  cancel: ["cancelled", ["accepted", "arrived"]],
};

export async function driverAct(
  driverId: string,
  bookingId: string,
  action: DriverAction,
  otp?: string,
): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const [b] = await q<Booking>(sql`SELECT * FROM cab_bookings WHERE id = ${bookingId} AND driver_id = ${driverId}`);
  if (!b) return { ok: false, error: "Booking not found." };

  const [to, from] = TRANSITIONS[action];
  if (!from.includes(b.status)) return { ok: false, error: `This booking is already ${b.status}.` };

  const pickup = new Date(b.pickupAt);
  if (action === "accept") {
    if (pickup.getTime() < Date.now() - 60 * 60000) return { ok: false, error: "That pickup time has already passed." };
    // one car can't be in two places: refuse a booking that overlaps one already accepted
    const [clash] = await q<{ pickupAt: string }>(sql`SELECT pickup_at FROM cab_bookings
      WHERE driver_id = ${driverId} AND id <> ${bookingId} AND status IN ('accepted', 'arrived', 'started')
        AND abs(extract(epoch FROM (pickup_at - (${pickup.toISOString()}::timestamptz AT TIME ZONE 'UTC')))) < ${OVERLAP_HOURS * 3600} LIMIT 1`);
    if (clash) return { ok: false, error: `You already have a booking around ${istWhen(clash.pickupAt)}. Finish or cancel it first.` };
  }
  if ((action === "arrived" || action === "start") && Date.now() < pickup.getTime() - EARLY_MIN * 60000) {
    return { ok: false, error: `Too early — the pickup is at ${istWhen(pickup)}. You can mark arrival from ${EARLY_MIN} minutes before.` };
  }
  if (action === "start" && otp !== b.otp) return { ok: false, error: "Wrong code. Ask the rider for their 4-digit start code." };

  // The WHERE re-checks the status so two taps can't both win.
  const done = await q<Booking>(sql`UPDATE cab_bookings SET status = ${to}, updated_at = now(),
      accepted_at = CASE WHEN ${to}::text = 'accepted' THEN now() ELSE accepted_at END,
      arrived_at = CASE WHEN ${to}::text = 'arrived' THEN now() ELSE arrived_at END,
      started_at = CASE WHEN ${to}::text = 'started' THEN now() ELSE started_at END,
      completed_at = CASE WHEN ${to}::text = 'completed' THEN now() ELSE completed_at END
    WHERE id = ${bookingId} AND driver_id = ${driverId} AND status IN (${sql.join(from.map((s) => sql`${s}`), sql`, `)}) RETURNING *`);
  if (!done[0]) return { ok: false, error: "This booking just changed. Refresh and try again." };

  // Tell the traveller what just happened.
  const [who] = await q<{ name: string; makeModel: string }>(sql`SELECT d.name, v.make_model FROM cab_drivers d JOIN cab_vehicles v ON v.id = ${b.vehicleId} WHERE d.id = ${driverId}`);
  const driver = who?.name ?? "Your driver";
  const msg: Record<DriverAction, [string, string]> = {
    accept: ["Driver accepted your booking", `${driver} will pick you up in a ${who?.makeModel ?? "car"} at ${istWhen(pickup)}. Open Saafera for your start code.`],
    decline: ["Driver can't take this booking", "Please pick another car — your request wasn't charged anything."],
    arrived: ["Your driver has arrived", `${driver} is at ${b.pickupText}. Share your start code to begin.`],
    start: ["Your trip has started", `On the way to ${b.dropText}.`],
    complete: ["Trip completed", `Fare ₹${b.fare} — pay the driver directly. Tap to rate your trip.`],
    cancel: ["Driver cancelled your booking", "Sorry about that. Please book another car."],
  };
  await notifyUser(b.userId, bookingId, msg[action][0], msg[action][1]);
  return { ok: true, booking: done[0] };
}

export async function userCancel(userId: string, bookingId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const done = await q<Booking>(sql`UPDATE cab_bookings SET status = 'cancelled', updated_at = now()
    WHERE id = ${bookingId} AND user_id = ${userId} AND status IN ('requested', 'accepted') RETURNING *`);
  if (!done[0]) return { ok: false, error: "This booking can't be cancelled any more." };
  await notifyDriver(done[0].driverId, bookingId, "booking_cancelled", "Booking cancelled", `${done[0].userName ?? "The rider"} cancelled the trip to ${done[0].dropText}.`);
  return { ok: true };
}

/** What a driver may see of a booking: never the rider's start code (the driver has to
 *  ask for it), and the rider's phone only once the driver has accepted. */
export type DriverBooking = Omit<Booking, "otp"> & { expiresAt: string };

export function forDriver(b: Booking): DriverBooking {
  const { otp: _otp, ...rest } = b;
  const contactable = b.status === "accepted" || b.status === "arrived" || b.status === "started";
  return { ...rest, userPhone: contactable ? b.userPhone : null, expiresAt: requestExpiresAt(b.createdAt) };
}

/** A traveller rates a completed trip, once. The driver is told. */
export async function rateBooking(userId: string, bookingId: string, rating: number, review?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Choose 1 to 5 stars." };
  const done = await q<Booking>(sql`UPDATE cab_bookings SET rating = ${rating}, review = ${review?.trim().slice(0, 400) || null}, updated_at = now()
    WHERE id = ${bookingId} AND user_id = ${userId} AND status = 'completed' AND rating IS NULL RETURNING *`);
  if (!done[0]) return { ok: false, error: "This trip can't be rated (already rated, or not completed)." };
  await notifyDriver(done[0].driverId, bookingId, "rating", `You got ${rating} ${rating === 1 ? "star" : "stars"}`, review?.trim() ? `"${review.trim().slice(0, 200)}"` : `${done[0].userName ?? "A traveller"} rated your trip to ${done[0].dropText}.`);
  return { ok: true };
}

export async function driverStats(driverId: string) {
  const [s] = await q<{ avgRating: number | null; ratingCount: number; completedTrips: number }>(sql`
    SELECT (SELECT round(avg(rating)::numeric, 2)::float FROM cab_bookings WHERE driver_id = ${driverId} AND rating IS NOT NULL) AS avg_rating,
           (SELECT count(*)::int FROM cab_bookings WHERE driver_id = ${driverId} AND rating IS NOT NULL) AS rating_count,
           (SELECT count(*)::int FROM cab_bookings WHERE driver_id = ${driverId} AND status = 'completed') AS completed_trips`);
  return s ?? { avgRating: null, ratingCount: 0, completedTrips: 0 };
}

/** When an unanswered request lapses. */
export const requestExpiresAt = (createdAt: string) => new Date(new Date(createdAt).getTime() + REQUEST_TTL_MIN * 60000).toISOString();
