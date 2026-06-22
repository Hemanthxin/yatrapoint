import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppShell } from "@/components/app/AppShell";
import { ProfileForm } from "./ProfileForm";
import { listUserTripPlans } from "@/lib/queries/trip-plans";
import { listFavoritedDestinations } from "@/lib/queries/destinations";
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

  const [plans, favorited] = await Promise.all([
    listUserTripPlans(row.id),
    listFavoritedDestinations(row.id),
  ]);

  const display = row.name || row.email || row.phone || "Traveller";

  return (
    <AppShell userLabel={display} userImage={row.image}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Personalise your account and see what you've saved.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Account details</h2>
        <p className="mt-1 text-xs text-slate-500">
          Phone is linked via OTP and can't be changed here.
        </p>
        <ProfileForm
          initial={{ name: row.name ?? "", email: row.email ?? "" }}
          phone={row.phone ?? ""}
          userId={row.id}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Saved trips</h2>
        {plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">
              You haven't saved any trip plans yet.
            </p>
            <Link
              href="/budget-planner"
              className="mt-3 inline-block rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Plan your first trip
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="text-xs text-slate-500">
                      Saved {new Date(p.createdAt).toLocaleDateString("en-IN", {
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
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
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
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Saved destinations
        </h2>
        {favorited.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm text-slate-500">
              Tap the heart on any destination to save it for later.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorited.map((d) => (
              <DestinationCard key={d.id} destination={d} favored />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
