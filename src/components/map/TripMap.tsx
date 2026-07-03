"use client";

// Vanilla-Leaflet wrapper. We deliberately do NOT use react-leaflet here —
// react-leaflet 4 + React 18 StrictMode double-invokes effects, which leaves
// `_leaflet_id` on the container and crashes the second mount.
//
// Modes:
//   • Single destination: pass `destination` + `destinationName`.
//   • Multi-stop:        pass `stops`; each gets a numbered pin.

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import type { LatLng } from "@/lib/geo";

function pulseIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `
      <span style="position:relative;display:block;width:18px;height:18px;">
        <span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.4;animation:trippulse 1.6s ease-out infinite;"></span>
        <span style="position:absolute;inset:4px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.2);"></span>
      </span>
      <style>@keyframes trippulse{0%{transform:scale(.7);opacity:.7}100%{transform:scale(2);opacity:0}}</style>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function numberedPin(n: number, active = false) {
  const bg = active ? "#f59e0b" : "#10b981";
  const ring = active ? "#fbbf24" : "#34d399";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:36px;height:46px;">
        <div style="
          position:absolute;left:0;top:0;width:36px;height:36px;
          background:${bg};border:3px solid white;border-radius:9999px;
          box-shadow:0 2px 6px rgba(0,0,0,.35),0 0 0 1px ${ring};
          display:flex;align-items:center;justify-content:center;
          font:700 14px system-ui,sans-serif;color:white;
        ">${n}</div>
        <div style="
          position:absolute;left:13px;top:30px;width:0;height:0;
          border-left:5px solid transparent;border-right:5px solid transparent;
          border-top:12px solid ${bg};
          filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));
        "></div>
      </div>
    `,
    iconSize: [36, 42],
    // The pin's visual tip is the bottom of the triangle (y ≈ 42); anchor there
    // so the marker sits exactly on its coordinate instead of ~6px high.
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
}

