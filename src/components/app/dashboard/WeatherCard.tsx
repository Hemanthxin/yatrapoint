"use client";

// Live weather + air quality for the traveller's current location, from the
// free Open-Meteo APIs (no key, CORS-enabled). The place name comes from
// BigDataCloud's free client reverse-geocoder. Everything degrades gracefully:
// if a call fails we simply hide that bit rather than break the dashboard.
import { useEffect, useState } from "react";
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Droplets,
  Wind,
  Gauge,
  Loader2,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useLocation } from "@/components/app/LocationContext";

interface Weather {
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  code: number;
  aqi: number | null;
}

// Open-Meteo WMO weather codes → label + icon.
function describe(code: number): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: "Clear sky", Icon: Sun };
  if (code <= 2) return { label: "Partly Cloudy", Icon: CloudSun };
  if (code === 3) return { label: "Overcast", Icon: Cloud };
  if (code <= 48) return { label: "Foggy", Icon: CloudFog };
  if (code <= 67) return { label: "Rainy", Icon: CloudRain };
  if (code <= 77) return { label: "Snowy", Icon: CloudSnow };
  if (code <= 82) return { label: "Rain showers", Icon: CloudRain };
  if (code <= 86) return { label: "Snow showers", Icon: CloudSnow };
  return { label: "Thunderstorm", Icon: CloudLightning };
}

function aqiTone(aqi: number): string {
  if (aqi <= 50) return "text-emerald-600";
  if (aqi <= 100) return "text-amber-600";
  return "text-rose-600";
}

export function WeatherCard() {
  const { coords } = useLocation();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [place, setPlace] = useState<string>("Your location");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { lat, lng } = coords;

    async function load() {
      try {
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
            `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m`
        );
        const w = await wRes.json();
        const c = w.current;

        // Air quality is a separate Open-Meteo host; tolerate its absence.
        let aqi: number | null = null;
        try {
          const aRes = await fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi`
          );
          const a = await aRes.json();
          aqi = a.current?.us_aqi ?? null;
        } catch {
          /* ignore AQI failure */
        }

        if (cancelled) return;
        setWeather({
          temp: Math.round(c.temperature_2m),
          feels: Math.round(c.apparent_temperature),
          humidity: Math.round(c.relative_humidity_2m),
          wind: Math.round(c.wind_speed_10m),
          code: c.weather_code,
          aqi: aqi != null ? Math.round(aqi) : null,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }

      try {
        const gRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
        );
        const g = await gRes.json();
        const name = [g.city || g.locality, g.principalSubdivision].filter(Boolean).join(", ");
        if (!cancelled && name) setPlace(name);
      } catch {
        /* keep default label */
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  if (failed) return null;

  const { label, Icon } = weather ? describe(weather.code) : { label: "", Icon: Cloud };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-bold text-slate-900">{place}</p>
        <MoreHorizontal className="h-4 w-4 text-slate-300" />
      </div>

      {!weather ? (
        <div className="grid h-24 place-items-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-5xl font-black leading-none text-slate-900">
              {weather.temp}
              <span className="align-top text-2xl">°C</span>
            </p>
            <Icon className="h-14 w-14 text-emerald-600" strokeWidth={1.6} />
          </div>
          <p className="mt-1 text-sm font-bold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">Feels like {weather.feels}°</p>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--border)] pt-3 text-center">
            <Metric icon={<Droplets className="h-4 w-4" />} label="Humidity" value={`${weather.humidity}%`} />
            <Metric icon={<Wind className="h-4 w-4" />} label="Wind" value={`${weather.wind} km/h`} />
            <Metric
              icon={<Gauge className="h-4 w-4" />}
              label="AQI"
              value={weather.aqi != null ? String(weather.aqi) : "—"}
              tone={weather.aqi != null ? aqiTone(weather.aqi) : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-emerald-600">{icon}</span>
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <span className={`text-xs font-bold ${tone ?? "text-slate-800"}`}>{value}</span>
    </div>
  );
}
