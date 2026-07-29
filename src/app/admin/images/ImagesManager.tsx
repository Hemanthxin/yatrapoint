"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Search, Upload, Loader2, Check, ImageOff } from "lucide-react";
import type { AdminImageRow, ImageSource } from "@/lib/queries/admin-images";
import { searchPlaceImages, updatePlaceImage } from "@/lib/actions/admin-images";

const SOURCE_LABEL: Record<ImageSource, string> = {
  destination: "Destination",
  nearby: "One-day trip",
  city: "City place",
};
const SOURCE_CHIP: Record<ImageSource, string> = {
  destination: "bg-indigo-50 text-indigo-700",
  nearby: "bg-amber-50 text-amber-700",
  city: "bg-teal-50 text-teal-700",
};

const DEBOUNCE_MS = 350;

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
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
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = src;
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export function ImagesManager({ initialMissing }: { initialMissing: AdminImageRow[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminImageRow[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      searchPlaceImages(q)
        .then(setResults)
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const showing = results ?? initialMissing;
  const isSearchMode = results !== null;

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place by name…"
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {!isSearchMode && (
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Popular places still missing a photo
        </p>
      )}

      {searching ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      ) : showing.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {isSearchMode ? "No places match that search." : "Nothing missing a photo right now — nice."}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {showing.map((row) => (
            <Row key={`${row.source}:${row.id}`} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ row }: { row: AdminImageRow }) {
  const [imageUrl, setImageUrl] = useState(row.imageUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setBusy(true);
    setSaved(false);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const res = await updatePlaceImage(row.source, row.id, dataUrl);
      if (res.ok) {
        setImageUrl(dataUrl);
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
      } else {
        setError(res.error || "Could not save the photo.");
      }
    } catch {
      setError("Could not read that image.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-36 w-full bg-slate-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={row.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-slate-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${SOURCE_CHIP[row.source]}`}>
          {SOURCE_LABEL[row.source]}
        </span>
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        )}
        {saved && !busy && (
          <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white">
            <Check className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
        {row.area && <p className="truncate text-xs text-slate-500">{row.area}</p>}
        <label className="mt-2.5 flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
          <Upload className="h-3.5 w-3.5" /> {imageUrl ? "Replace photo" : "Upload photo"}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
        {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
