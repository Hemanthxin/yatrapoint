// Curated, authoritative district lists for states where live OpenStreetMap
// admin boundaries are incomplete or outdated. OSM, for example, is missing the
// Ramanagara district boundary in Karnataka and still uses stale names like
// "Shimoga" (now Shivamogga) and "Bengaluru North/South" instead of the real
// districts. When a state appears here we use THIS list for the district
// dropdown; states not listed fall back to live OSM detection.
export const INDIA_DISTRICTS: Record<string, string[]> = {
  Karnataka: [
    "Bagalkot",
    "Ballari",
    "Belagavi",
    "Bengaluru Rural",
    "Bengaluru Urban",
    "Bidar",
    "Chamarajanagar",
    "Chikkaballapur",
    "Chikkamagaluru",
    "Chitradurga",
    "Dakshina Kannada",
    "Davanagere",
    "Dharwad",
    "Gadag",
    "Hassan",
    "Haveri",
    "Kalaburagi",
    "Kodagu",
    "Kolar",
    "Koppal",
    "Mandya",
    "Mysuru",
    "Raichur",
    "Ramanagara",
    "Shivamogga",
    "Tumakuru",
    "Udupi",
    "Uttara Kannada",
    "Vijayanagara",
    "Vijayapura",
    "Yadgir",
  ],
};
