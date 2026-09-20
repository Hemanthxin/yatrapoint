// All 28 Indian States + 8 Union Territories.
//
// Districts now come from the curated 2026 reference in @/lib/india-districts,
// which covers every state and UT — OSM's admin boundaries lag real
// administrative change and are only consulted for TALUKS now. See
// src/lib/actions/areas.ts.
//
// Names match the `name` tag on the OSM admin_level=4 boundary so the live
// taluk lookups resolve reliably, and they are the keys of INDIA_DISTRICTS.
export const INDIA_STATES: string[] = [
  // States
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // Union Territories
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];
