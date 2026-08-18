"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Clapperboard, MapPin, Loader2, Star, X, Send, BookOpen, Lightbulb, HelpCircle, Image as ImageIcon, CalendarDays } from "lucide-react";

import { submitCommunityPost } from "@/lib/actions/community";
import { Reveal } from "@/components/app/Reveal";
import { resizeImage, readAsDataUrl } from "@/lib/imageUpload";

interface MediaDraft {
  url: string;
  kind: "image" | "video";
}

const MAX_PHOTOS = 8;
const MAX_VIDEO_BYTES = 12_000_000;

const POST_TYPES = [
  { id: "story", label: "Trip Story", icon: BookOpen },
  { id: "tip", label: "Travel Tip", icon: Lightbulb },
  { id: "question", label: "Question", icon: HelpCircle },
  { id: "photo", label: "Photo", icon: ImageIcon },
  { id: "event", label: "Event", icon: CalendarDays },
] as const;

export function CommunityForm({
  onPosted,
  onCancel,
  communityId,
}: {
  onPosted?: () => void;
  onCancel?: () => void;
  communityId?: string;
} = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [postType, setPostType] = useState<(typeof POST_TYPES)[number]["id"]>("story");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [media, setMedia] = useState<MediaDraft[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setError(null);
    setMediaBusy(true);
    try {
      // Adding photos always replaces a video — a post is either a photo
      // carousel or a single video, matching how Instagram's composer works.
      const existingPhotos = media.filter((m) => m.kind === "image");
      const room = Math.max(0, MAX_PHOTOS - existingPhotos.length);
      const toAdd = files.slice(0, room);
      const resized = await Promise.all(toAdd.map(resizeImage));
      setMedia([...existingPhotos, ...resized.map((url) => ({ url, kind: "image" as const }))]);
      if (files.length > toAdd.length) setError(`Only added the first ${MAX_PHOTOS} photos.`);
    } catch {
      setError("Could not read one of those images.");
    } finally {
      setMediaBusy(false);
    }
  }

  async function onVideo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("video/")) {
      setError("Please choose a video.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError("Video is too large — keep clips under ~10 seconds.");
      return;
    }
    setError(null);
    setMediaBusy(true);
    try {
      const url = await readAsDataUrl(file);
      setMedia([{ url, kind: "video" }]);
    } catch {
      setError("Could not read that video.");
    } finally {
      setMediaBusy(false);
    }
  }

  function removeMediaAt(i: number) {
    setMedia((m) => m.filter((_, idx) => idx !== i));
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
        media,
        latitude: coords ? String(coords.lat) : undefined,
        longitude: coords ? String(coords.lng) : undefined,
        locationName: locationName || undefined,
        communityId,
        postType,
      });
      if (!res.ok) return setError(res.error || "Could not post.");
      setTitle("");
      setDescription("");
      setPostType("story");
      setRating(0);
      setMedia([]);
      setCoords(null);
      setLocationName("");
      if (fileRef.current) fileRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
      router.refresh();
      onPosted?.();
    });
  }

  return (
    <Reveal as="form" onSubmit={onSubmit} className="card p-5">
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

      {/* Media — up to 8 photos (swipeable) OR a single short video */}
      {media.length > 0 ? (
        <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {media.map((m, i) => (
            <div key={i} className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
              {m.kind === "video" ? (
                <video src={m.url} className="h-full w-full object-cover" muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={`preview ${i + 1}`} className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeMediaAt(i)}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {media[0]?.kind === "image" && media.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-32 w-32 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-emerald-400 hover:text-emerald-600"
            >
              <Camera className="h-6 w-6" />
            </button>
          )}
        </div>
      ) : (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={mediaBusy}
            className="flex h-32 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-500 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-600 disabled:opacity-60"
          >
            {mediaBusy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
            <span className="text-sm font-medium">Add photos</span>
          </button>
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            disabled={mediaBusy}
            className="flex h-32 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-500 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-600 disabled:opacity-60"
          >
            <Clapperboard className="h-7 w-7" />
            <span className="text-sm font-medium">Add a video</span>
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPhotos} className="hidden" />
      <input ref={videoRef} type="file" accept="video/*" onChange={onVideo} className="hidden" />

      {/* Content type */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {POST_TYPES.map((t) => {
          const Icon = t.icon;
          const active = postType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setPostType(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                active
                  ? "border-transparent bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

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
            className="btn-secondary min-h-[44px] px-5 py-3.5 text-sm disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary flex-1 rounded-xl px-6 py-3.5 text-sm active:scale-95 disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Post
        </button>
      </div>
    </Reveal>
  );
}
