import { redirect } from "next/navigation";
import { Users, MapPin, Star, Heart, MessageCircle, Share2 } from "lucide-react";

import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { listPublishedPosts } from "@/lib/queries/community";
import type { CommunityPost } from "@/lib/db/schema";
import { CommunityForm } from "./CommunityForm";

function timeAgo(date: Date): string {
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

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  const posts = await listPublishedPosts(60);

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <header className="mb-6 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-100 text-sky-700">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community</h1>
          <p className="mt-1 text-sm text-slate-500">
            Share places you love — photos, reviews &amp; ratings. Posts go live instantly.
          </p>
        </div>
      </header>

      {/* Centered single-column feed (Instagram / Facebook style) */}
      <div className="mx-auto max-w-2xl space-y-6">
        <CommunityForm />

        {posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-sm text-slate-500">No posts yet — be the first to share a place!</p>
          </div>
        ) : (
          posts.map((p, i) => <PostCard key={p.id} post={p} index={i} />)
        )}
      </div>
    </AppShell>
  );
}

function PostCard({ post, index }: { post: CommunityPost; index: number }) {
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
      </div>

      {/* Photo */}
      {post.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.photoUrl} alt={post.title} className="max-h-[28rem] w-full object-cover" />
      ) : (
        <div className="grid h-56 w-full place-items-center bg-gradient-to-br from-emerald-100 to-sky-100 text-5xl">
          🌄
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-slate-600">
            <button className="flex items-center gap-1.5 text-sm transition hover:text-rose-500">
              <Heart className="h-5 w-5" /> Like
            </button>
            <button className="flex items-center gap-1.5 text-sm transition hover:text-sky-600">
              <MessageCircle className="h-5 w-5" /> Comment
            </button>
            <button className="flex items-center gap-1.5 text-sm transition hover:text-emerald-600">
              <Share2 className="h-5 w-5" /> Share
            </button>
          </div>
          {post.rating ? (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-4 w-4 ${post.rating! >= n ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                />
              ))}
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-sm">
          <span className="font-semibold text-slate-900">{post.title}</span>{" "}
          <span className="text-slate-600">{post.description}</span>
        </p>

        {post.latitude && post.longitude && (
          <a
            href={`https://www.google.com/maps?q=${post.latitude},${post.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
          >
            <MapPin className="h-3 w-3" /> View on map
          </a>
        )}
      </div>
    </article>
  );
}
