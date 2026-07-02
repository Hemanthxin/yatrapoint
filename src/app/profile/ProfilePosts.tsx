"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Star,
  MapPin,
  X,
  Trash2,
  Loader2,
  ImagePlus,
} from "lucide-react";
import type { CommunityPost } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { deleteCommunityPost } from "@/lib/actions/community";

interface ProfilePostsProps {
  posts: CommunityPost[];
  social: Record<string, PostSocial>;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProfilePosts({ posts, social }: ProfilePostsProps) {
  const router = useRouter();
  const [items, setItems] = useState<CommunityPost[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Keep local state in sync if server data changes after a refresh.
  useEffect(() => {
    setItems(posts);
  }, [posts]);

  const active = items.find((p) => p.id === activeId) ?? null;

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setActiveId(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-3xl">📸</p>
        <p className="mt-2 text-sm text-slate-500">
          You haven&apos;t shared any places yet.
        </p>
        <Link
          href="/community"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
        >
          <ImagePlus className="h-4 w-4" />
          Share your first place
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {items.map((post) => {
          const s = social[post.id];
          const love = s?.counts.love ?? 0;
          const comments = s?.comments ?? 0;
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => setActiveId(post.id)}
              className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-slate-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
            >
              {post.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.photoUrl}
                  alt={post.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-emerald-50 p-2 text-center">
                  <span className="line-clamp-3 text-xs font-semibold text-emerald-700">
                    {post.title}
                  </span>
                </div>
              )}
              {/* Hover/tap overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/40 text-sm font-bold text-white opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="h-4 w-4 fill-white" /> {love}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4 fill-white" /> {comments}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <PostModal
          post={active}
          social={social[active.id]}
          onClose={() => setActiveId(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}

function PostModal({
  post,
  social,
  onClose,
  onDeleted,
}: {
  post: CommunityPost;
  social?: PostSocial;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCommunityPost(post.id);
      if (!res.ok) {
        setError(res.error || "Could not delete this post.");
        return;
      }
      onDeleted(post.id);
    });
  }

  const love = social?.counts.love ?? 0;
  const comments = social?.comments ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeUp"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto">
          {post.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.photoUrl}
              alt={post.title}
              className="max-h-[55vh] w-full bg-slate-900 object-contain"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-emerald-50 p-6 text-center">
              <span className="text-xl font-semibold text-emerald-700">
                {post.title}
              </span>
            </div>
          )}

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-slate-900">
                {post.title}
              </h3>
              {post.rating ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-bold text-amber-700">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {post.rating}
                </span>
              ) : null}
            </div>

            {post.locationName && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 text-emerald-600" />
                {post.locationName}
              </p>
            )}

            {post.description && (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {post.description}
              </p>
            )}

            <div className="mt-4 flex items-center gap-4 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-rose-500" /> {love}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> {comments}
              </span>
              <span className="ml-auto text-xs font-normal text-slate-400">
                {formatDate(post.createdAt)}
              </span>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isPending ? "Deleting…" : "Delete post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
