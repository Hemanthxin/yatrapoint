"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, Loader2, CheckCircle2, X } from "lucide-react";

import { submitCommunityPost } from "@/lib/actions/community";

export function CommunityForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    // Resize + re-encode in the browser so the upload stays small (~100–300 KB)
    // regardless of the original photo size.
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
        setPhoto(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => setError("Could not read that image — try another.");
      img.src = src;
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function addLiveLocation() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Could not get your location — allow location access and retry.");
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
        photoUrl: photo || undefined,
        latitude: coords ? String(coords.lat) : undefined,
        longitude: coords ? String(coords.lng) : undefined,
        locationName: locationName || undefined,
      });
      if (!res.ok) {
        setError(res.error || "Could not submit.");
        return;
      }
      setDone(true);
      setTitle("");
      setDescription("");
      setPhoto("");
      setCoords(null);
      setLocationName("");
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-2 font-semibold text-slate-900">Submitted for verification</p>
        <p className="mt-1 text-sm text-slate-600">
          Thanks! An admin will review your hidden place before it&apos;s published to the community.
        </p>
        <button
          onClick={() => setDone(false)}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Share another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-900">Share a hidden place</h2>

      {/* Photo */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Photo</p>
        {photo ? (
          <div className="relative h-40 w-full overflow-hidden rounded-xl">
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
            className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600"
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm">Upload a photo</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
      </div>

      {/* Title */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Secret waterfall near Coorg"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
        />
      </label>

      {/* Live location */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Location</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addLiveLocation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {coords ? "Location added" : "Add live location"}
          </button>
          {coords && (
            <span className="text-xs text-slate-500">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          )}
        </div>
        <input
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="Place / area name (optional)"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {/* Description */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="What makes this place special? How to get there?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Submit for verification
      </button>
    </form>
  );
}
