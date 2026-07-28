"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { LocationProvider } from "./app/LocationContext";
import { ThemeProvider } from "./ThemeProvider";
import { NavProgress } from "./app/NavProgress";
import { ServiceWorkerRegister } from "./app/ServiceWorkerRegister";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LocationProvider>
          {/* Reads useSearchParams — wrap in Suspense to keep pages static-safe. */}
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          <ServiceWorkerRegister />
          {children}
        </LocationProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
