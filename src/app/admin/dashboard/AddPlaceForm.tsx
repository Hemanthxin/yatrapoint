"use client";

import { useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X, Upload, MapPin, Clock3, IndianRupee, Star } from "lucide-react";

import { addAdminPlace } from "@/lib/actions/admin";

type FormState = {
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

const initialState: FormState = {
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

export function AddPlaceForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(initialState);
  const [photo, setPhoto] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const categories = useMemo(
    () => [
      "Attraction",
      "Temple",
      "Waterfall",
      "Beach",
      "Hill Station",
      "Museum",
      "Park",
      "Restaurant",
      "Adventure",
      "Heritage",
      "Other",
    ],
    []
  );

  const placeTypes = useMemo(
    () => [
      "Sightseeing",
      "Spiritual",
      "Nature",
      "Food",
      "Adventure",
      "Relaxation",
      "Family",
      "Weekend",
      "City View",
      "Historical",
      "Other",
    ],
    []
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
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
        if (!ctx) {
          setPhoto(src);
          return;
        }
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    if (!form.name.trim() || !form.state.trim() || !form.category.trim() || !form.description.trim()) {
      setError("Fill all required place details.");
      return;
    }

    startTransition(async () => {
      const result = await addAdminPlace({
      ...form,
      imageUrl: photo,

      entryFees: Number(form.entryFees || 0),
      budgetPerDay: Number(form.budgetPerDay || 0),
      recommendedDays: Number(form.recommendedDays || 1),
      popularity: Number(form.popularity || 50),
      });

      if (!result.ok) {
        setError(result.error ?? "Could not add place.");
        return;
      }

      setDone(result.slug ?? form.name);
      setForm(initialState);
      setPhoto("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Add a new place</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter the full place details and it will be published to the database immediately.
          </p>
        </div>
        <div className="rounded-full bg-sky-50 p-2 text-sky-700">
          <Plus className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Place name" required>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="input"
            placeholder="Abbey Falls"
          />
        </Field>
        <Field label="State" required>
          <input
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
            className="input"
            placeholder="Karnataka"
          />
        </Field>
        <Field label="District / Area">
          <input
            value={form.district}
            onChange={(e) => update("district", e.target.value)}
            className="input"
            placeholder="Kodagu"
          />
        </Field>
        <Field label="Category" required>
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="input"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Place type" required>
          <select
            value={form.placeType}
            onChange={(e) => update("placeType", e.target.value)}
            className="input"
          >
            {placeTypes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Opening timings">
          <input
            value={form.openingTimings}
            onChange={(e) => update("openingTimings", e.target.value)}
            className="input"
            placeholder="9:00 AM - 6:00 PM"
          />
        </Field>
        <Field label="Entry fees (₹)">
          <input
            value={form.entryFees}
            onChange={(e) => update("entryFees", e.target.value)}
            className="input"
            inputMode="numeric"
            placeholder="0"
          />
        </Field>
        <Field label="Budget per day (₹)">
          <input
            value={form.budgetPerDay}
            onChange={(e) => update("budgetPerDay", e.target.value)}
            className="input"
            inputMode="numeric"
            placeholder="2500"
          />
        </Field>
        <Field label="Recommended days">
          <input
            value={form.recommendedDays}
            onChange={(e) => update("recommendedDays", e.target.value)}
            className="input"
            inputMode="numeric"
            placeholder="2"
          />
        </Field>
        <Field label="Best months">
          <input
            value={form.bestMonths}
            onChange={(e) => update("bestMonths", e.target.value)}
            className="input"
            placeholder="June, July, August"
          />
        </Field>
        <Field label="Latitude">
          <input
            value={form.latitude}
            onChange={(e) => update("latitude", e.target.value)}
            className="input"
            placeholder="12.9716"
          />
        </Field>
        <Field label="Longitude">
          <input
            value={form.longitude}
            onChange={(e) => update("longitude", e.target.value)}
            className="input"
            placeholder="77.5946"
          />
        </Field>
        <Field label="Popularity (0-100)">
          <input
            value={form.popularity}
            onChange={(e) => update("popularity", e.target.value)}
            className="input"
            inputMode="numeric"
            placeholder="50"
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Short description" required>
            <textarea
              value={form.shortDescription}
              onChange={(e) => update("shortDescription", e.target.value)}
              className="input min-h-24"
              placeholder="One line summary that appears on cards."
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Description" required>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="input min-h-32"
              placeholder="Full description of the place."
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Photo</p>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            {photo ? (
              <div className="relative overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Preview" className="h-52 w-full object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
                >
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

        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <input
              type="checkbox"
              checked={form.isHidden}
              onChange={(e) => update("isHidden", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Hidden place</span>
              <span className="mt-1 block text-xs text-slate-500">
                Keep this unpublished inside the public catalogue if needed.
              </span>
            </span>
          </label>

          <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Tips</p>
            <ul className="mt-2 space-y-1.5">
              <li>• Short description should fit card previews.</li>
              <li>• Use precise coordinates for map display.</li>
              <li>• Photo is stored immediately as an image URL.</li>
            </ul>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {done && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Place added successfully. Slug: <span className="font-semibold">{done}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {isPending ? "Adding place..." : "Add place"}
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
          border-color: rgb(14 165 233);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
