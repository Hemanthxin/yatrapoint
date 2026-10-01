"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search, Plus, Check, Star } from "lucide-react";

import type { Destination } from "@/lib/db/schema";
import { suggestPlace, searchPlacesForGroupTrip, type PlaceSearchHit } from "@/lib/actions/group-trips";
import { showToast } from "@/lib/toast";

function fromDestination(d: Destination): PlaceSearchHit {
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    imageUrl: d.imageUrl,
    shortDescription: d.shortDescription,
    entryFeePerPerson: d.entryFees,
    googleRating: d.googleRating,
    district: d.district,
    state: d.state,
  };
}

export function AddPlacesTab({
  tripId,
  popularPlaces,
  suggestedPlaceIds,
  onChange,
}: {
  tripId: string;
  popularPlaces: Destination[];
  suggestedPlaceIds: string[];
  onChange: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set(suggestedPlaceIds));
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchPlacesForGroupTrip(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function add(place: PlaceSearchHit) {
    if (addedIds.has(place.id)) return;
    setPendingId(place.id);
    const res = await suggestPlace(tripId, place.id);
    setPendingId(null);
    if (!res.ok) {
      showToast(res.error ?? "Could not add that place", "⚠️");
      return;
    }
    setAddedIds((prev) => new Set(prev).add(place.id));
    showToast(`${place.name} added`, "📍");
    onChange();
  }

  const list = results ?? popularPlaces.map(fromDestination);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search places…"
          className="input pl-9"
        />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {results ? (searching ? "Searching…" : `${results.length} result(s)`) : "Popular places"}
      </p>

      <div className="space-y-2">
        {list.map((p) => {
          const added = addedIds.has(p.id);
          return (
            <div key={p.id} className="card flex items-center gap-3 p-3">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{p.name}</span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  {p.googleRating ? (
                    <>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {p.googleRating.toFixed(1)} ·{" "}
                    </>
                  ) : null}
                  {p.category}
                </span>
              </span>
              <button
                type="button"
                onClick={() => add(p)}
                disabled={added || pendingId === p.id}
                className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  added ? "bg-blue-100 text-blue-700" : "border border-blue-500 text-blue-700 hover:bg-blue-50"
                }`}
              >
                {added ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Added
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </>
                )}
              </button>
            </div>
          );
        })}
        {list.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No places found.</p>}
      </div>
    </div>
  );
}
