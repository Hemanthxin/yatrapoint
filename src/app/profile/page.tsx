import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppShell } from "@/components/app/AppShell";
import { ProfileForm } from "./ProfileForm";
import { ProfilePosts } from "./ProfilePosts";
import { ProfileTabs } from "./ProfileTabs";
import { SavedTrips } from "./SavedTrips";
import { listUserTripPlans } from "@/lib/queries/trip-plans";
import { listFavoritedDestinations } from "@/lib/queries/destinations";
import { listMyPosts, getFeedSocial } from "@/lib/queries/community";
import { DestinationCard } from "@/components/app/DestinationCard";
import { formatINR, formatDays } from "@/lib/format";
import { categoryLabel } from "@/lib/catalog/categories";
import { Calendar, MapPin, Users, Wallet } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id!))
    .limit(1);

  if (!row) redirect("/");

  const [plans, favorited, posts] = await Promise.all([
    listUserTripPlans(row.id),
    listFavoritedDestinations(row.id),
    listMyPosts(row.id),
  ]);

  const social = await getFeedSocial(
    posts.map((p) => p.id),
    row.id
  );

  const display = row.name || row.email || row.phone || "Traveller";

  const counts = {
    posts: posts.length,
    trips: plans.length,
    saved: favorited.length,
  };

  // --- Catalogue trip plans saved to the DB (rendered inside <SavedTrips/>,
  // which also lists trips saved from the Budget Planner). ---
  const dbPlansNode =
    plans.length === 0 ? null : (
      <div className="space-y-4">
        {plans.map((p) => (
          <article
            key={p.id}
            className="card-hover overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <div>
                <h3 className="font-extrabold tracking-tight text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-500">
                  Saved{" "}
                  {new Date(p.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  {formatINR(p.totalBudget)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  {formatDays(p.days)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-emerald-600" />
                  {p.travellers} {p.travellers === 1 ? "traveller" : "travellers"}
                </span>
                {p.category && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                    {categoryLabel(p.category)}
                  </span>
                )}
              </div>
            </div>
            <ul className="divide-y divide-slate-100">
              {p.items.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <Link
                    href={`/destinations/${d.slug}`}
                    className="flex items-center gap-2 font-medium text-slate-900 hover:text-emerald-700"
                  >
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {d.name}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {d.state} · {formatINR(d.budgetPerDay)}/day
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    );

  // --- Saved destinations content (Saved tab) ---
  const savedContent =
    favorited.length === 0 ? (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-4xl">❤️</p>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          Tap the heart on any destination to save it for later.
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorited.map((d) => (
          <DestinationCard key={d.id} destination={d} favored />
        ))}
      </div>
    );

  return (
    <AppShell userLabel={display} userImage={row.image}>
      <div className="animate-fadeUp">
        <ProfileForm
          initial={{
            name: row.name ?? "",
            email: row.email ?? "",
            username: row.username ?? "",
            bio: row.bio ?? "",
            image: row.image ?? null,
          }}
          phone={row.phone ?? ""}
          userId={row.id}
          stats={counts}
        />

        <ProfileTabs
          counts={counts}
          posts={<ProfilePosts posts={posts} social={social} />}
          trips={<SavedTrips dbPlans={dbPlansNode} hasDbPlans={plans.length > 0} />}
          saved={savedContent}
        />
      </div>
    </AppShell>
  );
}
