"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Send, Loader2 } from "lucide-react";
import type { CommunityPost, CommunityComment } from "@/lib/db/schema";
import type { PostSocial } from "@/lib/queries/community";
import { setReaction, addComment, fetchComments } from "@/lib/actions/community";

export function ReelItem({
  post,
  social,
  userName,
  userImage,
}: {
  post: CommunityPost;
  social: PostSocial;
  userName: string;
  userImage?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [burst, setBurst] = useState(false);

  const [mine, setMine] = useState<string | null>(social.mine);
  const [loveCount, setLoveCount] = useState(social.counts.love);
  const [, startReact] = useTransition();

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommunityComment[] | null>(null);
  const [commentCount, setCommentCount] = useState(social.comments);
  const [text, setText] = useState("");
  const [posting, startPosting] = useTransition();

  const loved = mine === "love";

  // Only the reel actually on screen autoplays — otherwise every reel in the
  // list would play (and make sound) at once.
  useEffect(() => {
    const el = containerRef.current;
    const video = videoRef.current;
    if (!el || !video) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          video.play().then(() => setPlaying(true)).catch(() => {});
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function toggleLove() {
    const prevMine = mine;
    const prevCount = loveCount;
    if (mine === "love") {
      setMine(null);
      setLoveCount((c) => Math.max(0, c - 1));
    } else {
      setMine("love");
      setLoveCount((c) => c + 1);
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    }
    startReact(async () => {
      const res = await setReaction(post.id, "love");
      if (res.ok) {
        setMine(res.mine ?? null);
        setLoveCount(res.counts?.love ?? 0);
      } else {
        setMine(prevMine);
        setLoveCount(prevCount);
      }
    });
  }

  function onTapVideo() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  async function toggleComments() {
    const open = !showComments;
    setShowComments(open);
    if (open && comments === null) {
      const rows = await fetchComments(post.id);
      setComments(rows);
      setCommentCount(rows.length);
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
      }
    });
  }

  return (
    <div ref={containerRef} className="relative h-full w-full snap-start snap-always bg-black">
      <video
        ref={videoRef}
        src={post.photoUrl ?? undefined}
        className="h-full w-full object-contain"
        loop
        muted={muted}
        playsInline
        onClick={onTapVideo}
        onDoubleClick={toggleLove}
      />

      {!playing && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/40 text-white">▶</span>
        </div>
      )}
      {burst && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <Heart className="h-24 w-24 animate-ping fill-white text-white drop-shadow-lg" />
        </span>
      )}

      {/* Mute toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Caption + author */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-16">
        <Link href={`/profile/${post.userId}`} className="flex items-center gap-2">
          {post.authorImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.authorImage} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/50" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white ring-2 ring-white/50">
              {(post.authorName ?? "T").charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-bold text-white drop-shadow">{post.authorName ?? "Traveller"}</span>
        </Link>
        <p className="mt-2 max-w-[75%] text-sm text-white/90">
          <span className="font-bold">{post.title}</span> {post.description}
        </p>
      </div>

      {/* Right action rail — Reels-style */}
      <div className="absolute bottom-24 right-3 z-10 flex flex-col items-center gap-5">
        <button type="button" onClick={toggleLove} className="flex flex-col items-center gap-1">
          <Heart className={`h-8 w-8 drop-shadow ${loved ? "fill-rose-500 text-rose-500" : "text-white"}`} />
          <span className="text-xs font-bold text-white drop-shadow">{loveCount}</span>
        </button>
        <button type="button" onClick={toggleComments} className="flex flex-col items-center gap-1">
          <MessageCircle className="h-8 w-8 text-white drop-shadow" />
          <span className="text-xs font-bold text-white drop-shadow">{commentCount}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const url = `${window.location.origin}/community`;
            if (navigator.share) navigator.share({ title: post.title, text: post.description, url }).catch(() => {});
          }}
          className="flex flex-col items-center gap-1"
        >
          <Share2 className="h-8 w-8 text-white drop-shadow" />
        </button>
      </div>

      {/* Comments sheet */}
      {showComments && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-3xl bg-white p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Comments ({commentCount})</p>
            <button type="button" onClick={() => setShowComments(false)} className="text-sm text-slate-400">
              Close
            </button>
          </div>
          <div className="mb-3 flex items-center gap-2">
            {userImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Add a comment…"
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={posting || !text.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-50"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {comments === null ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-400">No comments yet — be the first.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2">
                  {c.authorImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.authorImage} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                      {(c.authorName ?? "T").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-900">{c.authorName ?? "Traveller"}</p>
                    <p className="break-words text-sm text-slate-700">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
