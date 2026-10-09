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
  { sunElev: 7, sunAz: -14, sunColor: "#ff9d6e", sunInt: 2.6, hemiSky: "#a9b9ff", hemiGround: "#8a8a60", hemiInt: 0.85, rimColor: "#ffb59a", rimInt: 1.2, fog: "#f4c3a8", fogDensity: 0.0042, skyTop: "#5b78c8", skyMid: "#f0a99b", skyHorizon: "#ffd9ab", stars: 0.1, exposure: 1.0, bloom: 0.5, cloud: "#ffd6c4", cloudOpacity: 0.85, glow: 0.2, water: "#4a78b8" },
  // 1 · day
  { sunElev: 40, sunAz: -22, sunColor: "#fff0d4", sunInt: 3.4, hemiSky: "#a8cdff", hemiGround: "#7fa24e", hemiInt: 1.15, rimColor: "#d6ecff", rimInt: 0.9, fog: "#cfe5f5", fogDensity: 0.0032, skyTop: "#3d8fe0", skyMid: "#8cc7f5", skyHorizon: "#dcefff", stars: 0, exposure: 1.0, bloom: 0.32, cloud: "#ffffff", cloudOpacity: 0.95, glow: 0, water: "#3d8cc4" },
  // 2 · golden hour — the look of the reference
  { sunElev: 11, sunAz: -34, sunColor: "#ffb567", sunInt: 3.6, hemiSky: "#a9c8ff", hemiGround: "#7d9a46", hemiInt: 0.95, rimColor: "#ffc98a", rimInt: 1.6, fog: "#f7cba0", fogDensity: 0.0042, skyTop: "#5a8fd8", skyMid: "#b1cbea", skyHorizon: "#ffd6a2", stars: 0, exposure: 1.02, bloom: 0.55, cloud: "#ffe0bf", cloudOpacity: 0.9, glow: 0.35, water: "#4f86be" },
  // 3 · dusk
  { sunElev: 2.5, sunAz: 26, sunColor: "#ff7b5c", sunInt: 1.6, hemiSky: "#7a70c8", hemiGround: "#4d4c6e", hemiInt: 0.6, rimColor: "#ff9d86", rimInt: 1.1, fog: "#c97c90", fogDensity: 0.0046, skyTop: "#2b2d7a", skyMid: "#b45c8c", skyHorizon: "#ff9d70", stars: 0.35, exposure: 0.98, bloom: 0.55, cloud: "#ff9aa6", cloudOpacity: 0.8, glow: 0.8, water: "#4a4a96" },
  // 4 · night (moonlight)
  { sunElev: 40, sunAz: 22, sunColor: "#b9ccff", sunInt: 0.65, hemiSky: "#4d5aae", hemiGround: "#1b2240", hemiInt: 0.5, rimColor: "#7e92ff", rimInt: 0.8, fog: "#1a2150", fogDensity: 0.0048, skyTop: "#060a28", skyMid: "#141b55", skyHorizon: "#2c3280", stars: 1, exposure: 0.95, bloom: 0.5, cloud: "#6a72b8", cloudOpacity: 0.4, glow: 1, water: "#1c2a6a" },
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
