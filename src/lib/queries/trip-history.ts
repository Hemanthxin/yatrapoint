import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tripHistory, type TripHistoryRow } from "@/lib/db/schema";

export async function listTripHistory(userId: string, limit = 50): Promise<TripHistoryRow[]> {
  return db
    .select()
    .from(tripHistory)
    .where(eq(tripHistory.userId, userId))
    .orderBy(desc(tripHistory.createdAt))
    .limit(limit);
}
