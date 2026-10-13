import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

// Idempotent migration for the cab marketplace tables (drivers, vehicles,
// bookings, notifications). The app also creates them on first use, so running
// this is optional.
// Run: npm run db:migrate:cabs
async function run() {
  const { ensureCabTables } = await import("../src/lib/db/ensure-cabs");
  await ensureCabTables();
  console.log("cab_drivers, cab_vehicles, cab_bookings, cab_notifications tables ready.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
