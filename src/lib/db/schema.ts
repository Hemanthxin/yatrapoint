import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/utils/id";

// --- Application user ---
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: varchar("name", { length: 120 }),
  email: varchar("email", { length: 255 }).unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  phone: varchar("phone", { length: 20 }).unique(),
  phoneVerified: timestamp("phone_verified", { mode: "date" }),
  image: text("image"),
  // Email/phone + password login (bcrypt hash; null for Google-only users).
  passwordHash: text("password_hash"),
  // Instagram-style profile fields.
  username: varchar("username", { length: 40 }),
  bio: varchar("bio", { length: 300 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- NextAuth tables (DrizzleAdapter v5 compatible) ---
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    pk: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// --- Phone OTP ---
// We store hashed codes (never plaintext) with short expiry and attempt limits.
export const otpCodes = pgTable("otp_codes", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  phone: varchar("phone", { length: 20 }).notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  consumed: boolean("consumed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Travel domain ---
// Curated catalogue of places. `slug` is the URL key. `budgetPerDay` is INR
// for one traveller on a mid-range plan; the budget planner scales by people
// and days.
export const destinations = pgTable("destinations", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  state: varchar("state", { length: 60 }).notNull(),
  district: varchar("district", { length: 80 }),
  category: varchar("category", { length: 40 }).notNull(),
  placeType: varchar("place_type", { length: 60 }),
  description: text("description").notNull(),
  shortDescription: varchar("short_description", { length: 220 }).notNull(),
  imageUrl: text("image_url"),
  openingTimings: varchar("opening_timings", { length: 120 }),
  entryFees: integer("entry_fees").default(0).notNull(),
  budgetPerDay: integer("budget_per_day").notNull(),
  recommendedDays: integer("recommended_days").default(2).notNull(),
  bestMonths: text("best_months"),
  isHidden: boolean("is_hidden").default(false).notNull(),
  popularity: integer("popularity").default(50).notNull(),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  // Which admin created this place (for per-admin analytics).
  addedByEmail: varchar("added_by_email", { length: 255 }),
  addedByName: varchar("added_by_name", { length: 120 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  stateIdx: index("destinations_state_idx").on(table.state),
  districtIdx: index("destinations_district_idx").on(table.district),
  categoryIdx: index("destinations_category_idx").on(table.category),
  popularityIdx: index("destinations_popularity_idx").on(table.popularity),
  isHiddenIdx: index("destinations_is_hidden_idx").on(table.isHidden),
}));

export const tripPlans = pgTable("trip_plans", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 140 }).notNull(),
  totalBudget: integer("total_budget").notNull(),
  days: integer("days").notNull(),
  travellers: integer("travellers").default(1).notNull(),
  category: varchar("category", { length: 40 }),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Every trip-plan query filters by userId then sorts by createdAt desc.
  userCreatedIdx: index("trip_plans_user_created_idx").on(table.userId, table.createdAt),
}));

export const tripPlanItems = pgTable(
  "trip_plan_items",
  {
    tripPlanId: text("trip_plan_id")
      .notNull()
      .references(() => tripPlans.id, { onDelete: "cascade" }),
    destinationId: text("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tripPlanId, t.destinationId] }),
  })
);

export const favorites = pgTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destinationId: text("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.destinationId] }),
  })
);

