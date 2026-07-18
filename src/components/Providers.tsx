"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { LocationProvider } from "./app/LocationContext";
import { ThemeProvider } from "./ThemeProvider";
import { NavProgress } from "./app/NavProgress";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LocationProvider>
          {/* Reads useSearchParams — wrap in Suspense to keep pages static-safe. */}
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          {children}
        </LocationProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
