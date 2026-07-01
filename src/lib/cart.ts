"use client";

// A lightweight, client-side "trip cart" shared across the whole app. Any place
// card (festival, destination, trip, hotel…) can add itself; the top-bar cart
// menu and the budget planner read from it. Persisted in localStorage and
// broadcast via a window event so every mounted component stays in sync.
import { useEffect, useState } from "react";

export interface CartItem {
  id: string;
  name: string;
  subtitle?: string;
  href?: string;
  kind?: string; // "festival" | "destination" | "trip" | "hotel" | …
  emoji?: string;
}

const KEY = "yatra-point/trip-cart";
export const CART_EVENT = "yatra-cart-change";

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(new Event(CART_EVENT));
}

export function getCart(): CartItem[] {
  return read();
}

export function inCart(id: string): boolean {
  return read().some((i) => i.id === id);
}

export function toggleCart(item: CartItem): boolean {
  const items = read();
  const idx = items.findIndex((x) => x.id === item.id);
  let added: boolean;
  if (idx >= 0) {
    items.splice(idx, 1);
    added = false;
  } else {
    items.unshift(item);
    added = true;
  }
  write(items);
  return added;
}

export function removeFromCart(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function clearCart() {
  write([]);
}

// Live cart contents for a component.
export function useCart(): CartItem[] {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return items;
}
