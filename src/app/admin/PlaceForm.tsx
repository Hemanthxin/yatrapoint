"use client";

import { useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, X, Upload, MapPin, ExternalLink } from "lucide-react";

import { addAdminPlace, updateAdminPlace } from "@/lib/actions/admin";

// Pull latitude/longitude out of a pasted Google Maps link OR a plain
// "lat, lng" string. Handles the common Google Maps URL shapes.
function parseCoords(input: string): { lat: number; lng: number } | null {
  const s = input.trim();
  const tryPair = (a?: string, b?: string) => {
    if (a == null || b == null) return null;
    const lat = Number(a);
    const lng = Number(b);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };
  // Plain "12.97, 77.59"
  let m = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return tryPair(m[1], m[2]);
  // .../@12.97,77.59,15z
  m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return tryPair(m[1], m[2]);
  // ...!3d12.97!4d77.59  (place URLs)
  m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return tryPair(m[1], m[2]);
  // ...?q=12.97,77.59  /  &query=12.97,77.59
  m = s.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return tryPair(m[1], m[2]);
  return null;
}

export type PlaceFormState = {
  name: string;
  state: string;
  district: string;
  category: string;
  placeType: string;
  description: string;
  shortDescription: string;
  openingTimings: string;
  entryFees: string;
  budgetPerDay: string;
  recommendedDays: string;
  bestMonths: string;
  latitude: string;
  longitude: string;
  popularity: string;
  isHidden: boolean;
};

const EMPTY: PlaceFormState = {
  name: "",
  state: "",
  district: "",
  category: "Attraction",
  placeType: "Sightseeing",
  description: "",
  shortDescription: "",
  openingTimings: "",
  entryFees: "0",
  budgetPerDay: "0",
  recommendedDays: "2",
  bestMonths: "",
  latitude: "",
  longitude: "",
  popularity: "50",
  isHidden: false,
};

interface PlaceFormProps {
  mode: "add" | "edit";
  placeId?: string;
  initial?: Partial<PlaceFormState>;
  initialPhoto?: string | null;
  /** When provided (edit), redirect here after saving. */
  redirectTo?: string;
}

