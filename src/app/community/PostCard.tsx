"use client";

import { useEffect, useState, useTransition } from "react";
import {
  MapPin,
  MessageCircle,
  Share2,
  Check,
  Loader2,
  Send,
  Star,
  Heart,
  Bookmark,
} from "lucide-react";

import type { CommunityPost, CommunityComment } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { setReaction, addComment, fetchComments } from "@/lib/actions/community";

// The two travel-specific reactions shown beyond the primary ❤️ "love" — this
// is what makes our feed more than a like button: people mark intent + history.
const TRAVEL_REACTIONS = [
  { type: "wantToGo", emoji: "🎒", label: "Want to go" },
  { type: "beenThere", emoji: "✅", label: "Been there" },
] as const;

const SAVED_KEY = "yatra-point/saved-posts";

function timeAgo(date: Date | string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function PostCard({
  post,
  social,
  userName,
  userImage,
  index,
}: {
  post: CommunityPost;
  social: PostSocial;
  userName: string;
  userImage?: string | null;
  index: number;
}) {
  const [counts, setCounts] = useState(social.counts);
  const [mine, setMine] = useState<string | null>(social.mine);
  const [total, setTotal] = useState(social.total);

  const [commentCount, setCommentCount] = useState(social.comments);
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState("");
  const [posting, startPosting] = useTransition();
  const [, startReact] = useTransition();
  const [copied, setCopied] = useState(false);

  // Instagram touches: double-tap-to-like burst + locally-saved bookmark.
  const [burst, setBurst] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      if (Array.isArray(ids)) setSaved(ids.includes(post.id));
    } catch {
      // ignore
    }
  }, [post.id]);

  function toggleSave() {
    setSaved((v) => {
      const next = !v;
      try {
        const set = new Set<string>(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
        if (next) set.add(post.id);
        else set.delete(post.id);
        localStorage.setItem(SAVED_KEY, JSON.stringify([...set]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const loved = mine === "love";

  function react(type: string) {
    // optimistic
    const prev = { counts, mine, total };
    const next = { ...counts };
    let nextMine: string | null = mine;
    if (mine) next[mine as keyof typeof next] = Math.max(0, next[mine as keyof typeof next] - 1);
    if (mine === type) {
      nextMine = null;
    } else {
      next[type as keyof typeof next] += 1;
      nextMine = type;
    }
    setCounts(next);
    setMine(nextMine);
    setTotal(Object.values(next).reduce((a, b) => a + b, 0));

    startReact(async () => {
      const res = await setReaction(post.id, type);
      if (res.ok && res.counts) {
        setCounts(res.counts);
        setMine(res.mine ?? null);
        setTotal(res.total ?? 0);
      } else {
        setCounts(prev.counts);
        setMine(prev.mine);
        setTotal(prev.total);
      }
    });
  }

  // Double-tap / double-click the photo to love it (with a heart burst).
  function onPhotoDoubleClick() {
    if (!loved) react("love");
    setBurst(true);
    setTimeout(() => setBurst(false), 800);
  }

  async function toggleComments() {
    const open = !showComments;
    setShowComments(open);
    if (open && comments === null) {
      setLoadingComments(true);
      const rows = await fetchComments(post.id);
      setComments(rows);
      setCommentCount(rows.length);
      setLoadingComments(false);
    }
  }

  function submitComment() {
    const body = text.trim();
    if (!body) return;
    startPosting(async () => {
      const res = await addComment(post.id, body);
      if (res.ok && res.comment) {
        setComments((c) => [res.comment as CommunityComment, ...(c ?? [])]);
        setCommentCount((n) => n + 1);
        setText("");
        if (!showComments) setShowComments(true);
      }
    });
  }

  async function share() {
    const mapLink =
      post.latitude && post.longitude
        ? `\nLocation: https://www.google.com/maps?q=${post.latitude},${post.longitude}`
        : "";
    const body =
      `📍 ${post.title}${post.locationName ? ` (${post.locationName})` : ""}\n` +
      `${post.description}${post.rating ? `\n⭐ ${post.rating}/5` : ""}${mapLink}\n\n— via Explore World Community`;
    const data: ShareData = { title: post.title, text: body };
    if (post.latitude && post.longitude)
      data.url = `https://www.google.com/maps?q=${post.latitude},${post.longitude}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, "_blank");
    }
  }

  const initial = (post.authorName ?? "T").charAt(0).toUpperCase();

  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="card-hover animate-fadeUp overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5">
        {post.authorImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.authorImage} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-100" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-sm font-bold text-white ring-2 ring-emerald-100">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{post.authorName ?? "Traveller"}</p>
          <p className="flex items-center gap-1 truncate text-xs text-slate-400">
            {post.locationName && (
              <>
                <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{post.locationName}</span> ·{" "}
              </>
            )}
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {post.rating ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {post.rating}
          </span>
        ) : null}
      </div>

      {/* Photo — double-tap to love */}
      <div
        className="relative cursor-pointer select-none"
        onDoubleClick={onPhotoDoubleClick}
      >
        {post.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.photoUrl} alt={post.title} className="max-h-[30rem] w-full object-cover" />
        ) : (
          <div className="grid h-60 w-full place-items-center bg-gradient-to-br from-emerald-100 to-sky-100 text-5xl">🌄</div>
        )}
        {burst && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <Heart className="h-24 w-24 animate-ping fill-white text-white drop-shadow-lg" />
          </span>
        )}
      </div>

      {/* Instagram-style action bar */}
      <div className="flex items-center gap-1 px-2.5 pt-1.5">
        <button onClick={() => react("love")} aria-label="Love" className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-slate-50 active:scale-90">
          <Heart className={`h-6 w-6 ${loved ? "animate-pop fill-rose-500 text-rose-500" : "text-slate-800 hover:text-slate-500"}`} />
        </button>
        <button onClick={toggleComments} aria-label="Comment" className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-slate-50 active:scale-90">
          <MessageCircle className="h-6 w-6 text-slate-800 hover:text-slate-500" />
        </button>
        <button onClick={share} aria-label="Share" className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-slate-50 active:scale-90">
          {copied ? <Check className="h-6 w-6 text-emerald-600" /> : <Share2 className="h-6 w-6 text-slate-800 hover:text-slate-500" />}
        </button>
        <button onClick={toggleSave} aria-label="Save" className="ml-auto grid h-11 w-11 place-items-center rounded-full transition hover:bg-slate-50 active:scale-90">
          <Bookmark className={`h-6 w-6 ${saved ? "fill-slate-900 text-slate-900" : "text-slate-800 hover:text-slate-500"}`} />
        </button>
      </div>

      {/* Likes + body */}
      <div className="px-4 pb-4 pt-2">
        {total > 0 && (
          <p className="text-sm font-semibold text-slate-900">
            {counts.love > 0 ? `${counts.love} ${counts.love === 1 ? "love" : "loves"}` : `${total} reactions`}
          </p>
        )}

        <p className="mt-1 text-sm">
          <span className="font-semibold text-slate-900">{post.authorName ?? "Traveller"}</span>{" "}
          <span className="font-semibold text-slate-900">{post.title}</span>{" "}
          <span className="text-slate-600">{post.description}</span>
        </p>

        {/* Advanced travel reactions — intent + visited markers */}
        <div className="mt-3 flex flex-wrap gap-2">
          {TRAVEL_REACTIONS.map((r) => {
            const active = mine === r.type;
            const n = counts[r.type as keyof typeof counts];
            return (
              <button
                key={r.type}
                onClick={() => react(r.type)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{r.emoji}</span>
                {r.label}
                {n > 0 && <span className="text-slate-400">{n}</span>}
              </button>
            );
          })}
          {post.latitude && post.longitude && (
            <a
              href={`https://www.google.com/maps?q=${post.latitude},${post.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Map
            </a>
          )}
        </div>

        {/* View comments */}
        {commentCount > 0 && !showComments && (
          <button onClick={toggleComments} className="mt-3 text-sm text-slate-400 hover:text-slate-600">
            View all {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </button>
        )}

        {/* Comments */}
        {showComments && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userImage} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitComment();
                }}
                placeholder="Add a comment…"
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
              />
              <button
                onClick={submitComment}
                disabled={posting || !text.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 transition active:scale-90 disabled:opacity-50"
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>

            {loadingComments ? (
              <p className="text-xs text-slate-400">Loading comments…</p>
            ) : comments && comments.length > 0 ? (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    {c.authorImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.authorImage} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                        {(c.authorName ?? "T").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-900">
                        {c.authorName ?? "Traveller"}{" "}
                        <span className="font-normal text-slate-400">· {timeAgo(c.createdAt)}</span>
                      </p>
                      <p className="text-sm text-slate-700">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No comments yet — be the first.</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
