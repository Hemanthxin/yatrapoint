"use client";

import { useState, type ChangeEvent } from "react";
import { Upload, Loader2, Check, RotateCcw } from "lucide-react";
import type { Festival } from "@/lib/festivals";
import { festivalSlug } from "@/lib/festivals";
import { updateFestivalImage, resetFestivalImage } from "@/lib/actions/festival-images";
import { resizeImageToDataUrl } from "@/lib/image-resize";

const resizeToDataUrl = (file: File) => resizeImageToDataUrl(file, { maxDim: 1280, quality: 0.8 });

export function FestivalImagesManager({
  festivals,
  initialImages,
}: {
  festivals: Festival[];
  initialImages: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {festivals.map((f) => (
        <Row key={f.name} festival={f} initialImageUrl={initialImages[festivalSlug(f.name)] ?? null} />
      ))}
    </div>
  );
}

function Row({ festival, initialImageUrl }: { festival: Festival; initialImageUrl: string | null }) {
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
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
      const res = await updateFestivalImage(festival.name, dataUrl);
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

  async function reset() {
    setBusy(true);
    setError(null);
    const res = await resetFestivalImage(festival.name);
    if (res.ok) setImageUrl(null);
    else setError("Could not reset the photo.");
    setBusy(false);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-36 w-full bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={festival.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-5xl">{festival.emoji}</div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        )}
        {saved && !busy && (
          <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white">
            <Check className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold text-slate-900">{festival.name}</p>
        {festival.hub && <p className="truncate text-xs text-slate-500">{festival.hub}</p>}
        <div className="mt-2.5 flex gap-2">
          <label className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
            <Upload className="h-3.5 w-3.5" /> {imageUrl ? "Replace photo" : "Upload photo"}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          </label>
          {imageUrl && (
            <button
              onClick={reset}
              disabled={busy}
              title="Reset to the emoji"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
