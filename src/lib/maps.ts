// Builds Google Maps links that open the EXACT intended place.
//
// Why not `?q=<lat>,<lng>`? That form drops a raw pin and Google labels it with
// whatever business is *nearest* to the coordinate. Our coordinates come from
// OpenStreetMap and are often off by 50–200m, so the pin snaps to a different
// place and shows the wrong name. Searching by the place *name* (plus area/city
// to disambiguate) makes Google resolve and open the real place with its own
// canonical name — no Google API key required.

type PlaceLike = {
  name?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  district?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
};

/** Comma-joined "Name, Area, City" query text, skipping empty parts. */
export function placeQuery(place: PlaceLike): string {
  return [place.name, place.area, place.district, place.city, place.state]
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean)
    .join(", ");
}

function hasCoords(place: PlaceLike): boolean {
  return (
    place.latitude != null &&
    place.longitude != null &&
    String(place.latitude).trim() !== "" &&
    String(place.longitude).trim() !== ""
  );
}

/**
 * A Google Maps URL that opens the exact place.
 *
 * Best free accuracy = place name searched *at the known coordinates*. The
 * `/maps/search/<name>/@lat,lng,17z` form centres the search on our coordinate,
 * so Google resolves the one real place near that spot (not a same-named place
 * elsewhere, and not the nearest random pin) and opens it with its own
 * canonical name. Falls back to a plain name search, then raw coordinates.
 */
export function placeMapUrl(place: PlaceLike): string {
  const q = placeQuery(place);
  if (q && hasCoords(place)) {
    return `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${place.latitude},${place.longitude},17z`;
  }
  if (q) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }
  if (hasCoords(place)) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  return "https://www.google.com/maps";
}

/**
 * Driving-directions URL to a place. Routes to the place *name* (not raw
 * coordinates) so the destination card shows the exact place. `origin` is the
 * traveller's current position; omit it to let Maps use the device location.
 */
export function placeDirectionsUrl(
  place: PlaceLike,
  origin?: { lat: number | string; lng: number | string } | null
): string {
  const params = new URLSearchParams({ api: "1", travelmode: "driving" });
  if (origin && origin.lat != null && origin.lng != null) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }
  const q = placeQuery(place);
  params.set(
    "destination",
    q || (hasCoords(place) ? `${place.latitude},${place.longitude}` : "")
  );
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
