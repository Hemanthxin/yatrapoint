"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Search, Upload, Loader2, Check, ImageOff, Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import type { AdminImageRow, ImageSource } from "@/lib/queries/admin-images";
import { searchPlaceImages, updatePlaceImage } from "@/lib/actions/admin-images";
import {
  addPlaceGalleryImage,
  deletePlaceGalleryImage,
  updatePlaceGalleryCaption,
  swapPlaceGalleryPosition,
  fetchPlaceGalleriesBatch,
} from "@/lib/actions/admin-place-gallery";
import type { GalleryImage } from "@/lib/queries/place-gallery";
import { MAX_GALLERY_IMAGES } from "@/lib/gallery-constants";
import { resizeImageToDataUrl } from "@/lib/image-resize";

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

const resizeToDataUrl = (file: File) => resizeImageToDataUrl(file, { maxDim: 1280, quality: 0.78 });
// Gallery photos get a tighter budget than the single hero photo — a place
// can have up to 4 of them, so each needs to stay small or the total cost
// balloons to roughly 4x a single photo's.
const resizeGalleryToDataUrl = (file: File) => resizeImageToDataUrl(file, { maxDim: 800, quality: 0.62 });

export function ImagesManager({
  initialMissing,
  initialGalleries,
}: {
  initialMissing: AdminImageRow[];
  initialGalleries: Record<string, GalleryImage[]>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminImageRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [galleries, setGalleries] = useState(initialGalleries);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      searchPlaceImages(q)
        .then((rows) => {
          setResults(rows);
          return fetchPlaceGalleriesBatch(rows.map((r) => ({ id: r.id, source: r.source })));
        })
        .then((fetched) => setGalleries((prev) => ({ ...prev, ...fetched })))
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
          {showing.map((row) => {
            const key = `${row.source}:${row.id}`;
            return (
              <Row
                key={key}
                row={row}
                gallery={galleries[key] ?? []}
                onGalleryChange={(images) => setGalleries((prev) => ({ ...prev, [key]: images }))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({
  row,
  gallery,
  onGalleryChange,
}: {
  row: AdminImageRow;
  gallery: GalleryImage[];
  onGalleryChange: (images: GalleryImage[]) => void;
}) {
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

        <Gallery row={row} gallery={gallery} onGalleryChange={onGalleryChange} />
      </div>
    </div>
  );
}

// Trip-plan stop-card gallery — up to 4 photos with captions, shown on the
// budget planner. Separate from the single hero photo above (still used
// site-wide on detail pages / listing cards).
function Gallery({
  row,
  gallery,
  onGalleryChange,
}: {
  row: AdminImageRow;
  gallery: GalleryImage[];
  onGalleryChange: (images: GalleryImage[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await resizeGalleryToDataUrl(file);
      const res = await addPlaceGalleryImage(row.source, row.id, dataUrl, null);
      if (res.ok && res.images) onGalleryChange(res.images);
      else setError(res.error || "Could not save the photo.");
    } catch {
      setError("Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(imageId: string) {
    setBusy(true);
    const res = await deletePlaceGalleryImage(imageId);
    if (res.ok && res.images) onGalleryChange(res.images);
    else setError(res.error || "Could not delete the photo.");
    setBusy(false);
  }

  async function onCaptionBlur(imageId: string, caption: string) {
    const res = await updatePlaceGalleryCaption(imageId, caption);
    if (res.ok && res.images) onGalleryChange(res.images);
  }

  async function onMove(imageId: string, dir: -1 | 1) {
    const idx = gallery.findIndex((g) => g.id === imageId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= gallery.length) return;
    setBusy(true);
    const res = await swapPlaceGalleryPosition(gallery[idx].id, gallery[swapIdx].id);
    if (res.ok && res.images) onGalleryChange(res.images);
    setBusy(false);
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Gallery ({gallery.length}/{MAX_GALLERY_IMAGES}) — shown on trip-plan stop cards
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {gallery.map((img, idx) => (
          <div key={img.id} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="relative h-16 w-full bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption || row.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onDelete(img.id)}
                disabled={busy}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white hover:bg-rose-600"
                aria-label="Delete photo"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-1 right-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => onMove(img.id, -1)}
                  disabled={busy || idx === 0}
                  className="grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  aria-label="Move earlier"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(img.id, 1)}
                  disabled={busy || idx === gallery.length - 1}
                  className="grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white disabled:opacity-30"
                  aria-label="Move later"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            </div>
            <input
              defaultValue={img.caption ?? ""}
              onBlur={(e) => onCaptionBlur(img.id, e.target.value)}
              placeholder="Caption…"
              maxLength={140}
              disabled={busy}
              className="w-full border-0 border-t border-slate-100 px-2 py-1 text-[11px] outline-none focus:bg-slate-50"
            />
          </div>
        ))}
        {gallery.length < MAX_GALLERY_IMAGES && (
          <label className="flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-slate-400 transition hover:border-indigo-300 hover:text-indigo-500">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="text-[10px] font-semibold">Add photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={onAdd} disabled={busy} />
          </label>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
