"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Loader2, ExternalLink, MapPin } from "lucide-react";

import { geocodePlace, type GeocodeHit } from "@/lib/actions/geo";

const INDIA = { lat: 20.5937, lng: 78.9629 };

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:26px;height:26px;border-radius:50% 50% 50% 0;
      background:#d97706;border:3px solid white;transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

interface LocationPickerProps {
  lat?: number | null;
  lng?: number | null;
  onChange: (lat: number, lng: number) => void;
  /** Pre-fills the search box (e.g. the place name being added). */
  defaultQuery?: string;
}

export function LocationPicker({ lat, lng, onChange, defaultQuery = "" }: LocationPickerProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Set/move the marker WITHOUT notifying the parent (used for external sync).
  function setMarkerSilent(la: number, ln: number) {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([la, ln], { draggable: true, icon: pinIcon() }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        onChange(round(p.lat), round(p.lng));
      });
    } else {
      markerRef.current.setLatLng([la, ln]);
    }
  }

  // User picked a point — move marker AND report it up.
  function pick(la: number, ln: number, fly = false) {
    setMarkerSilent(la, ln);
    if (fly && mapRef.current) mapRef.current.setView([la, ln], Math.max(mapRef.current.getZoom(), 14));
    onChange(round(la), round(ln));
  }

  // Init the map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const hasStart = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
    const start = hasStart ? { lat: lat as number, lng: lng as number } : INDIA;
    const map = L.map(elRef.current, { scrollWheelZoom: true }).setView(
      [start.lat, start.lng],
      hasStart ? 14 : 5
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    if (hasStart) setMarkerSilent(start.lat, start.lng);
    map.on("click", (e: L.LeafletMouseEvent) => pick(e.latlng.lat, e.latlng.lng));
    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync when lat/lng are edited elsewhere (manual inputs).
  useEffect(() => {
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return;
    const m = markerRef.current;
    if (!m || Math.abs(m.getLatLng().lat - lat) > 1e-6 || Math.abs(m.getLatLng().lng - lng) > 1e-6) {
      setMarkerSilent(lat, lng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setNote(null);
    setResults([]);
    if (query.trim().length < 3) {
      setNote("Type at least 3 characters.");
      return;
    }
    setSearching(true);
    try {
      const hits = await geocodePlace(query);
      if (hits.length === 0) {
        setNote("No match — drop the pin manually on the map.");
        return;
      }
      setResults(hits);
      pick(hits[0].lat, hits[0].lng, true);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place to locate it (e.g. Abbey Falls, Madikeri)"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-amber-500"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Find
        </button>
      </form>

      {results.length > 1 && (
        <div className="max-h-32 overflow-auto rounded-xl border border-slate-200 bg-white text-sm">
          {results.map((r, i) => (
            <button
              key={`${r.lat}-${r.lng}-${i}`}
              type="button"
              onClick={() => pick(r.lat, r.lng, true)}
              className="block w-full truncate px-3 py-2 text-left hover:bg-slate-50"
            >
              <MapPin className="mr-1 inline h-3 w-3 text-amber-600" />
              {r.label}
            </button>
          ))}
        </div>
      )}

      <div ref={elRef} className="h-72 w-full overflow-hidden rounded-2xl border border-slate-200" />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) ? (
            <>
              Selected: <span className="font-semibold text-slate-700">{round(lat)}, {round(lng)}</span>
            </>
          ) : (
            "Search, or click/drag the pin to set the exact location."
          )}
        </span>
        {lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline"
          >
            Verify on Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {note && <p className="text-xs text-amber-700">{note}</p>}
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
