"use client";

import { useEffect } from "react";
import { CART_EVENT } from "@/lib/cart";
import { isNativeApp, nativePlugin } from "@/lib/native";

const SAVED_TRIPS_KEY = "yatra-point/saved-trips";
const CART_KEY = "yatra-point/trip-cart";

interface PrefsPlugin {
  set(o: { key: string; value: string }): Promise<void>;
}
interface SharePlugin {
  share(o: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<unknown>;
}
interface AppPlugin {
  addListener(ev: string, cb: (e: { canGoBack: boolean }) => void): unknown;
  exitApp(): void;
}

// Runs only inside the Android app. It wires the website to the phone:
//  • saved trips and the trip cart are copied into the app's own storage, so the offline screen can show them;
//  • the website's Share button opens Android's share sheet;
//  • the phone's Back button walks back through pages, and leaves the app from the first screen.
export function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("is-native-app");
    const cleanups: (() => void)[] = [];

    // 1 · offline copy of saved trips + cart
    const prefs = nativePlugin<PrefsPlugin>("Preferences");
    if (prefs) {
      let last = "";
      const sync = () => {
        try {
          const trips = localStorage.getItem(SAVED_TRIPS_KEY) || "[]";
          const cart = localStorage.getItem(CART_KEY) || "[]";
          const sig = trips + "|" + cart;
          if (sig === last) return;
          last = sig;
          void prefs.set({ key: "saafera.savedTrips", value: trips });
          void prefs.set({ key: "saafera.tripCart", value: cart });
          void prefs.set({ key: "saafera.syncedAt", value: JSON.stringify(Date.now()) });
        } catch {
          /* storage blocked — nothing to copy */
        }
      };
      sync();
      const id = window.setInterval(sync, 3000); // saved trips are written without an event, so check on a timer
      window.addEventListener(CART_EVENT, sync);
      document.addEventListener("visibilitychange", sync);
      cleanups.push(() => {
        window.clearInterval(id);
        window.removeEventListener(CART_EVENT, sync);
        document.removeEventListener("visibilitychange", sync);
      });
    }

    // 2 · native share sheet behind navigator.share
    const share = nativePlugin<SharePlugin>("Share");
    if (share) {
      try {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: (data: ShareData) =>
            share.share({ title: data.title, text: data.text, url: data.url, dialogTitle: "Share" }).then(() => undefined),
        });
        Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
      } catch {
        /* the browser would not let us — the web share/copy fallback still works */
      }
    }

    // 3 · hardware Back button
    const app = nativePlugin<AppPlugin>("App");
    if (app) {
      app.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else app.exitApp();
      });
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
