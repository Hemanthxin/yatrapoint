"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Upload, Loader2, RotateCcw, Check } from "lucide-react";

import { updateHeroBannerImage, resetHeroBannerImage } from "@/lib/actions/site-settings";

const DEFAULT_HERO_SRC = "/66242.jpg";

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1920;
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
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Could not read that image."));
      img.src = src;
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

// Admin control for the dashboard's featured hero banner (the "Explore
// Karnataka, Create Memories" image). Uploads render at FULL opacity on the
// live dashboard — no dimming overlay on the photo itself, only a light
// gradient behind the text so it stays readable.
export function HeroBannerManager({ initialImageUrl }: { initialImageUrl: string | null }) {
  const router = useRouter();
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
      const res = await updateHeroBannerImage(dataUrl);
      if (res.ok) {
        setImageUrl(dataUrl);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2200);
      } else {
        setError(res.error || "Could not save the banner image.");
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
    const res = await resetHeroBannerImage();
    if (res.ok) {
      setImageUrl(null);
      router.refresh();
    } else {
      setError("Could not reset the banner image.");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
          <ImageIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-extrabold tracking-tight text-slate-900">Dashboard hero banner</h2>
          <p className="text-xs text-slate-500">The featured image travellers see at the top of their dashboard.</p>
        </div>
      </div>

      <div className="relative mt-3 h-36 w-full overflow-hidden rounded-2xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl ?? DEFAULT_HERO_SRC} alt="Hero banner preview" className="h-full w-full object-cover" />
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
        {!imageUrl && (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-bold text-white">
            Default image
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <label className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
          <Upload className="h-4 w-4" /> {imageUrl ? "Replace banner" : "Upload banner"}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
        {imageUrl && (
          <button
            onClick={reset}
            disabled={busy}
            title="Reset to the default image"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