// Day-trips from a base city. Distinct from `destinations` because these are
// near-by spots intended for a single-day return trip and need precise
// driving distance + duration vs the base city.
export const nearbyDestinations = pgTable("nearby_destinations", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 140 }).notNull(),
  baseCity: varchar("base_city", { length: 60 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  description: text("description").notNull(),
  shortDescription: varchar("short_description", { length: 220 }).notNull(),
  imageUrl: text("image_url"),
  distanceKm: integer("distance_km").notNull(),
  drivingMinutes: integer("driving_minutes").notNull(),
  entryFeePerPerson: integer("entry_fee_per_person").default(0).notNull(),
  idealHoursAtPlace: integer("ideal_hours_at_place").default(3).notNull(),
  bestStartTime: varchar("best_start_time", { length: 10 }),
  highlights: text("highlights"),
  latitude: varchar("latitude", { length: 20 }).notNull(),
  longitude: varchar("longitude", { length: 20 }).notNull(),
  popularity: integer("popularity").default(50).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// In-city places (Bengaluru first). One table for every "thing in the city" —
// attractions, restaurants, malls, parks, temples, nightlife — distinguished
// by `kind`. Coordinates are real; opening hours / fees are seeded snapshots
// that get replaced by live Google Places data when GOOGLE_MAPS_API_KEY is set.
export const cityPlaces = pgTable("city_places", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  slug: varchar("slug", { length: 140 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  city: varchar("city", { length: 80 }).notNull(),
  kind: varchar("kind", { length: 40 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  area: varchar("area", { length: 120 }),
  description: text("description").notNull(),
  shortDescription: varchar("short_description", { length: 240 }).notNull(),
  imageUrl: text("image_url"),
  entryFeePerPerson: integer("entry_fee_per_person").default(0).notNull(),
  // For restaurants / pubs; null for attractions.
  avgCostForTwo: integer("avg_cost_for_two"),
  idealMinutesAtPlace: integer("ideal_minutes_at_place").default(60).notNull(),
  openTime: varchar("open_time", { length: 10 }),
  closeTime: varchar("close_time", { length: 10 }),
  openDays: varchar("open_days", { length: 30 }),
  tags: text("tags"),
  latitude: varchar("latitude", { length: 20 }).notNull(),
  longitude: varchar("longitude", { length: 20 }).notNull(),
  googlePlaceId: text("google_place_id"),
  popularity: integer("popularity").default(50).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  popularityIdx: index("city_places_popularity_idx").on(table.popularity),
}));

// --- Community / Hidden Places (Module 4) ---
// User-submitted hidden gems: photo + live location + description, held for
// admin verification before being published to the community feed.
export const communityPosts = pgTable("community_posts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorName: varchar("author_name", { length: 120 }),
  authorImage: text("author_image"),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description").notNull(),
  // 1–5 star rating the author gave the place.
  rating: integer("rating"),
  // Stored as an image URL or a small data URL uploaded by the user.
  photoUrl: text("photo_url"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  locationName: varchar("location_name", { length: 200 }),
  // Posts go live instantly now ("published"); kept for compatibility.
  status: varchar("status", { length: 20 }).default("published").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Feed queries filter by status then sort by createdAt desc; "my posts"
  // filters by userId then sorts by createdAt desc.
  statusCreatedIdx: index("community_posts_status_created_idx").on(table.status, table.createdAt),
  userCreatedIdx: index("community_posts_user_created_idx").on(table.userId, table.createdAt),
}));

export type CommunityPost = typeof communityPosts.$inferSelect;
export type NewCommunityPost = typeof communityPosts.$inferInsert;

// Travel-flavoured reactions — one per user per post. type: love | wantToGo | beenThere
export const communityReactions = pgTable(
  "community_reactions",
  {
    postId: text("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.postId, t.userId] }) })
);

export const communityComments = pgTable("community_comments", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  postId: text("post_id")
    .notNull()
    .references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorName: varchar("author_name", { length: 120 }),
  authorImage: text("author_image"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  postCreatedIdx: index("community_comments_post_created_idx").on(table.postId, table.createdAt),
}));

export type CommunityComment = typeof communityComments.$inferSelect;

// --- Hotels / stays (imported from the Data/ datasets) ---
export const hotels = pgTable("hotels", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 220 }).notNull(),
  city: varchar("city", { length: 120 }),
  area: varchar("area", { length: 200 }),
  state: varchar("state", { length: 80 }),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  pricePerNight: integer("price_per_night"),
  taxPerNight: integer("tax_per_night"),
  rating: real("rating"),
  starRating: integer("star_rating"),
  reviews: integer("reviews"),
  brand: varchar("brand", { length: 120 }),
  propertyType: varchar("property_type", { length: 120 }),
  roomType: varchar("room_type", { length: 200 }),
  nearestLandmark: text("nearest_landmark"),
  source: varchar("source", { length: 40 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  priceIdx: index("hotels_price_idx").on(table.pricePerNight),
  ratingIdx: index("hotels_rating_idx").on(table.rating),
  cityIdx: index("hotels_city_idx").on(table.city),
}));

export type Hotel = typeof hotels.$inferSelect;
export type NewHotel = typeof hotels.$inferInsert;

// --- Admin headlines / news ticker ---
export const announcements = pgTable("announcements", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  message: varchar("message", { length: 300 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Announcement = typeof announcements.$inferSelect;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type Destination = typeof destinations.$inferSelect;
export type NewDestination = typeof destinations.$inferInsert;
export type TripPlan = typeof tripPlans.$inferSelect;
export type NearbyDestination = typeof nearbyDestinations.$inferSelect;
export type NewNearbyDestination = typeof nearbyDestinations.$inferInsert;
export type CityPlace = typeof cityPlaces.$inferSelect;
export type NewCityPlace = typeof cityPlaces.$inferInsert;
