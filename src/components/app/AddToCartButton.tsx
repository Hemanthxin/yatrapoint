"use client";

import { useEffect, useState } from "react";
import { Plus, Check } from "lucide-react";
import { inCart, toggleCart, CART_EVENT, type CartItem } from "@/lib/cart";
import { showToast } from "@/lib/toast";

// Reusable "Add to trip" toggle used on every place card, so adding to the trip
// cart works the same everywhere. Stops link/card navigation when tapped.
export function AddToCartButton({
  item,
  className = "",
  label = "Add to trip",
}: {
  item: CartItem;
  className?: string;
  label?: string;
}) {
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const sync = () => setAdded(inCart(item.id));
    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => window.removeEventListener(CART_EVENT, sync);
  }, [item.id]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const nowAdded = toggleCart(item);
        // Name the place in the toast. "Trip added to cart" left you guessing
        // which of the three things you just tapped actually went in.
        if (nowAdded) showToast(`${item.name} added to cart`, "🧳");
      }}
      aria-pressed={added}
      className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-bold transition active:scale-95 ${
        added
          ? "bg-emerald-100 text-emerald-700"
          : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30 hover:scale-[1.03]"
      } ${className}`}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" /> Added
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" /> {label}
        </>
      )}
    </button>
  );
}
