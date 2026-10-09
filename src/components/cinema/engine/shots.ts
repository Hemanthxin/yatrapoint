import * as THREE from "three";
import { CAMP_S, GATE_S } from "./world";
import { groundHeight, roadAt } from "./terrain";

/** A waypoint of the camera's journey. Positions are road-relative: [distance along road, sideways (+ = traveller's right), height above road]. */
export interface Waypoint {
  u: number; // story position: chapter i spans [i, i+1]
  cs: number; // where the characters stand (distance along the road)
  cam: [number, number, number];
  look: [number, number, number];
  fov: number;
  time: number; // time of day 0 dawn … 4 night
}

export const LANDING_SHOTS: Waypoint[] = [
  // I · hero — the three friends climb the stone steps toward us
  { u: 0, cs: 5, cam: [16.2, -1.8, 1.3], look: [5.0, -1.0, 3.0], fov: 36, time: 2 },
  { u: 1, cs: 14, cam: [25.2, -2.0, 1.5], look: [14.0, -1.0, 3.0], fov: 36, time: 2 },
  // II · prologue — the camera cranes up and back over the valley
  { u: 2, cs: 15, cam: [44, -10, 10], look: [22, -9, 3.5], fov: 38, time: 2.15 },
  // III · gate — follow them across the meadow, then dive through the arch
  { u: 2.4, cs: 64, cam: [52, 3.2, 3.2], look: [70, 0, 2.2], fov: 36, time: 2.2 },
  { u: 2.78, cs: 136, cam: [124, 2.2, 2.4], look: [GATE_S, 0, 2.7], fov: 34, time: 2.2 },
  { u: 2.92, cs: 145, cam: [GATE_S - 9, 0.3, 2.1], look: [GATE_S, 0, 2.9], fov: 40, time: 2.2 },
  { u: 3, cs: 152, cam: [GATE_S + 1.6, 0, 2.3], look: [GATE_S + 28, 0, 2.6], fov: 82, time: 1.6 },
  // IV · road — side-on tracking shot along the meadow road in full daylight
  { u: 3.18, cs: 170, cam: [171, -12.4, 1.8], look: [170.6, 0.2, 1.9], fov: 30, time: 1.15 },
  { u: 4, cs: 300, cam: [301, -12.4, 1.8], look: [300.6, 0.2, 1.9], fov: 30, time: 1.6 },
  // V · voices — sunset
  { u: 5, cs: 318, cam: [331, -10.5, 3.6], look: [319, 0.2, 2.1], fov: 30, time: 2.8 },
  // VI · realms — dusk, slow drift
  { u: 6, cs: 332, cam: [341, -7, 3.0], look: [333, 0.2, 2.2], fov: 34, time: 3.4 },
  // VII · wheel — night, the camera tilts up to the stars
  { u: 7, cs: 346, cam: [353, -6, 2.0], look: [347, 0, 7.5], fov: 40, time: 4 },
  // VIII · finale — the camp, window lit, fireflies
  { u: 8, cs: CAMP_S - 3, cam: [CAMP_S + 13, -6.8, 2.6], look: [CAMP_S - 2.5, 0.8, 4.2], fov: 38, time: 4 },
];

/** The dashboard's welcome: the camp, framed so the cast sits right of centre. */
export const CAMP_SHOT: Waypoint = { u: 0, cs: CAMP_S - 1.2, cam: [CAMP_S + 12.5, -9.0, 1.4], look: [CAMP_S - 4.2, 4.4, 2.7], fov: 40, time: 1 };

const tmpR = new THREE.Vector3();
function roadPoint(s: number, side: number, up: number, out: THREE.Vector3) {
  const a = roadAt(s);
  tmpR.set(-a.dir.z, 0, a.dir.x);
  out.copy(a.pos).addScaledVector(tmpR, side);
  const g = groundHeight(out.x, out.z);
  out.y = Math.max(a.y + up, g + 0.9 + Math.max(0, up - 1.5) * 0);
  return out;
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
export interface ShotState {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  time: number;
  cs: number;
}

/** Evaluate the camera at story position u.
 *  The spline runs through ROAD-RELATIVE coordinates (distance along the road, sideways, height) and only then
 *  becomes a world position — so the camera follows the road around its bends instead of cutting across country. */
export function evalShots(shots: Waypoint[], u: number, out: ShotState): ShotState {
  const n = shots.length;
  let i = 0;
  while (i < n - 2 && u >= shots[i + 1].u) i++;
  const a = shots[i];
  const b = shots[i + 1];
  const t = Math.min(1, Math.max(0, (u - a.u) / (b.u - a.u)));
  const w = (k: number) => shots[Math.min(n - 1, Math.max(0, k))];
  const track = (which: "cam" | "look", v: THREE.Vector3) => {
    const c = [0, 1, 2].map((j) => catmull(w(i - 1)[which][j], a[which][j], b[which][j], w(i + 2)[which][j], t));
    return roadPoint(c[0], c[1], c[2], v);
  };
  track("cam", out.pos);
  track("look", out.target);
  clearTerrain(out.pos, out.target);
  const S = (key: "fov" | "time" | "cs") => catmull(w(i - 1)[key], a[key], b[key], w(i + 2)[key], t);
  out.fov = S("fov");
  out.time = S("time");
  out.cs = S("cs");
  return out;
}

/** If terrain rises into the line between the camera and its target, lift the camera over it. */
export function clearTerrain(pos: THREE.Vector3, target: THREE.Vector3) {
  let lift = 0;
  for (let t = 0.05; t < 0.95; t += 0.06) {
    const x = pos.x + (target.x - pos.x) * t;
    const z = pos.z + (target.z - pos.z) * t;
    const rayY = pos.y + (target.y - pos.y) * t;
    const need = groundHeight(x, z) + 0.55 - rayY;
    if (need > 0) lift = Math.max(lift, need / (1 - t));
  }
  pos.y += lift;
}

export function fixedShot(w: Waypoint, out: ShotState): ShotState {
  roadPoint(w.cam[0], w.cam[1], w.cam[2], out.pos);
  roadPoint(w.look[0], w.look[1], w.look[2], out.target);
  out.fov = w.fov;
  out.time = w.time;
  out.cs = w.cs;
  return out;
}
