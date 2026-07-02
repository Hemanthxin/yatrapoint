"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, Loader2, Star, X, Send } from "lucide-react";

import { submitCommunityPost } from "@/lib/actions/community";

export function CommunityForm({
  onPosted,
  onCancel,
}: {
  onPosted?: () => void;
  onCancel?: () => void;
} = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [photo, setPhoto] = useState<string>("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image.");
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
        setPhoto(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = () => setError("Could not read that image.");
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function addLiveLocation() {
    if (!("geolocation" in navigator)) return setError("Geolocation not available.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Could not get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitCommunityPost({
        title,
        description,
        rating: rating || undefined,
        photoUrl: photo || undefined,
        latitude: coords ? String(coords.lat) : undefined,
        longitude: coords ? String(coords.lng) : undefined,
        locationName: locationName || undefined,
      });
      if (!res.ok) return setError(res.error || "Could not post.");
      setTitle("");
      setDescription("");
      setRating(0);
      setPhoto("");
      setCoords(null);
      setLocationName("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
      onPosted?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="animate-fadeUp rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            <span className="text-gradient">Create a post</span>
          </h2>
          <p className="mb-3 text-xs font-medium text-slate-500">Share a place — photo, review &amp; rating. Goes live instantly.</p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close composer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Photo */}
      {photo ? (
        <div className="relative mb-3 h-44 w-full overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => setPhoto("")}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mb-3 flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-500 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-600"
        >
          <Camera className="h-7 w-7" />
          <span className="text-sm font-medium">Add a photo</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />

      {/* Place name */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 80))}
        placeholder="Place name (e.g. Abbey Falls, Coorg)"
        className="mb-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
      />

      {/* Rating */}
      <div className="mb-3 flex items-center gap-1">
        <span className="mr-2 text-xs font-medium uppercase tracking-wide text-slate-500">Rating</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} star`}
          >
            <Star
              className={`h-6 w-6 transition ${
                (hoverRating || rating) >= n ? "fill-amber-400 text-amber-400" : "text-slate-300"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Review */}
      <div className="relative mb-3">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="Write your review… what's special about this place?"
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pb-6 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        />
        <span
          className={`pointer-events-none absolute bottom-2 right-3 text-[11px] font-medium ${
            description.length >= 1000 ? "text-rose-500" : "text-slate-400"
          }`}
        >
          {description.length}/1000
        </span>
      </div>

      {/* Location */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addLiveLocation}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
            coords
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {coords ? "Location added" : "Add location"}
        </button>
        <input
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="Area / city (optional)"
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <span aria-hidden className="sheen-overlay animate-sheen" />
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Post
        </button>
      </div>
    </form>
  );
}
