"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import type { CommunityPost, CommunityComment } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { Reveal } from "@/components/app/Reveal";
import {
  setReaction,
  addComment,
  fetchComments,
  deleteComment,
  deleteCommunityPost,
  updateCommunityPost,
} from "@/lib/actions/community";

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
  post: initialPost,
  social,
  userName,
  userImage,
  currentUserId,
  index,
  onDeleted,
}: {
  post: CommunityPost;
  social: PostSocial;
  userName: string;
  userImage?: string | null;
  currentUserId: string;
  index: number;
  onDeleted?: (postId: string) => void;
}) {
  const [post, setPost] = useState(initialPost);

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

  // Author controls
  const isAuthor = post.userId === currentUserId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // Edit-mode draft fields
  const [eTitle, setETitle] = useState(post.title);
  const [eDesc, setEDesc] = useState(post.description);
  const [eRating, setERating] = useState<number>(post.rating ?? 0);
  const [eHoverRating, setEHoverRating] = useState(0);
  const [eLocation, setELocation] = useState(post.locationName ?? "");
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      if (Array.isArray(ids)) setSaved(ids.includes(post.id));
    } catch {
      // ignore
    }
  }, [post.id]);

  // Close the author menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  function removeComment(commentId: string) {
    // optimistic remove + decrement
    const prev = comments;
    setComments((c) => (c ? c.filter((x) => x.id !== commentId) : c));
    setCommentCount((n) => Math.max(0, n - 1));
    startReact(async () => {
      const res = await deleteComment(commentId);
      if (!res.ok) {
        // revert
        setComments(prev);
        setCommentCount((n) => n + 1);
      }
    });
  }

  function onDelete() {
    setMenuOpen(false);
    if (!confirm("Delete this post? This can't be undone.")) return;
    setActionError(null);
    startDeleting(async () => {
      const res = await deleteCommunityPost(post.id);
      if (res.ok) {
        if (onDeleted) onDeleted(post.id);
        else setRemoved(true);
      } else {
        setActionError(res.error || "Could not delete post.");
      }
    });
  }

  function startEdit() {
    setMenuOpen(false);
    setActionError(null);
    setETitle(post.title);
    setEDesc(post.description);
    setERating(post.rating ?? 0);
    setELocation(post.locationName ?? "");
    setEditing(true);
  }

  function saveEdit() {
    setActionError(null);
    startSaving(async () => {
      const res = await updateCommunityPost(post.id, {
        title: eTitle,
        description: eDesc,
        rating: eRating || null,
        locationName: eLocation || null,
      });
      if (res.ok && res.post) {
        setPost(res.post);
        setEditing(false);
      } else {
        setActionError(res.error || "Could not update post.");
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
      `${post.description}${post.rating ? `\n⭐ ${post.rating}/5` : ""}${mapLink}\n\n— via Saafera Community`;
    const data: ShareData = { title: post.title, text: body };
    if (post.latitude && post.longitude)
      data.url = `https://www.google.com/maps?q=${post.latitude},${post.longitude}`;

    // Native share sheet — only exists in a secure (HTTPS) context on mobile.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (navigator.canShare?.(data) ?? true)
    ) {
      try {
        await navigator.share(data);
      } catch {
        // user dismissed the sheet — do nothing
      }
      return;
    }

    // No Web Share API (desktop, or an insecure http:// LAN dev URL) → open a
    // real WhatsApp share instead of silently copying.
    const waText = encodeURIComponent(body + (data.url ? `\n${data.url}` : ""));
    const win = window.open(`https://wa.me/?text=${waText}`, "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked → copy as a last resort.
      try {
        await navigator.clipboard.writeText(body);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch {
        // ignore
      }
    }
  }

  if (removed) return null;

  const initial = (post.authorName ?? "T").charAt(0).toUpperCase();

  return (
    <Reveal
      as="article"
      delay={Math.min(index, 8) * 0.06}
      className="card-hover overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5">
        {post.authorImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.authorImage} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-500/20" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-sm font-bold text-white shadow-md shadow-emerald-500/30">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{post.authorName ?? "Traveller"}</p>
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

        {/* Author menu */}
        {isAuthor && !editing && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Post options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="grid h-11 w-11 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-90"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="animate-pop absolute right-0 top-12 z-20 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                <button
                  role="menuitem"
                  onClick={startEdit}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button
                  role="menuitem"
                  onClick={onDelete}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <p className="px-4 pb-1 text-xs font-medium text-rose-600">{actionError}</p>
      )}

      {/* Photo — double-tap to love */}
      <div className="relative cursor-pointer select-none" onDoubleClick={onPhotoDoubleClick}>
        {post.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.photoUrl} alt={post.title} className="max-h-[30rem] w-full object-cover" />
        ) : (
          <div className="grid h-60 w-full place-items-center bg-slate-100 text-5xl">🌄</div>
        )}
        {burst && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <Heart className="h-24 w-24 animate-ping fill-white text-white drop-shadow-lg" />
          </span>
        )}
        {deleting && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-white/60">
            <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
          </span>
        )}
      </div>

      {editing ? (
        /* ── Inline edit mode ─────────────────────────────────────────── */
        <div className="space-y-3 p-4">
          <input
            value={eTitle}
            onChange={(e) => setETitle(e.target.value)}
            placeholder="Place name"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          />

          <div className="flex items-center gap-1">
            <span className="mr-2 text-xs font-medium uppercase tracking-wide text-slate-500">Rating</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setERating((r) => (r === n ? 0 : n))}
                onMouseEnter={() => setEHoverRating(n)}
                onMouseLeave={() => setEHoverRating(0)}
                aria-label={`${n} star`}
              >
                <Star
                  className={`h-6 w-6 transition ${
                    (eHoverRating || eRating) >= n ? "fill-amber-400 text-amber-400" : "text-slate-300"
                  }`}
                />
              </button>
            ))}
          </div>

          <textarea
            value={eDesc}
            onChange={(e) => setEDesc(e.target.value)}
            rows={3}
            placeholder="Write your review…"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          />

          <input
            value={eLocation}
            onChange={(e) => setELocation(e.target.value)}
            placeholder="Area / city (optional)"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          />

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setActionError(null);
              }}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
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
              <span className="font-bold text-slate-900">{post.authorName ?? "Traveller"}</span>{" "}
              <span className="font-bold text-slate-900">{post.title}</span>{" "}
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
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                      active
                        ? "border-transparent bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
                        : "border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    <span>{r.emoji}</span>
                    {r.label}
                    {n > 0 && <span className={active ? "text-white/80" : "text-emerald-500/70"}>{n}</span>}
                  </button>
                );
              })}
              {post.latitude && post.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${post.latitude},${post.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 active:scale-95"
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
                    className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-90 disabled:opacity-50"
                  >
                    <span aria-hidden className="sheen-overlay animate-sheen" />
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>

                {loadingComments ? (
                  <p className="text-xs text-slate-400">Loading comments…</p>
                ) : comments && comments.length > 0 ? (
                  <ul className="space-y-3">
                    {comments.map((c) => (
                      <li key={c.id} className="group flex gap-2">
                        {c.authorImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.authorImage} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
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
                          <p className="break-words text-sm text-slate-700">{c.body}</p>
                        </div>
                        {c.userId === currentUserId && (
                          <button
                            onClick={() => removeComment(c.id)}
                            aria-label="Delete comment"
                            className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">No comments yet — be the first.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Reveal>
  );
}
