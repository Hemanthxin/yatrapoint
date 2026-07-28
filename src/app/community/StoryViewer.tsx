"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Heart, MapPin } from "lucide-react";
import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { setReaction } from "@/lib/actions/community";

const SLIDE_MS = 5000;

interface Author {
  userId: string;
  name: string;
  image: string | null;
  posts: CommunityPost[];
}

export function StoryViewer({
  author,
  social,
  onClose,
}: {
  author: Author;
  social: Record<string, PostSocial>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [burst, setBurst] = useState(false);
  const [loved, setLoved] = useState<Record<string, boolean>>({});
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => setMounted(true), []);

  const post = author.posts[index];

  useEffect(() => {
    setProgress(0);
    if (paused) return;
    startRef.current = Date.now();
    function tick() {
      const pct = Math.min(1, (Date.now() - startRef.current) / SLIDE_MS);
      setProgress(pct);
      if (pct >= 1) {
        advance(1);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") advance(1);
      if (e.key === "ArrowLeft") advance(-1);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advance(dir: 1 | -1) {
    setIndex((i) => {
      const next = i + dir;
      if (next < 0) return 0;
      if (next >= author.posts.length) {
        onClose();
        return i;
      }
      return next;
    });
  }

  function onLove() {
    if (loved[post.id]) return;
    setLoved((l) => ({ ...l, [post.id]: true }));
    setBurst(true);
    setTimeout(() => setBurst(false), 700);
    setReaction(post.id, "love").catch(() => {});
  }

  if (!mounted) return null;

  const s = social[post.id];
  const loveCount = (s?.counts.love ?? 0) + (loved[post.id] ? 1 : 0);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black">
      {/* Progress bars */}
      <div className="absolute inset-x-3 top-3 z-10 flex gap-1.5">
        {author.posts.map((p, i) => (
          <div key={p.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white"
              style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute inset-x-3 top-8 z-10 flex items-center gap-2.5">
        {author.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.image} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/50" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white ring-2 ring-white/50">
            {author.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-sm font-bold text-white drop-shadow">{author.name}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-white/10 active:scale-90"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Tap zones + media */}
      <div
        className="relative flex h-full w-full max-w-md items-center justify-center select-none"
        onDoubleClick={onLove}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <button
          type="button"
          aria-label="Previous"
          onClick={() => advance(-1)}
          className="absolute inset-y-0 left-0 z-10 w-1/3"
        />
        <button
          type="button"
          aria-label="Next"
          onClick={() => advance(1)}
          className="absolute inset-y-0 right-0 z-10 w-1/3"
        />

        {post.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.photoUrl} alt={post.title} className="max-h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-emerald-700 p-8 text-center">
            <span className="text-2xl font-extrabold text-white">{post.title}</span>
          </div>
        )}

        {burst && (
          <span className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
            <Heart className="h-24 w-24 animate-ping fill-white text-white drop-shadow-lg" />
          </span>
        )}
      </div>

      {/* Caption footer */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-10">
        <p className="text-sm font-bold text-white">{post.title}</p>
        {post.locationName && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-white/75">
            <MapPin className="h-3 w-3" /> {post.locationName}
          </p>
        )}
        <p className="mt-1 line-clamp-2 text-xs text-white/85">{post.description}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onLove}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur transition active:scale-90"
            aria-label="Love"
          >
            <Heart className={`h-5 w-5 ${loved[post.id] ? "fill-rose-500 text-rose-500" : "text-white"}`} />
          </button>
          {loveCount > 0 && <span className="text-xs font-semibold text-white/90">{loveCount}</span>}
        </div>
      </div>
    </div>,
    document.body
  );
}
