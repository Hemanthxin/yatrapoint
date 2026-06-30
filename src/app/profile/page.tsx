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
import { Calendar, MapPin, Users, Wallet, Phone, Mail } from "lucide-react";

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

  const initial = display.charAt(0).toUpperCase();

  return (
    <AppShell userLabel={display} userImage={row.image}>
      <div className="animate-fadeUp">
      {/* Bold profile header card */}
      <section className="bleed relative mb-6 overflow-hidden rounded-none bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-6 text-white shadow-2xl shadow-emerald-900/20 md:rounded-3xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="rounded-full bg-gradient-to-br from-white/80 to-white/30 p-[3px] shadow-lg">
            {row.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.image}
                alt=""
                className="h-20 w-20 rounded-full object-cover ring-2 ring-white/60"
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white/20 text-3xl font-extrabold text-white ring-2 ring-white/60 backdrop-blur">
                {initial}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight drop-shadow">
              {display}
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/85">
              {row.phone ? (
                <>
                  <Phone className="h-3.5 w-3.5" /> {row.phone}
                </>
              ) : row.email ? (
                <>
                  <Mail className="h-3.5 w-3.5" /> {row.email}
                </>
              ) : (
                "Traveller"
              )}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              ✦ Yatra Point Traveller
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Account details</h2>
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
        <h2 className="mb-3 text-lg font-extrabold tracking-tight text-slate-900">Saved trips</h2>
        {plans.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-3xl">🧳</p>
            <p className="mt-2 text-sm text-slate-500">
              You haven't saved any trip plans yet.
            </p>
            <Link
              href="/budget-planner"
              className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95"
            >
              Plan your first trip
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((p) => (
              <article
                key={p.id}
                className="card-hover overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{p.name}</h3>
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
        <h2 className="mb-3 text-lg font-extrabold tracking-tight text-slate-900">
          Saved destinations
        </h2>
        {favorited.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-3xl">❤️</p>
            <p className="mt-2 text-sm text-slate-500">
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
      </div>
    </AppShell>
  );
}
