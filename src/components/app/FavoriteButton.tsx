"use client";

import { Heart } from "lucide-react";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/lib/actions/favorites";

interface FavoriteButtonProps {
  destinationId: string;
  initialFavored: boolean;
  size?: "sm" | "md";
}

export function FavoriteButton({
  destinationId,
  initialFavored,
  size = "sm",
}: FavoriteButtonProps) {
  const [favored, setFavored] = useState(initialFavored);
  const [isPending, startTransition] = useTransition();

  const dim = size === "md" ? "h-11 w-11" : "h-9 w-9";
  const icon = size === "md" ? "h-5 w-5" : "h-[18px] w-[18px]";

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Optimistic toggle for snappier UX; reconcile from server result.
    const next = !favored;
    setFavored(next);
    startTransition(async () => {
      const res = await toggleFavorite(destinationId);
      if (!res.ok) setFavored(!next);
      else setFavored(res.favored);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-label={favored ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favored}
      className={`grid ${dim} place-items-center rounded-full bg-white/90 shadow-md ring-1 backdrop-blur transition active:scale-90 disabled:opacity-60 ${
        favored
          ? "ring-rose-200 hover:bg-rose-50"
          : "ring-slate-200/70 hover:bg-white"
      }`}
    >
      <Heart
        className={`${icon} transition ${
          favored
            ? "animate-pop fill-rose-500 stroke-rose-500"
            : "stroke-slate-500 group-hover:stroke-rose-400"
        }`}
      />
    </button>
  );
}
