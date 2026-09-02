"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  ExternalLink,
  Film,
  Lightbulb,
  MapPin,
  Navigation,
  Search,
  Share2,
  ShoppingBag,
  Ticket,
  Utensils,
  Wallet,
} from "lucide-react";

import type { Destination } from "@/lib/db/schema";
import type { GalleryImage } from "@/lib/queries/place-gallery";
import { formatINR, formatBestMonths, formatDays } from "@/lib/format";
import { CATEGORY_BY_SLUG, CATEGORY_GRADIENT, type CategorySlug } from "@/lib/catalog/categories";
import { formatKm, haversineKm } from "@/lib/geo";
import { HeroPhoto } from "@/components/app/HeroPhoto";
import { FavoriteButton } from "@/components/app/FavoriteButton";
import { AddToCartButton } from "@/components/app/AddToCartButton";
import { NearbyList, useNearbyAmenities, type OsmPlace } from "./NearbyByCategory";
import { LiveBudget } from "./LiveBudget";

type NearPlace = Destination & { distanceKm: number };

interface Props {
  place: Destination;
  gallery: GalleryImage[];
  nearby: NearPlace[];
  favored: boolean;
  // Food and shopping already in our catalogue, read from the database on the
  // server. Rendered immediately; the live OSM lookup only adds to these.
  seededPoi?: { food: OsmPlace[]; shopping: OsmPlace[] };
}

const TABS: { id: TabId; label: string; sub?: string; icon: typeof Wallet }[] = [
  { id: "budget", label: "Budget", icon: Wallet },
  { id: "food", label: "Food", icon: Utensils },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
  { id: "nearby", label: "Places", sub: "Nearby", icon: MapPin },
  { id: "vlogs", label: "Vlogs", icon: Film },
];
type TabId = "budget" | "food" | "shopping" | "nearby" | "vlogs";