const USER_ICON = pulseIcon("#10b981");
// A proper teardrop pin whose tip sits exactly on the coordinate (the previous
// emoji + CSS-transform hack drifted the marker off the real location).
const SINGLE_DEST_ICON = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:30px;height:40px;">
      <div style="
        position:absolute;left:0;top:0;width:30px;height:30px;
        background:#10b981;border:3px solid white;border-radius:9999px;
        box-shadow:0 2px 6px rgba(0,0,0,.35),0 0 0 1px #34d399;
      "></div>
      <div style="
        position:absolute;left:11px;top:24px;width:0;height:0;
        border-left:4px solid transparent;border-right:4px solid transparent;
        border-top:12px solid #10b981;filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));
      "></div>
      <div style="position:absolute;left:11px;top:8px;width:8px;height:8px;border-radius:9999px;background:white;"></div>
    </div>
  `,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -36],
});

export interface TripMapStop {
  lat: number;
  lng: number;
  name: string;
  // If set, this stop is highlighted (e.g. "next stop" in live tracking).
  active?: boolean;
}

export interface TripMapProps {
  origin: LatLng;
  // Mode A — single destination.
  destination?: LatLng;
  destinationName?: string;
  // Mode B — multi-stop. Pins numbered 1..N in array order.
  stops?: TripMapStop[];
  // Pre-fetched driving polyline (lat, lng pairs).
  route?: [number, number][];
  // Travel mode — themes the connecting line: solid road route, dashed rail
  // line, or dotted flight arcs. Defaults to road.
  mode?: "road" | "train" | "flight";
  // Live breadcrumb trail.
  trail?: LatLng[];
  // px height. Omit to fill parent (parent must have height).
  height?: number;
}

// Curved arc between two points (a quadratic bezier bowed perpendicular to the
// chord) — used to draw flight paths as gentle arcs instead of straight lines.
function arcBetween(a: [number, number], b: [number, number], segments = 24): [number, number][] {
  const [aLat, aLng] = a;
  const [bLat, bLng] = b;
  const midLat = (aLat + bLat) / 2;
  const midLng = (aLng + bLng) / 2;
  const dLat = bLat - aLat;
  const dLng = bLng - aLng;
  // Perpendicular offset ~15% of the chord length, bowed to one side.
  const offLat = -dLng * 0.15;
  const offLng = dLat * 0.15;
  const cLat = midLat + offLat;
  const cLng = midLng + offLng;
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = (1 - t) * (1 - t) * aLat + 2 * (1 - t) * t * cLat + t * t * bLat;
    const lng = (1 - t) * (1 - t) * aLng + 2 * (1 - t) * t * cLng + t * t * bLng;
    pts.push([lat, lng]);
  }
  return pts;
}

export default function TripMap({
  origin,
  destination,
  destinationName,
  stops,
  route,
  mode = "road",
  trail,
  height,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const trailLineRef = useRef<L.Polyline | null>(null);

  // Initialise once, dispose on unmount.
  useEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current as HTMLDivElement & {
      _leaflet_id?: number;
    };
    if (node._leaflet_id) delete node._leaflet_id;

    const map = L.map(node, {
      center: [origin.lat, origin.lng],
      zoom: 11,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    userMarkerRef.current = L.marker([origin.lat, origin.lng], { icon: USER_ICON })
      .bindPopup("You")
      .addTo(map);

    mapRef.current = map;
    const cleanupNode = node;
    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      stopMarkersRef.current = [];
      routeLineRef.current = null;
      trailLineRef.current = null;
      delete (cleanupNode as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move user marker as coords change.
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([origin.lat, origin.lng]);
    }
  }, [origin.lat, origin.lng]);

  // Render stop / destination markers.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    // Clear previous.
    for (const mk of stopMarkersRef.current) mk.remove();
    stopMarkersRef.current = [];

    if (stops && stops.length > 0) {
      stops.forEach((s, idx) => {
        const marker = L.marker([s.lat, s.lng], {
          icon: numberedPin(idx + 1, !!s.active),
        })
          .bindPopup(`<strong>${idx + 1}. ${escapeHtml(s.name)}</strong>`)
          .addTo(m);
        stopMarkersRef.current.push(marker);
      });
    } else if (destination) {
      const marker = L.marker([destination.lat, destination.lng], {
        icon: SINGLE_DEST_ICON,
      })
        .bindPopup(destinationName ? escapeHtml(destinationName) : "Destination")
        .addTo(m);
      stopMarkersRef.current.push(marker);
    }
  }, [stops, destination, destinationName]);

  // Route polyline. Road uses the real OSRM geometry; train draws straight
  // segments through the stops (closed loop); flight draws bowed arcs.
  const routePositions = useMemo<[number, number][]>(() => {
    // For flight/train we intentionally ignore any road geometry.
    if (mode === "road" && route && route.length > 1) return route;

    // Build the ordered sequence origin → stops → (back to origin for a loop).
    const seq: [number, number][] = [[origin.lat, origin.lng]];
    if (stops && stops.length > 0) {
      for (const s of stops) seq.push([s.lat, s.lng]);
      if (mode !== "road") seq.push([origin.lat, origin.lng]); // close the loop
    } else if (destination) {
      seq.push([destination.lat, destination.lng]);
    }
    if (seq.length < 2) return [];

    if (mode === "flight") {
      const arcs: [number, number][] = [];
      for (let i = 0; i < seq.length - 1; i++) {
        const seg = arcBetween(seq[i], seq[i + 1]);
        arcs.push(...(i === 0 ? seg : seg.slice(1)));
      }
      return arcs;
    }
    return seq;
  }, [route, stops, origin, destination, mode]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (routePositions.length < 2) {
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
      return;
    }
    // Per-mode line style.
    const style =
      mode === "train"
        ? { color: "#6366f1", weight: 4, opacity: 0.9, dashArray: "12 8" }
        : mode === "flight"
        ? { color: "#0ea5e9", weight: 3, opacity: 0.9, dashArray: "3 9" }
        : { color: "#10b981", weight: 5, opacity: 0.85, dashArray: undefined as string | undefined };
    // Recreate the line so the style follows the current mode.
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
    routeLineRef.current = L.polyline(routePositions, style).addTo(m);
  }, [routePositions, mode]);

  // Breadcrumb trail.
  const trailPositions = useMemo<[number, number][]>(
    () => (trail ?? []).map((p) => [p.lat, p.lng] as [number, number]),
    [trail]
  );
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (trailPositions.length < 2) {
      if (trailLineRef.current) {
        trailLineRef.current.remove();
        trailLineRef.current = null;
      }
      return;
    }
    if (trailLineRef.current) {
      trailLineRef.current.setLatLngs(trailPositions);
    } else {
      trailLineRef.current = L.polyline(trailPositions, {
        color: "#0ea5e9",
        weight: 4,
        opacity: 0.9,
        dashArray: "6 6",
      }).addTo(m);
    }
  }, [trailPositions]);

  // Fit bounds whenever the set of "anchor" points changes — origin, stops,
  // and (if present) the route geometry. We deliberately exclude the live
  // trail so the camera doesn't fight the user during tracking.
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const pts: [number, number][] = [[origin.lat, origin.lng]];
    if (stops) for (const s of stops) pts.push([s.lat, s.lng]);
    if (destination) pts.push([destination.lat, destination.lng]);
    if (route) for (const r of route) pts.push(r);
    if (pts.length < 2) return;
    const bounds = L.latLngBounds(pts);
    m.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
  }, [
    route,
    stops,
    destination?.lat,
    destination?.lng,
    origin.lat,
    origin.lng,
    destination,
  ]);

  return (
    <div
      ref={containerRef}
      className={
        height
          ? "overflow-hidden rounded-2xl border border-slate-200"
          : "h-full w-full"
      }
      style={height ? { height, width: "100%" } : { width: "100%" }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
