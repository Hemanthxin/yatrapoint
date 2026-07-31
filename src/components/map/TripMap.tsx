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
import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";
import { placeMapUrl } from "@/lib/maps";

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
  // line, or dotted flight arcs. "bike" shares the road's real routed geometry
  // (a bike takes the same roads a car does) with its own line colour.
  // Defaults to road.
  mode?: "road" | "bike" | "train" | "flight";
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
  // Nav-style "follow me". Off by default so zoom/pan always work; when on, the
  // camera pans with the live location at the current zoom, and any touch of the
  // map turns it back off — exactly like Google Maps.
  const [following, setFollowing] = useState(false);
  const followingRef = useRef(false);

  // Initialise once, dispose on unmount.
  useEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current as HTMLDivElement & {
      _leaflet_id?: number;
    };
    if (node._leaflet_id) delete node._leaflet_id;

    const map = L.map(node, {
      center: [origin.lat, origin.lng],
      zoom: 12,
      // Full Google-Maps-style interactivity — wheel, pinch, double-click,
      // drag, box-zoom and keyboard all enabled, with smooth fractional zoom.
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      dragging: true,
      boxZoom: true,
      keyboard: true,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
    });
    L.control.scale({ imperial: false }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // The container is often sized after Leaflet initialises (dynamic import,
    // flex/grid layout settling); recompute so tiles fill and zoom works.
    const invalidate = () => map.invalidateSize();
    const t = setTimeout(invalidate, 60);
    const ro = new ResizeObserver(invalidate);
    ro.observe(node);

    userMarkerRef.current = L.marker([origin.lat, origin.lng], { icon: USER_ICON })
      .bindPopup("You")
      .addTo(map);

    // Any user gesture (drag, wheel/pinch zoom) breaks out of follow mode.
    // Our own follow uses panTo (no zoom, no drag), so these only fire for the
    // user or the Re-center button — all of which should stop following.
    const stopFollow = () => {
      if (followingRef.current) {
        followingRef.current = false;
        setFollowing(false);
      }
    };
    map.on("dragstart", stopFollow);
    map.on("zoomstart", stopFollow);

    mapRef.current = map;
    const cleanupNode = node;
    return () => {
      clearTimeout(t);
      ro.disconnect();
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

  // Move user marker as coords change; if following, pan the camera with it at
  // the CURRENT zoom (never changes zoom, so it never fights the user).
  useEffect(() => {
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([origin.lat, origin.lng]);
    }
    if (followingRef.current && mapRef.current) {
      mapRef.current.panTo([origin.lat, origin.lng], { animate: true, duration: 0.5 });
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
          .bindPopup(popupHtml(`${idx + 1}. ${s.name}`, s))
          .addTo(m);
        stopMarkersRef.current.push(marker);
      });
    } else if (destination) {
      const marker = L.marker([destination.lat, destination.lng], {
        icon: SINGLE_DEST_ICON,
      })
        .bindPopup(
          popupHtml(destinationName || "Destination", {
            name: destinationName ?? "",
            lat: destination.lat,
            lng: destination.lng,
          })
        )
        .addTo(m);
      stopMarkersRef.current.push(marker);
    }
  }, [stops, destination, destinationName]);

  // Route polyline. Road/bike use the real OSRM geometry (a bike takes the
  // same roads a car does — no fake straight lines for it); train draws
  // straight segments through the stops (closed loop); flight draws bowed arcs.
  const routePositions = useMemo<[number, number][]>(() => {
    // For flight/train we intentionally ignore any road geometry.
    if ((mode === "road" || mode === "bike") && route && route.length > 1) return route;

    // Build the ordered sequence origin → stops → (back to origin for a loop).
    const seq: [number, number][] = [[origin.lat, origin.lng]];
    if (stops && stops.length > 0) {
      for (const s of stops) seq.push([s.lat, s.lng]);
      if (mode !== "road" && mode !== "bike") seq.push([origin.lat, origin.lng]); // close the loop
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
        : mode === "bike"
        ? { color: "#f59e0b", weight: 5, opacity: 0.85, dashArray: undefined as string | undefined }
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

  // Gather every "anchor" point (origin + stops/destination + route geometry)
  // for framing the trip. Excludes the live breadcrumb trail on purpose.
  const collectPoints = (): [number, number][] => {
    const pts: [number, number][] = [[origin.lat, origin.lng]];
    if (stops) for (const s of stops) pts.push([s.lat, s.lng]);
    if (destination) pts.push([destination.lat, destination.lng]);
    if (route) for (const r of route) pts.push(r);
    return pts;
  };

  // Auto-fit ONCE (the first render that has ≥2 points). After that the map is
  // the user's to pan/zoom — we never yank it back, so live GPS updates don't
  // fight your gestures. Use the "Re-center" button to reframe on demand.
  const fittedRef = useRef(false);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || fittedRef.current) return;
    const pts = collectPoints();
    if (pts.length < 2) return;
    m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15, animate: false });
    fittedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, stops, destination, origin.lat, origin.lng]);

  // Manual re-center: frame the whole trip (or centre on the user if it's the
  // only point). Preserves the "you control the map" model.
  function recenter() {
    const m = mapRef.current;
    if (!m) return;
    const pts = collectPoints();
    if (pts.length < 2) {
      m.setView([origin.lat, origin.lng], 15, { animate: true });
      return;
    }
    m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16, animate: true });
  }

  // Toggle nav-style follow. Turning it ON pans to the user at the current zoom
  // (no zoom change → doesn't trip the stop-follow guard).
  function toggleFollow() {
    const m = mapRef.current;
    if (!m) return;
    const next = !followingRef.current;
    followingRef.current = next;
    setFollowing(next);
    if (next) m.panTo([origin.lat, origin.lng], { animate: true });
  }

  return (
    <div
      className={
        height
          ? "relative overflow-hidden rounded-2xl border border-slate-200"
          : "relative h-full w-full"
      }
      style={height ? { height, width: "100%" } : { width: "100%" }}
    >
      <div ref={containerRef} className="h-full w-full" />

      {/* Map controls — stacked bottom-right, like Google Maps. */}
      <div className="absolute bottom-3 right-3 z-[500] flex flex-col gap-2">
        {/* Follow me (nav mode). Off by default; highlights emerald when on. */}
        <button
          type="button"
          onClick={toggleFollow}
          aria-pressed={following}
          aria-label={following ? "Stop following my location" : "Follow my location"}
          title={following ? "Following you — tap or move the map to stop" : "Follow my location"}
          className={`grid h-11 w-11 place-items-center rounded-full border shadow-lg transition active:scale-95 ${
            following
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l19-9-9 19-2-8-8-2z" />
          </svg>
        </button>
        {/* Re-center — frame the whole trip. */}
        <button
          type="button"
          onClick={recenter}
          aria-label="Re-center map"
          title="Re-center on the whole trip"
          className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 active:scale-95"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Popup for a place pin: bold label + a link that opens the EXACT place in
// Google Maps (name searched at its coordinate — see placeMapUrl), so a place
// generated by the planner pins precisely instead of snapping to a nearby POI.
function popupHtml(
  label: string,
  place: { name: string; lat: number; lng: number }
): string {
  const href = placeMapUrl({
    name: place.name,
    latitude: place.lat,
    longitude: place.lng,
  });
  return (
    `<strong>${escapeHtml(label)}</strong>` +
    `<br/><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" ` +
    `style="display:inline-block;margin-top:4px;font-weight:600;color:#047857;">Open in Google Maps ↗</a>`
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
