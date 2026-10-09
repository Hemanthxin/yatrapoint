"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Star, Trash2, X } from "lucide-react";
import { saveReview, deleteReview } from "@/lib/actions/reviews";
import { showToast } from "@/lib/toast";
import { timeAgo } from "@/lib/timeAgo";
import type { PlaceReviewSummary, ReviewItem } from "@/lib/queries/reviews";

const MAX_BODY = 1000;
const PAGE = 8;
const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

interface Props {
  placeId: string;
  placeName: string;
  initial: PlaceReviewSummary;
  viewerId: string | null;
  isAdmin: boolean;
  className?: string;
}

export function ReviewsPanel({ placeId, placeName, initial, viewerId, isAdmin, className }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shown, setShown] = useState(PAGE);

  const mine = useMemo(
    () => initial.reviews.find((r) => r.userId === viewerId) ?? null,
    [initial.reviews, viewerId]
  );
  const others = useMemo(
    () => initial.reviews.filter((r) => r.userId !== viewerId),
    [initial.reviews, viewerId]
  );

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const formOpen = viewerId != null && (!mine || editing);

  function beginEdit() {
    if (!mine) return;
    setRating(mine.rating);
    setBody(mine.body);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setRating(0);
    setBody("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Tap a star to rate this place.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await saveReview(placeId, rating, body);
      if (!res.ok) {
        setError(res.error ?? "Could not save your review.");
        return;
      }
      showToast(mine ? "Review updated" : "Thanks for your review!", "⭐");
      cancel();
      router.refresh();
    });
  }

  function remove(r: ReviewItem) {
    if (!window.confirm("Delete this review?")) return;
    start(async () => {
      const res = await deleteReview(r.id);
      if (!res.ok) {
        showToast(res.error ?? "Could not delete the review", "⚠️");
        return;
      }
      showToast("Review deleted", "🗑️");
      cancel();
      router.refresh();
    });
  }

  const active = hover || rating;

  return (
    <section
      id="reviews"
      aria-label={`Reviews of ${placeName}`}
      className={`rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Traveller reviews</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            What visitors say about {placeName}.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <div className="text-center sm:px-4">
          <p className="text-4xl font-extrabold leading-none text-slate-900">
            {initial.count ? initial.average.toFixed(1) : "–"}
          </p>
          <Stars value={initial.average} className="mt-2 justify-center" />
          <p className="mt-1 text-xs font-medium text-slate-500">
            {initial.count === 0
              ? "No reviews yet"
              : `${initial.count} review${initial.count === 1 ? "" : "s"}`}
          </p>
        </div>
        <ul className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = initial.counts[n - 1];
            const pct = initial.count ? (c / initial.count) * 100 : 0;
            return (
              <li key={n} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="w-3 text-right">{n}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="block h-full rounded-full bg-amber-400 transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-6 tabular-nums text-slate-500">{c}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Write / edit */}
      {formOpen && (
        <form onSubmit={submit} className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-bold text-slate-900">
            {mine ? "Edit your review" : "Share your experience"}
          </p>
          <div
            className="mt-2 flex items-center gap-1"
            onMouseLeave={() => setHover(0)}
            role="radiogroup"
            aria-label="Your rating"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                className="rounded p-0.5 transition active:scale-90"
              >
                <Star
                  className={`h-8 w-8 transition ${
                    n <= active ? "fill-amber-400 text-amber-400" : "text-slate-300"
                  }`}
                />
              </button>
            ))}
            <span className="ml-2 text-sm font-semibold text-slate-600">{LABELS[active] ?? ""}</span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            rows={4}
            placeholder={`What was ${placeName} like? Best time to go, tips, what to skip…`}
            className="mt-3 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span className="text-red-600">{error}</span>
            <span>
              {body.length}/{MAX_BODY}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {mine ? "Save changes" : "Post review"}
            </button>
            {mine && (
              <button
                type="button"
                onClick={cancel}
                disabled={pending}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 active:scale-95"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* The viewer's own review, pinned above everyone else's */}
      {mine && !editing && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">Your review</p>
          <ReviewCard
            r={mine}
            own
            canDelete
            pending={pending}
            onEdit={beginEdit}
            onDelete={() => remove(mine)}
          />
        </div>
      )}

      {!viewerId && (
        <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Sign in to write a review.
        </p>
      )}

      {/* Everyone else's */}
      {others.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {others.slice(0, shown).map((r) => (
            <li key={r.id}>
              <ReviewCard
                r={r}
                canDelete={isAdmin}
                pending={pending}
                onDelete={() => remove(r)}
              />
            </li>
          ))}
        </ul>
      ) : (
        !mine &&
        initial.count === 0 && (
          <p className="mt-5 text-center text-sm text-slate-500">
            Be the first to review {placeName}.
          </p>
        )
      )}
      {others.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-4 w-full rounded-2xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 active:scale-[0.99]"
        >
          Show more reviews ({others.length - shown} more)
        </button>
      )}
    </section>
  );
}

function ReviewCard({
  r,
  own,
  canDelete,
  pending,
  onEdit,
  onDelete,
}: {
  r: ReviewItem;
  own?: boolean;
  canDelete?: boolean;
  pending: boolean;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${
        own ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <header className="flex items-start gap-3">
        <Avatar name={r.authorName} image={r.authorImage} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{r.authorName}</p>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <Stars value={r.rating} size="sm" />
            <span>
              {timeAgo(r.createdAt)}
              {r.edited && " · edited"}
            </span>
          </div>
        </div>
        {(own || canDelete) && (
          <div className="flex shrink-0 items-center gap-1">
            {own && onEdit && (
              <button
                type="button"
                onClick={onEdit}
                disabled={pending}
                aria-label="Edit your review"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                aria-label={own ? "Delete your review" : "Delete this review (admin)"}
                className="grid h-9 w-9 place-items-center rounded-full text-red-500 hover:bg-red-50 active:scale-90"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </header>
      {r.body && (
        <p className="mt-2.5 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">
          {r.body}
        </p>
      )}
    </article>
  );
}

function Stars({
  value,
  size = "md",
  className = "",
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const px = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${px} ${
            value >= n - 0.25 ? "fill-amber-400 text-amber-400" : value >= n - 0.75 ? "fill-amber-200 text-amber-400" : "text-slate-300"
          }`}
        />
      ))}
    </span>
  );
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">
      {initials || "T"}
    </span>
  );
}
