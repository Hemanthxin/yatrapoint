import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Tables for the cab marketplace: drivers register a vehicle in the Saafera Captain
// driver app, Saafera users book that specific vehicle, and the driver is
// notified. Idempotent and memoised, like ensure-reviews.ts — the app creates
// the tables on first use and `npm run db:migrate:cabs` just calls this.
//
// Additive only: nothing here touches an existing table.
let ready: Promise<void> | null = null;

export function ensureCabTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS "cab_drivers" (
        "id" text PRIMARY KEY,
        "phone" varchar(20) NOT NULL UNIQUE,
        "name" varchar(120) NOT NULL,
        "licence_no" varchar(40),
        "created_at" timestamp DEFAULT now() NOT NULL
      )`);

      await db.execute(sql`CREATE TABLE IF NOT EXISTS "cab_driver_sessions" (
        "token_hash" text PRIMARY KEY,
        "driver_id" text NOT NULL REFERENCES "cab_drivers"("id") ON DELETE CASCADE,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`);

      // status: pending (awaiting admin) | approved | rejected
      await db.execute(sql`CREATE TABLE IF NOT EXISTS "cab_vehicles" (
        "id" text PRIMARY KEY,
        "driver_id" text NOT NULL REFERENCES "cab_drivers"("id") ON DELETE CASCADE,
        "type" varchar(20) NOT NULL,
        "make_model" varchar(80) NOT NULL,
        "colour" varchar(30),
        "plate" varchar(20) NOT NULL UNIQUE,
        "year" integer,
        "seats" integer DEFAULT 4 NOT NULL,
        "ac" boolean DEFAULT true NOT NULL,
        "city" varchar(60) NOT NULL,
        "rate_per_km" integer NOT NULL,
        "base_fare" integer DEFAULT 0 NOT NULL,
        "rc_no" varchar(40),
        "photo_url" text,
        "status" varchar(12) DEFAULT 'pending' NOT NULL,
        "reject_reason" varchar(240),
        "available" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "cab_vehicles_driver_idx" ON "cab_vehicles" ("driver_id")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "cab_vehicles_listing_idx" ON "cab_vehicles" ("status", "available")`);

      // status: requested | accepted | declined | cancelled | arrived | started | completed | expired
      await db.execute(sql`CREATE TABLE IF NOT EXISTS "cab_bookings" (
        "id" text PRIMARY KEY,
        "vehicle_id" text NOT NULL REFERENCES "cab_vehicles"("id") ON DELETE CASCADE,
        "driver_id" text NOT NULL REFERENCES "cab_drivers"("id") ON DELETE CASCADE,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "user_name" varchar(120),
        "user_phone" varchar(20),
        "pickup_text" varchar(240) NOT NULL,
        "pickup_lat" double precision,
        "pickup_lng" double precision,
        "drop_text" varchar(240) NOT NULL,
        "drop_lat" double precision,
        "drop_lng" double precision,
        "pickup_at" timestamp NOT NULL,
        "passengers" integer DEFAULT 1 NOT NULL,
        "distance_km" real,
        "fare" integer NOT NULL,
        "note" varchar(300),
        "otp" varchar(4) NOT NULL,
        "status" varchar(12) DEFAULT 'requested' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "cab_bookings_driver_idx" ON "cab_bookings" ("driver_id", "created_at")`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "cab_bookings_user_idx" ON "cab_bookings" ("user_id", "created_at")`);

      await db.execute(sql`CREATE TABLE IF NOT EXISTS "cab_notifications" (
        "id" text PRIMARY KEY,
        "driver_id" text NOT NULL REFERENCES "cab_drivers"("id") ON DELETE CASCADE,
        "booking_id" text REFERENCES "cab_bookings"("id") ON DELETE CASCADE,
        "kind" varchar(24) NOT NULL,
        "title" varchar(120) NOT NULL,
        "body" varchar(300) NOT NULL,
        "read_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "cab_notifications_driver_idx" ON "cab_notifications" ("driver_id", "created_at")`);

      // Password sign-in for drivers (bcrypt hash) with a lockout after repeated wrong passwords.
      for (const col of ["password_hash text", "failed_logins integer DEFAULT 0 NOT NULL", "locked_until timestamp"]) {
        await db.execute(sql.raw(`ALTER TABLE "cab_drivers" ADD COLUMN IF NOT EXISTS ${col}`));
      }

      // Stage timestamps (for the traveller's progress view) and the traveller's rating.
      for (const col of ["accepted_at timestamp", "arrived_at timestamp", "started_at timestamp", "completed_at timestamp", "rating integer", "review varchar(400)"]) {
        await db.execute(sql.raw(`ALTER TABLE "cab_bookings" ADD COLUMN IF NOT EXISTS ${col}`));
      }

      // Web Push subscriptions: one row per browser/device, for a driver or a traveller.
      await db.execute(sql`CREATE TABLE IF NOT EXISTS "cab_push_subscriptions" (
        "id" text PRIMARY KEY,
        "owner_type" varchar(8) NOT NULL,
        "owner_id" text NOT NULL,
        "endpoint" text NOT NULL UNIQUE,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "cab_push_owner_idx" ON "cab_push_subscriptions" ("owner_type", "owner_id")`);
    })().catch((err) => {
      ready = null; // let the next request retry
      throw err;
    });
  }
  return ready;
}
