// The detail page a generated-plan stop should open — the same page you get
// when you tap that place anywhere else in the app.
//
// Planner stop ids are `<prefix>:<placeId>`; the prefix records which listing
// the place came from (see api/multi-stop/plan/route.ts), and each listing has
// its own detail route:
//   dest:   → destinations   → /destinations/<slug>
//   nearby: → one-day trips  → /one-day-trips/<slug>
//   seed:   → city places    → /explore-bangalore/<slug>
// A live OpenStreetMap stop (`osm:`) has no row in our catalogue, so it has no
// page of its own and returns null.
export function planStopHref(id: string, slug?: string | null): string | null {
  if (!slug) return null;
  const prefix = id.slice(0, id.indexOf(":"));
  const s = encodeURIComponent(slug);
  switch (prefix) {
    case "dest":
      return `/destinations/${s}`;
    case "nearby":
      return `/one-day-trips/${s}`;
    case "seed":
      return `/explore-bangalore/${s}`;
    default:
      return null;
  }
}
