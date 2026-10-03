"use client";

import { useEffect, useRef, useState } from "react";
import { Droplets, Wind, Gauge } from "lucide-react";
import { useLocation } from "@/components/app/LocationContext";

interface Weather {
  temp: number;
  humidity: number;
  wind: number;
  aqi: number | null;
}

// Same free Open-Meteo source as the flat dashboard's WeatherCard, trimmed to
// what fits a deep-dive panel — kept as its own small client component (not
// embedded HTML inside the WebGL scene) so a slow/failed fetch can't block
// anything 3D-related.
export function useLiveWeather() {
  const { coords, status, request } = useLocation();
  const [weather, setWeather] = useState<Weather | null>(null);
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  useEffect(() => {
    if (status === "idle") request();
  }, [status, request]);

  // Wait for geolocation to settle, and fetch once per fix rather than on
  // every GPS accuracy refinement tick — same reasoning as NearbyModule's
  // fetch effect (see its comment): re-fetching on each refinement risks the
  // request never getting a clean run before the next tick restarts it.
  const ready = status === "granted" || status === "denied" || status === "unavailable";

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const { lat, lng } = coordsRef.current;
    async function load() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m`
        );
        const data = await res.json();
        if (cancelled) return;
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          humidity: Math.round(data.current.relative_humidity_2m),
          wind: Math.round(data.current.wind_speed_10m),
          aqi: null,
        });
      } catch {
        /* dashboard stays fine without it */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return weather;
}

export function WeatherDeepDive({ weather }: { weather: Weather | null }) {
  if (!weather) return <p className="text-sm text-white/50">Fetching live weather…</p>;
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <Metric icon={<Droplets className="h-4 w-4" />} label="Humidity" value={`${weather.humidity}%`} />
      <Metric icon={<Wind className="h-4 w-4" />} label="Wind" value={`${weather.wind} km/h`} />
      <Metric icon={<Gauge className="h-4 w-4" />} label="Feels" value={`${weather.temp}°C`} />
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white/5 p-3">
      <span className="text-emerald-300">{icon}</span>
      <span className="text-[10px] font-medium text-white/50">{label}</span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}
