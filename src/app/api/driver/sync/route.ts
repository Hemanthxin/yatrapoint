import { fail, ok } from "@/lib/cab/api";
import { driverBookings, driverFromRequest, driverStats, forDriver, getDriverVehicle, recentNotifications } from "@/lib/cab/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The driver app polls this every few seconds. One call returns everything it
// shows: profile, vehicle (and whether it has been approved), bookings and alerts.
export async function GET(req: Request) {
  const driver = await driverFromRequest(req);
  if (!driver) return fail("Please sign in again.", 401);

  const [vehicle, bookings, notifications, stats] = await Promise.all([
    getDriverVehicle(driver.id),
    driverBookings(driver.id),
    recentNotifications(driver.id),
    driverStats(driver.id),
  ]);
  return ok({ driver, vehicle, stats, bookings: bookings.map(forDriver), notifications, serverTime: new Date().toISOString() });
}