export function PlaceForm({ mode, placeId, initial, initialPhoto, redirectTo }: PlaceFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PlaceFormState>({ ...EMPTY, ...initial });
  const [photo, setPhoto] = useState<string>(initialPhoto ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [mapLink, setMapLink] = useState("");
  const [mapLinkError, setMapLinkError] = useState<string | null>(null);

  function applyMapLink(value: string) {
    setMapLink(value);
    setMapLinkError(null);
    if (!value.trim()) return;
    const c = parseCoords(value);
    if (c) {
      update("latitude", String(c.lat));
      update("longitude", String(c.lng));
    } else {
      setMapLinkError("Couldn't read coordinates from that. Paste a Google Maps link or “lat, lng”.");
    }
  }

  const categories = useMemo(
    () => ["Attraction", "Temple", "Waterfall", "Beach", "Hill Station", "Museum", "Park", "Restaurant", "Adventure", "Heritage", "Lake", "Market", "Other"],
    []
  );
  const placeTypes = useMemo(
    () => ["Sightseeing", "Spiritual", "Nature", "Food", "Adventure", "Relaxation", "Family", "Weekend", "City View", "Historical", "Shopping", "Other"],
    []
  );

  function update<K extends keyof PlaceFormState>(key: K, value: PlaceFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a photo file.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return setPhoto(src);
        ctx.drawImage(img, 0, 0, width, height);
        setPhoto(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.onerror = () => setError("Could not read the image.");
      img.src = src;
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhoto("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!form.name.trim() || !form.state.trim() || !form.category.trim() || !form.description.trim()) {
      setError("Fill all required place details.");
      return;
    }
    if (!form.latitude || !form.longitude) {
      setError("Set the exact location on the map (search or drop the pin).");
      return;
    }

    startTransition(async () => {
      const payload = {
        ...form,
        imageUrl: photo,
        entryFees: Number(form.entryFees || 0),
        budgetPerDay: Number(form.budgetPerDay || 0),
        recommendedDays: Number(form.recommendedDays || 1),
        popularity: Number(form.popularity || 50),
      };
      const result =
        mode === "edit" && placeId
          ? await updateAdminPlace(placeId, payload)
          : await addAdminPlace(payload);

      if (!result.ok) {
        setError(result.error ?? "Could not save place.");
        return;
      }
      if (mode === "edit") {
        setDone("Saved");
        router.refresh();
        if (redirectTo) router.push(redirectTo);
      } else {
        setDone(result.slug ?? form.name);
        setForm({ ...EMPTY });
        setPhoto("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      }
    });
  }

  const isEdit = mode === "edit";

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{isEdit ? "Edit place" : "Add a new place"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the details and save your changes."
              : "Enter the full place details and it will be published immediately."}
          </p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40">
          {isEdit ? <Save className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Place name" required>
          <input value={form.name} onChange={(e) => update("name", e.target.value)} className="input" placeholder="Abbey Falls" />
        </Field>
        <Field label="State" required>
          <input value={form.state} onChange={(e) => update("state", e.target.value)} className="input" placeholder="Karnataka" />
        </Field>
        <Field label="District / Area">
          <input value={form.district} onChange={(e) => update("district", e.target.value)} className="input" placeholder="Kodagu" />
        </Field>
        <Field label="Category" required>
          <select value={form.category} onChange={(e) => update("category", e.target.value)} className="input">
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Place type" required>
          <select value={form.placeType} onChange={(e) => update("placeType", e.target.value)} className="input">
            {placeTypes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Opening timings">
          <input value={form.openingTimings} onChange={(e) => update("openingTimings", e.target.value)} className="input" placeholder="9:00 AM - 6:00 PM" />
        </Field>
        <Field label="Entry fees (₹)">
          <input value={form.entryFees} onChange={(e) => update("entryFees", e.target.value)} className="input" inputMode="numeric" placeholder="0" />
        </Field>
        <Field label="Budget per day (₹)">
          <input value={form.budgetPerDay} onChange={(e) => update("budgetPerDay", e.target.value)} className="input" inputMode="numeric" placeholder="2500" />
        </Field>
        <Field label="Recommended days">
          <input value={form.recommendedDays} onChange={(e) => update("recommendedDays", e.target.value)} className="input" inputMode="numeric" placeholder="2" />
        </Field>
        <Field label="Best months">
          <input value={form.bestMonths} onChange={(e) => update("bestMonths", e.target.value)} className="input" placeholder="June, July, August" />
        </Field>
        <Field label="Popularity (0-100)">
          <input value={form.popularity} onChange={(e) => update("popularity", e.target.value)} className="input" inputMode="numeric" placeholder="50" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Short description" required>
            <textarea value={form.shortDescription} onChange={(e) => update("shortDescription", e.target.value)} className="input min-h-24" placeholder="One line summary shown on cards." />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Description" required>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="input min-h-32" placeholder="Full description of the place." />
          </Field>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-1.5 text-sm font-medium text-slate-700">
          Exact location <span className="text-rose-500">*</span>
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Enter the coordinates directly, or open Google Maps, find the exact spot, then paste
          its link (or “lat, lng”) below — we&apos;ll fill the fields for you.
        </p>

        {/* Find on Google Maps */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            [form.name, form.district, form.state].filter(Boolean).join(", ") || "India"
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <MapPin className="h-4 w-4 text-emerald-600" /> Select on Google Maps
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </a>

        {/* Paste link / coords */}
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Paste Google Maps link or “lat, lng”
          </span>
          <input
            value={mapLink}
            onChange={(e) => applyMapLink(e.target.value)}
            placeholder="https://maps.google.com/…  or  12.9716, 77.5946"
            className="input"
          />
          {mapLinkError && <span className="mt-1 block text-xs text-rose-600">{mapLinkError}</span>}
        </label>

        {/* Manual lat / long */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Latitude</span>
            <input
              value={form.latitude}
              onChange={(e) => update("latitude", e.target.value)}
              inputMode="decimal"
              placeholder="12.9716"
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Longitude</span>
            <input
              value={form.longitude}
              onChange={(e) => update("longitude", e.target.value)}
              inputMode="decimal"
              placeholder="77.5946"
              className="input"
            />
          </label>
        </div>

        {form.latitude && form.longitude && (
          <a
            href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" /> Preview {form.latitude}, {form.longitude} on the map
          </a>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Photo</p>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            {photo ? (
              <div className="relative overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Preview" className="h-52 w-full object-cover" />
                <button type="button" onClick={clearPhoto} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex h-52 cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center">
                <Upload className="h-6 w-6 text-slate-400" />
                <span className="mt-2 text-sm font-medium text-slate-700">Upload place photo</span>
                <span className="mt-1 text-xs text-slate-400">JPG / PNG, resized automatically</span>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
            )}
          </div>
        </div>

        <label className="flex h-fit items-start gap-3 rounded-2xl border border-slate-200 p-4">
          <input type="checkbox" checked={form.isHidden} onChange={(e) => update("isHidden", e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Hidden place</span>
            <span className="mt-1 block text-xs text-slate-500">Keep this off the public catalogue if needed.</span>
          </span>
        </label>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {done && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {isEdit ? "Changes saved." : (<>Place added. Slug: <span className="font-semibold">{done}</span></>)}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="group relative mt-5 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 font-bold text-white shadow-lg shadow-indigo-600/40 transition hover:scale-[1.01] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {!isPending && <span aria-hidden className="sheen-overlay animate-sheen" />}
        <span className="relative inline-flex items-center gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Add place"}
        </span>
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.85rem 1rem;
          font-size: 0.95rem;
          color: rgb(15 23 42);
          outline: none;
          transition: border-color 0.15s ease;
        }
        .input:focus {
          border-color: rgb(129 140 248);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
        }
      `}</style>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
