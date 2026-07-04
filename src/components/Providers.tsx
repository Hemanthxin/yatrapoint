"use client";

import { SessionProvider } from "next-auth/react";
import { LocationProvider } from "./app/LocationContext";
import { ThemeProvider } from "./ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LocationProvider>{children}</LocationProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
