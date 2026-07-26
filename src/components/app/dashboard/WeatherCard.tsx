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
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { useLocation } from "@/components/app/LocationContext";
import { AnimatedWords } from "@/components/app/AnimatedWords";

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

  const { label, Icon } = weather ? describe(weather.code) : { label: "", Icon: Cloud };

  return (
    <div className="card relative overflow-hidden p-5">
      {/* Soft sky wash so the weather card reads distinct from the others. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-100/60 via-transparent to-emerald-100/50"
      />
      <div className="relative">
        <div className="flex items-start justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" /> {place}
          </p>
          <MoreHorizontal className="h-4 w-4 text-slate-300" />
        </div>

        {!weather ? (
          <div className="grid h-24 place-items-center text-slate-400">
            {failed ? (
              <span className="text-xs font-medium">Weather unavailable</span>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-5xl font-black leading-none text-slate-900">
                  <AnimatedWords as="span" text={`${weather.temp}°C`} stagger={0.06} />
                </p>
                <p className="mt-1.5 text-sm font-bold text-slate-800">
                  <AnimatedWords text={label} stagger={0.06} delay={0.1} />
                </p>
                <p className="text-xs text-slate-500">Feels like {weather.feels}°</p>
              </div>
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/70 text-emerald-600 shadow-inner ring-1 ring-white/60">
                <Icon className="h-9 w-9" strokeWidth={1.6} />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/60 p-3 text-center ring-1 ring-white/50">
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
