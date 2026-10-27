import * as THREE from "three";

/** Everything that changes between dawn and midnight. `time` runs 0 (dawn) → 4 (night) and is blended between the five. */
export interface Look {
  sunElev: number; // degrees
  sunAz: number; // 0 = straight ahead (−z), + = right
  sunColor: string;
  sunInt: number;
  hemiSky: string;
  hemiGround: string;
  hemiInt: number;
  rimColor: string;
  rimInt: number;
  fog: string;
  fogDensity: number;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  stars: number;
  exposure: number;
  bloom: number;
  cloud: string;
  cloudOpacity: number;
  glow: number; // 0 = lanterns/windows are decoration, 1 = they are the light
  water: string;
}

export const LOOKS: Look[] = [
  // 0 · dawn
  { sunElev: 7, sunAz: -14, sunColor: "#ffb88a", sunInt: 2.4, hemiSky: "#b4c4e8", hemiGround: "#7d8a5c", hemiInt: 0.85, rimColor: "#ffc7a8", rimInt: 1.0, fog: "#e6c6b2", fogDensity: 0.003, skyTop: "#5d7fc0", skyMid: "#e6b9a8", skyHorizon: "#f6d8ba", stars: 0.1, exposure: 1.0, bloom: 0.28, cloud: "#f3d4c6", cloudOpacity: 0.85, glow: 0.2, water: "#4f7aa8" },
  // 1 · day
  { sunElev: 40, sunAz: -22, sunColor: "#fff4e2", sunInt: 3.2, hemiSky: "#b9d4f2", hemiGround: "#7c9453", hemiInt: 1.1, rimColor: "#dcecfa", rimInt: 0.8, fog: "#d5e4ef", fogDensity: 0.0022, skyTop: "#3f84d6", skyMid: "#86bcea", skyHorizon: "#d8e8f4", stars: 0, exposure: 1.0, bloom: 0.18, cloud: "#ffffff", cloudOpacity: 0.95, glow: 0, water: "#3d84b8" },
  // 2 · late afternoon
  { sunElev: 16, sunAz: -34, sunColor: "#ffcc8a", sunInt: 3.0, hemiSky: "#b8cdec", hemiGround: "#7d9350", hemiInt: 0.9, rimColor: "#ffd6a6", rimInt: 1.0, fog: "#dcc9ae", fogDensity: 0.0026, skyTop: "#3f7ccc", skyMid: "#9db9d8", skyHorizon: "#e6c9a2", stars: 0, exposure: 0.9, bloom: 0.2, cloud: "#ffe8d0", cloudOpacity: 0.85, glow: 0.3, water: "#4a82b4" },
  // 3 · dusk
  { sunElev: 2.5, sunAz: 26, sunColor: "#ff9474", sunInt: 1.6, hemiSky: "#7f78c0", hemiGround: "#4d4c6e", hemiInt: 0.6, rimColor: "#ffa890", rimInt: 1.0, fog: "#b88494", fogDensity: 0.0036, skyTop: "#2f3a80", skyMid: "#a86a8c", skyHorizon: "#f2a27c", stars: 0.35, exposure: 0.98, bloom: 0.34, cloud: "#f09aa6", cloudOpacity: 0.8, glow: 0.8, water: "#4a4a96" },
  // 4 · night (moonlight)
  { sunElev: 40, sunAz: 22, sunColor: "#b9ccff", sunInt: 0.65, hemiSky: "#4d5aae", hemiGround: "#1b2240", hemiInt: 0.5, rimColor: "#7e92ff", rimInt: 0.8, fog: "#1a2150", fogDensity: 0.0048, skyTop: "#060a28", skyMid: "#141b55", skyHorizon: "#2c3280", stars: 1, exposure: 0.95, bloom: 0.4, cloud: "#6a72b8", cloudOpacity: 0.4, glow: 1, water: "#1c2a6a" },
];

const KEYS_NUM = ["sunElev", "sunAz", "sunInt", "hemiInt", "rimInt", "fogDensity", "stars", "exposure", "bloom", "cloudOpacity", "glow"] as const;
const KEYS_COL = ["sunColor", "hemiSky", "hemiGround", "rimColor", "fog", "skyTop", "skyMid", "skyHorizon", "cloud", "water"] as const;

export type LiveLook = { [K in (typeof KEYS_NUM)[number]]: number } & { [K in (typeof KEYS_COL)[number]]: THREE.Color };

export function makeLiveLook(): LiveLook {
  const o: Record<string, unknown> = {};
  KEYS_NUM.forEach((k) => (o[k] = 0));
  KEYS_COL.forEach((k) => (o[k] = new THREE.Color()));
  return o as LiveLook;
}

const tmp = new THREE.Color();
/** Blend the looks around continuous `time` into `out`. */
export function blendLook(time: number, out: LiveLook): LiveLook {
  const t = Math.min(LOOKS.length - 1, Math.max(0, time));
  const i = Math.min(LOOKS.length - 2, Math.floor(t));
  const f = t - i;
  const a = LOOKS[i];
  const b = LOOKS[i + 1];
  for (const k of KEYS_NUM) out[k] = a[k] + (b[k] - a[k]) * f;
  for (const k of KEYS_COL) {
    tmp.set(b[k]);
    out[k].set(a[k]).lerp(tmp, f);
  }
  return out;
}

export function sunDirection(elevDeg: number, azDeg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const e = THREE.MathUtils.degToRad(elevDeg);
  const a = THREE.MathUtils.degToRad(azDeg);
  return out.set(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)).normalize();
}
