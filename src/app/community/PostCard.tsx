"use client";

import { useState, useTransition } from "react";
import { MapPin, MessageCircle, Share2, Check, Loader2, Send, Star } from "lucide-react";

import type { CommunityPost, CommunityComment } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { setReaction, addComment, fetchComments } from "@/lib/actions/community";

const REACTIONS = [
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "wantToGo", emoji: "🎒", label: "Want to go" },
  { type: "beenThere", emoji: "✅", label: "Been there" },
] as const;

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
        // revert
        setCounts(prev.counts);
        setMine(prev.mine);
        setTotal(prev.total);
      }
    });
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
    const text =
      `📍 ${post.title}${post.locationName ? ` (${post.locationName})` : ""}\n` +
      `${post.description}${post.rating ? `\n⭐ ${post.rating}/5` : ""}${mapLink}\n\n— via Explore World Community`;
    const data: ShareData = { title: post.title, text };
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
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  }

  const initial = (post.authorName ?? "T").charAt(0).toUpperCase();

  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="animate-fadeUp overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        {post.authorImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.authorImage} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-sm font-bold text-white">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{post.authorName ?? "Traveller"}</p>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            {post.locationName && (
              <>
                <MapPin className="h-3 w-3" /> {post.locationName} ·{" "}
              </>
            )}
            {timeAgo(post.createdAt)}
          </p>
        </div>
        {post.rating ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {post.rating}
          </span>
        ) : null}
      </div>

      {/* Photo */}
      {post.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.photoUrl} alt={post.title} className="max-h-[28rem] w-full object-cover" />
      ) : (
        <div className="grid h-56 w-full place-items-center bg-gradient-to-br from-emerald-100 to-sky-100 text-5xl">🌄</div>
      )}

      {/* Body */}
      <div className="p-4">
        <p className="text-sm">
          <span className="font-semibold text-slate-900">{post.title}</span>{" "}
          <span className="text-slate-600">{post.description}</span>
        </p>

        {/* Reaction summary */}
        {total > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            {counts.love > 0 && <span className="mr-2">❤️ {counts.love}</span>}
            {counts.wantToGo > 0 && <span className="mr-2">🎒 {counts.wantToGo}</span>}
            {counts.beenThere > 0 && <span className="mr-2">✅ {counts.beenThere}</span>}
          </p>
        )}

        {/* Action bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {REACTIONS.map((r) => {
            const active = mine === r.type;
            const n = counts[r.type as keyof typeof counts];
            return (
              <button
                key={r.type}
                onClick={() => react(r.type)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
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

          <button
            onClick={toggleComments}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4" /> {commentCount > 0 ? commentCount : "Comment"}
          </button>

          <button
            onClick={share}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
            {copied ? "Copied" : "Share"}
          </button>
        </div>

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
                className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-emerald-400 focus:bg-white"
              />
              <button
                onClick={submitComment}
                disabled={posting || !text.trim()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50"
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