export function MobileDetail({ place, gallery, nearby, favored, seededPoi }: Props) {
  const [tab, setTab] = useState<TabId>("budget");
  const [aboutOpen, setAboutOpen] = useState(false);

  const cat = CATEGORY_BY_SLUG[place.category as CategorySlug];
  const gradient = CATEGORY_GRADIENT[place.category as CategorySlug] ?? "from-slate-400 to-slate-600";
  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const tripCost = (place.budgetPerDay ?? 0) * (place.recommendedDays ?? 1);
  // One lookup, shared by the teaser counts and both tab lists.
  // Radius matches the seeded read on the server (5 km) so the teaser counts
  // and the lists agree with each other.
  const near = useNearbyAmenities(lat, lng, hasCoords, 5000, seededPoi);

  // Ticket tiers: the researched breakdown when a place has one, otherwise
  // assembled from the individual fee columns so a place with just an adult
  // and a child rate still shows both.
  const tickets = useMemo<{ label: string; price: number }[]>(() => {
    if (place.ticketOptions) {
      try {
        const parsed = JSON.parse(place.ticketOptions) as { label: string; price: number }[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* fall through to the columns */
      }
    }
    const rows: { label: string; price: number }[] = [];
    if (place.entryFees > 0) rows.push({ label: "Adults (Indian)", price: place.entryFees });
    if (place.entryFeesChild != null) rows.push({ label: "Children", price: place.entryFeesChild });
    if (place.entryFeesForeigner != null) rows.push({ label: "Foreign nationals", price: place.entryFeesForeigner });
    // A lone adult rate is already shown in the facts grid — no need to repeat it.
    return rows.length > 1 ? rows : [];
  }, [place.ticketOptions, place.entryFees, place.entryFeesChild, place.entryFeesForeigner]);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const data = { title: place.name, text: `${place.name} — on Saafera`, url };
    if (typeof navigator !== "undefined" && navigator.share && (navigator.canShare?.(data) ?? true)) {
      try {
        await navigator.share(data);
      } catch {
        /* dismissed */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="pb-4">
      {/* ── Hero ── */}
      <div className="relative h-[21rem] w-full overflow-hidden">
        <HeroPhoto
          images={gallery.map((g) => ({ url: g.url, caption: g.caption }))}
          fallbackImageUrl={place.imageUrl}
          alt={place.name}
          emoji={cat?.emoji ?? "📍"}
          gradient={gradient}
          preferWiki
          hint={[place.district, place.state].filter(Boolean).join(", ")}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/35" />

        {/* Floating actions — search, favourite and share ride on the photo,
            with the menu on the opposite corner (rendered by AppShell, which
            owns the sidebar). */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <Link
            href="/destinations"
            aria-label="Search places"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-700 shadow backdrop-blur active:scale-95"
          >
            <Search className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={share}
            aria-label={`Share ${place.name}`}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-700 shadow backdrop-blur active:scale-95"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <FavoriteButton destinationId={place.id} initialFavored={favored} size="md" />
        </div>

        {/* Title block — pointer-events-none so a tap reaches the photo and
            opens it full screen. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-700 backdrop-blur">
            {cat?.emoji} {cat?.label ?? place.category}
          </span>
          <h1 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-white drop-shadow">
            {place.name}
          </h1>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-white/90">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {[place.district, place.state].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      {/* ── Sheet ── */}
      <div className="relative -mt-4 rounded-t-3xl bg-[color:var(--app-bg)] px-4 pt-3">
        {/* Tabs */}
        {/* All five tabs share the row width. They used to be fixed at 68px
            each and horizontally scrollable, which came to ~388px — wider than
            a 360–375px phone, so Vlogs sat off-screen and looked missing
            unless you thought to swipe the row sideways. */}
        <div className="flex gap-1 pb-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                className={`flex min-w-0 flex-1 basis-0 flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] font-bold transition active:scale-95 ${
                  active ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? "text-emerald-600" : "text-slate-400"}`} />
                <span className="leading-none">{t.label}</span>
                {t.sub && <span className="text-[9px] font-semibold leading-none text-slate-400">{t.sub}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Budget ── */}
        {tab === "budget" && (
          <section>
            {/* The real, itemised budget — the same component the desktop
                layout uses, so both screens give the same answer. This tab
                used to show a gauge and a wide "₹450 – ₹900" range, which was
                a guess dressed up as a number: no vehicle, no party size, and
                no idea how far away the place actually is. */}
            <LiveBudget place={place} />

            <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50/70 p-3 text-[11px] leading-relaxed text-slate-600">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              Fuel is a return trip from your current location. Change the vehicle,
              party size or food allowance and every line updates.
            </p>

            {/* The mobile screen had no way to add a place to the trip cart at
                all — the action existed only on the desktop layout. */}
            <div className="mt-4 space-y-2">
              <AddToCartButton
                className="w-full py-3 shadow-lg shadow-emerald-500/40"
                label="Plan this trip"
                item={{
                  id: place.id,
                  name: place.name,
                  subtitle: [place.district, place.state].filter(Boolean).join(", "),
                  href: `/destinations/${place.slug}`,
                  kind: "destination",
                  emoji: cat?.emoji ?? "📍",
                }}
              />
              <Link
                href={`/budget-planner?destination=${place.slug}`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition active:scale-95"
              >
                Plan in budget planner
              </Link>
            </div>
          </section>
        )}

        {/* ── Food ── */}
        {tab === "food" && hasCoords && (
          <NearbyList
            places={near.food}
            origin={{ lat, lng }}
            kind="food"
            loading={near.loading}
            error={near.error}
            emptyLabel="No places to eat mapped within 5 km of here yet."
          />
        )}

        {/* ── Shopping ── */}
        {tab === "shopping" && hasCoords && (
          <NearbyList
            places={near.shopping}
            origin={{ lat, lng }}
            kind="shopping"
            loading={near.loading}
            error={near.error}
            emptyLabel="No shops or markets mapped within 5 km of here yet."
          />
        )}

        {(tab === "food" || tab === "shopping") && !hasCoords && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
            This place has no coordinates yet, so we can’t look around it.
          </div>
        )}

        {/* ── Places nearby ── */}
        {tab === "nearby" && (
          <div className="space-y-2">
            {nearby.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                Nothing else in the catalogue within 150 km.
              </div>
            ) : (
              nearby.map((n) => (
                <Link key={n.id} href={`/destinations/${n.slug}`} className="card card-hover flex items-center gap-3 p-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-lg">
                    {CATEGORY_BY_SLUG[n.category as CategorySlug]?.emoji ?? "📍"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{n.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {[n.district, n.state].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600">
                    <Navigation className="h-3 w-3" />
                    {formatKm(n.distanceKm)}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}

        {/* ── Vlogs ──
            Saafera stores no video of its own, so rather than showing an empty
            shelf these open a real search for this exact place on each
            platform. Honest about where the videos come from, and it works for
            every one of the ~10,000 places rather than the handful anyone
            would ever curate by hand. */}
        {tab === "vlogs" && (
          <div className="space-y-2">
            {[
              { label: "Watch on YouTube", sub: "Travel vlogs and walkthroughs", href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${place.name} ${place.district ?? place.state ?? ""} travel vlog`)}` },
              { label: "Watch Shorts", sub: "Quick clips of this place", href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${place.name} shorts`)}&sp=EgIYAQ%3D%3D` },
            ].map((v) => (
              <a key={v.label} href={v.href} target="_blank" rel="noopener noreferrer" className="card card-hover flex items-center gap-3 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
                  <Film className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{v.label}</span>
                  <span className="block truncate text-xs text-slate-500">{v.sub}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
              </a>
            ))}
          </div>
        )}

        {/* ── About (always shown, under the tab panel) ── */}
        <section className="card mt-3 p-4">
          <button
            type="button"
            onClick={() => setAboutOpen((v) => !v)}
            aria-expanded={aboutOpen}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <MapPin className="h-4 w-4" />
              </span>
              About {place.name}
            </span>
            <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition ${aboutOpen ? "rotate-90" : ""}`} />
          </button>
          <p className={`mt-2 whitespace-pre-line text-[13px] leading-relaxed text-slate-600 ${aboutOpen ? "" : "line-clamp-3"}`}>
            {place.description}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <Fact icon={<Calendar className="h-3.5 w-3.5" />} label="Recommended" value={formatDays(place.recommendedDays ?? 1)} />
            <Fact icon={<CalendarDays className="h-3.5 w-3.5" />} label="Best Time to Visit" value={formatBestMonths(place.bestMonths)} />
            <Fact icon={<Wallet className="h-3.5 w-3.5" />} label="Typical Cost (pp)" value={formatINR(tripCost)} />
            <Fact
              icon={<Ticket className="h-3.5 w-3.5" />}
              label="Entry Fee"
              value={place.entryFees > 0 ? formatINR(place.entryFees) : "Free"}
              note={place.entryFees > 0 ? "(Indian)" : undefined}
            />
          </div>

          {/* Full ticket breakdown when the place has one. A single "Entry Fee"
              figure is wrong for most monuments — they price adults, children
              and often foreigners differently, and a family planning a visit
              needs all of it, not the adult rate alone. */}
          {tickets.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Ticket className="h-3.5 w-3.5 text-emerald-600" /> Ticket pricing
              </p>
              <ul className="space-y-1">
                {tickets.map((t) => (
                  <li key={t.label} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-slate-600">{t.label}</span>
                    <span className="font-bold text-slate-900">
                      {t.price > 0 ? formatINR(t.price) : "Free"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {place.openingTimings && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <Clock className="h-3.5 w-3.5 text-emerald-600" /> {place.openingTimings}
            </p>
          )}
        </section>

        {/* Section teasers, on the default view only — the same two things the
            tabs open, surfaced so they're discoverable without knowing the tab
            row scrolls. Each is a pure teaser that fetches nothing; the real
            Overpass lookup still happens only once a section is opened. */}
        {tab === "budget" && hasCoords && (
          <div className="mt-4 space-y-4">
            <Teaser
              icon={<Utensils className="h-4 w-4" />}
              label="Food"
              tone="amber"
              title={`Food near ${place.name}`}
              body="Restaurants, cafes and local eats mapped around this place."
              count={near.loading ? null : near.food.length}
              onOpen={() => setTab("food")}
            />
            <Teaser
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Shopping"
              tone="violet"
              title={`Shopping near ${place.name}`}
              body="Malls and local markets mapped around this place."
              count={near.loading ? null : near.shopping.length}
              onOpen={() => setTab("shopping")}
            />
          </div>
        )}

        {place.bookingUrl ? (
          <a
            href={place.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm"
          >
            <Ticket className="h-4 w-4" /> Book Tickets <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <Link
            href="/budget-planner"
            className="btn-primary mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm"
          >
            <Wallet className="h-4 w-4" /> Plan a trip here
          </Link>
        )}
      </div>
    </div>
  );
}

// A section teaser. The figure it shows is the REAL count of places found
// around this spot, not a rating — OpenStreetMap has no ratings, so a star
// score here would be invented, and an invented number on a travel budget
// screen is worse than no number at all.
function Teaser({
  icon,
  label,
  tone,
  title,
  body,
  count,
  onOpen,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "amber" | "violet";
  title: string;
  body: string;
  count: number | null;
  onOpen: () => void;
}) {
  const tones = {
    amber: { head: "text-amber-700", chip: "bg-amber-100 text-amber-700", card: "bg-amber-50/60 border-amber-100" },
    violet: { head: "text-violet-700", chip: "bg-violet-100 text-violet-700", card: "bg-violet-50/60 border-violet-100" },
  }[tone];

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={`flex items-center gap-1.5 text-sm font-extrabold tracking-tight ${tones.head}`}>
          <span className={`grid h-6 w-6 place-items-center rounded-lg ${tones.chip}`}>{icon}</span>
          {label}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className={`flex items-center gap-0.5 text-xs font-bold ${tones.head} active:scale-95`}
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${tones.card}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{body}</span>
          <span className="mt-1.5 block text-[11px] font-bold text-slate-500">
            {count === null ? "Looking around…" : `${count} mapped within 5 km`}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    </section>
  );
}

// Half-circle gauge. Pure SVG with a stroke-dashoffset, so there is no chart
// library and nothing to hydrate.
function Fact({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <span className="text-emerald-600">{icon}</span>
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-extrabold text-slate-900">
        {value}
        {note && <span className="ml-1 text-[10px] font-medium text-slate-400">{note}</span>}
      </p>
    </div>
  );
}
