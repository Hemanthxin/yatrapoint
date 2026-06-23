"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, Loader2, Star, X, Send } from "lucide-react";

import { submitCommunityPost } from "@/lib/actions/community";

export function CommunityForm() {
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
    });
  }

  return (
    <form onSubmit={onSubmit} className="card-hover rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Create a post</h2>
      <p className="mb-3 text-xs text-slate-500">Share a place — photo, review &amp; rating. Goes live instantly.</p>

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
          className="mb-3 flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-emerald-400 hover:text-emerald-600"
        >
          <Camera className="h-6 w-6" />
          <span className="text-sm">Add a photo</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />

      {/* Place name */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Place name (e.g. Abbey Falls, Coorg)"
        className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
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
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Write your review… what's special about this place?"
        className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
      />

      {/* Location */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addLiveLocation}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {coords ? "Location added" : "Add location"}
        </button>
        <input
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="Area / city (optional)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Post
      </button>
    </form>
  );
}
