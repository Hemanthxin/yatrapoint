// Client-safe constant — deliberately has zero imports (no DB client, no
// server-only code) so it can be imported by both server query/action files
// AND client components (e.g. the admin gallery UI) without pulling in
// anything that would crash when evaluated in the browser.
export const MAX_GALLERY_IMAGES = 4;
