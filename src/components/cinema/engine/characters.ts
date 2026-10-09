import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { furBump } from "./textures";

export interface CastContext {
  dt: number;
  time: number;
  /** distance the character travelled this frame (m) — drives the leg cycle */
  step: number;
  /** 0..1, how "on the move" the character is right now (eases in and out) */
  walk: number;
  talking: boolean;
  /** pointer in -1..1, so heads can glance at the viewer */
  pointer: THREE.Vector2;
  glow: number;
}

export interface Character {
  group: THREE.Group;
  /** point-light + emissive handle for the lantern (if any) */
  lantern?: { light: THREE.PointLight; glass: THREE.MeshStandardMaterial };
  update(c: CastContext): void;
}

const sphereGeo = new THREE.SphereGeometry(1, 40, 28);
let _bump: THREE.Texture | null = null;
const bump = () => (_bump ??= furBump());

function fur(color: string, sheen = "#ffe6c0", rough = 0.88) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(sheen), bumpMap: bump(), bumpScale: 0.9 });
}
function cloth(color: string) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.82, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffffff") });
}
const eyeMat = () => new THREE.MeshPhysicalMaterial({ color: "#120d0b", roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 });
const white = () => new THREE.MeshBasicMaterial({ color: "#ffffff" });
const leather = () => new THREE.MeshStandardMaterial({ color: "#7a4724", roughness: 0.65 });

function ell(parent: THREE.Object3D, mat: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(sphereGeo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function capsule(parent: THREE.Object3D, mat: THREE.Material, r: number, len: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 18), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function eye(parent: THREE.Object3D, x: number, y: number, z: number, r: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  ell(g, eyeMat(), r, r * 1.12, r * 0.7);
  const hl = ell(g, white(), r * 0.3, r * 0.3, r * 0.25, r * 0.32, r * 0.42, r * 0.58);
  hl.castShadow = false;
  const hl2 = ell(g, white(), r * 0.14, r * 0.14, r * 0.12, -r * 0.3, -r * 0.3, r * 0.62);
  hl2.castShadow = false;
  parent.add(g);
  return g;
}

function makeLantern(): { group: THREE.Group; light: THREE.PointLight; glass: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: "#ffd98a", emissive: new THREE.Color("#ffb23d"), emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: "#2e2118", roughness: 0.5, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.2, 18), glass);
  group.add(body);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.07, 18), metal);
  top.position.y = 0.135;
  group.add(top);
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 18), metal);
  bot.position.y = -0.11;
  group.add(bot);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.007, 8, 20, Math.PI), metal);
  handle.position.y = 0.16;
  group.add(handle);
  const light = new THREE.PointLight("#ffc064", 0.8, 6, 2);
  group.add(light);
  return { group, light, glass };
}

function satchel(parent: THREE.Object3D, side: number, y: number, scale = 1) {
  const g = new THREE.Group();
  const bag = new THREE.Mesh(new RoundedBoxGeometry(0.36 * scale, 0.28 * scale, 0.13 * scale, 4, 0.04), leather());
  bag.castShadow = true;
  g.add(bag);
  const flap = new THREE.Mesh(new RoundedBoxGeometry(0.37 * scale, 0.14 * scale, 0.14 * scale, 3, 0.04), new THREE.MeshStandardMaterial({ color: "#945a31", roughness: 0.6 }));
  flap.position.y = 0.09 * scale;
  g.add(flap);
  const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.03 * scale, 12, 10), new THREE.MeshStandardMaterial({ color: "#f1cf6a", metalness: 0.9, roughness: 0.25 }));
  clasp.position.set(0, 0.04 * scale, 0.075 * scale);
  g.add(clasp);
  g.position.set(side * 0.55, y, 0.02);
  g.rotation.z = side * 0.18;
  parent.add(g);
  return g;
}

/* ───────────────────────────── BEAR (Teddy) ───────────────────────────── */
export function buildBear(): Character {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const brown = fur("#b9763f", "#ffd9a8");
  const dark = fur("#8e5528", "#e0b080");
  const cream = fur("#f1dbb6", "#fff5df", 0.9);
  const red = cloth("#cf3f33");

  ell(body, brown, 0.6, 0.66, 0.54, 0, 0.98, 0); // torso
  ell(body, cream, 0.43, 0.5, 0.18, 0, 0.92, 0.38); // belly patch
  // head
  const head = new THREE.Group();
  head.position.set(0, 1.78, 0.04);
  body.add(head);
  ell(head, brown, 0.55, 0.5, 0.5);
  ell(head, cream, 0.27, 0.2, 0.22, 0, -0.13, 0.4); // muzzle
  ell(head, new THREE.MeshPhysicalMaterial({ color: "#2a1912", roughness: 0.25, clearcoat: 0.8 }), 0.085, 0.062, 0.07, 0, -0.04, 0.58); // nose
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: "#3a2218", roughness: 0.5 }));
  smile.position.set(0, -0.15, 0.55);
  smile.rotation.z = Math.PI;
  head.add(smile);
  for (const s of [-1, 1]) {
    eye(head, s * 0.2, 0.1, 0.43, 0.075);
    ell(head, new THREE.MeshStandardMaterial({ color: "#ff9d92", roughness: 0.7, transparent: true, opacity: 0.55 }), 0.1, 0.06, 0.03, s * 0.32, -0.08, 0.4);
    const ear = new THREE.Group();
    ear.position.set(s * 0.4, 0.37, -0.02);
    ell(ear, brown, 0.19, 0.19, 0.14);
    ell(ear, cream, 0.11, 0.11, 0.06, 0, 0, 0.1);
    head.add(ear);
  }
  // arms (pivot at the shoulder so they swing naturally)
  const armL = new THREE.Group();
  armL.position.set(-0.62, 1.38, 0.02);
  capsule(armL, brown, 0.16, 0.36, 0, -0.27, 0);
  ell(armL, dark, 0.15, 0.13, 0.15, 0, -0.62, 0.02);
  body.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0.62, 1.38, 0.02);
  capsule(armR, brown, 0.16, 0.36, 0, -0.27, 0);
  ell(armR, dark, 0.15, 0.13, 0.15, 0, -0.62, 0.02);
  body.add(armR);
  const lan = makeLantern();
  lan.group.position.set(0.02, -0.82, 0.05);
  armR.add(lan.group);
  // legs
  const legL = new THREE.Group();
  legL.position.set(-0.27, 0.62, 0);
  capsule(legL, brown, 0.2, 0.2, 0, -0.2, 0);
  ell(legL, dark, 0.23, 0.14, 0.32, 0, -0.5, 0.1);
  ell(legL, cream, 0.15, 0.06, 0.2, 0, -0.55, 0.2);
  root.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.27;
  root.add(legR);
  // scarf
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.115, 14, 36), red);
  scarf.position.set(0, 1.5, 0.02);
  scarf.rotation.x = Math.PI / 2 + 0.12;
  scarf.scale.set(1.05, 0.98, 1.1);
  scarf.castShadow = true;
  body.add(scarf);
  const tail = new THREE.Group();
  tail.position.set(-0.22, 1.46, -0.3);
  const tailMesh = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.55, 0.06, 3, 0.025), red);
  tailMesh.position.y = -0.26;
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  body.add(tail);
  // gear
  satchel(body, -1, 0.95, 1.05);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.15, 0.03), leather());
  strap.position.set(0, 1.0, 0.31);
  strap.rotation.z = 0.62;
  body.add(strap);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.62, 18), cloth("#6f9a62"));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0.02, 1.56, -0.42);
  roll.castShadow = true;
  body.add(roll);
  const pack = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.55, 0.22, 4, 0.08), cloth("#9a6b3d"));
  pack.position.set(0, 1.12, -0.42);
  pack.castShadow = true;
  body.add(pack);

  let phase = 0;
  const hy = new THREE.Vector2();
  return {
    group: root,
    lantern: { light: lan.light, glass: lan.glass },
    update(c) {
      phase += c.step * 3.3;
      const w = c.walk;
      const s = Math.sin(phase);
      const idle = Math.sin(c.time * 1.6);
      legL.rotation.x = s * 0.62 * w;
      legR.rotation.x = -s * 0.62 * w;
      armL.rotation.x = -s * 0.5 * w + (1 - w) * 0.03 * idle;
      armR.rotation.x = s * 0.35 * w - 0.45 * (1 - w * 0.5) + (1 - w) * 0.05 * idle;
      armR.rotation.z = -0.32;
      body.position.y = Math.abs(s) * 0.07 * w + idle * 0.012 * (1 - w);
      body.rotation.z = s * 0.05 * w;
      body.scale.y = 1 + idle * 0.008;
      // glance toward the viewer; nod when talking
      hy.lerp(c.pointer, 1 - Math.pow(0.002, c.dt));
      head.rotation.y = THREE.MathUtils.clamp(hy.x * 0.5, -0.6, 0.6);
      head.rotation.x = -hy.y * 0.25 + (c.talking ? Math.sin(c.time * 9) * 0.06 : 0);
      head.rotation.z = Math.sin(c.time * 1.1) * 0.03 + s * 0.03 * w;
      tail.rotation.x = 0.25 + Math.sin(c.time * 3 + 1) * 0.12 + w * 0.35;
      tail.rotation.z = Math.sin(c.time * 2.4) * 0.1;
      if (c.talking) root.position.y += 0; // posture handled by the world (hop)
      lan.light.intensity = 0.7 + c.glow * 5 + Math.sin(c.time * 7) * 0.1;
      lan.glass.emissiveIntensity = 0.8 + c.glow * 2.2;
    },
  };
}

/* ───────────────────────────── FOX (Juno) ───────────────────────────── */
export function buildFox(): Character {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const orange = fur("#e9722a", "#ffc890");
  const sock = fur("#3a2519", "#9a7656", 0.9);
  const cream = fur("#fff3e0", "#ffffff", 0.9);
  const green = cloth("#3f9a63");

  ell(body, orange, 0.46, 0.55, 0.42, 0, 0.82, 0);
  ell(body, cream, 0.32, 0.4, 0.16, 0, 0.78, 0.3);
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0.05);
  body.add(head);
  ell(head, orange, 0.5, 0.42, 0.44);
  // cheek ruffs
  for (const s of [-1, 1]) {
    ell(head, cream, 0.26, 0.2, 0.3, s * 0.3, -0.12, 0.1);
    eye(head, s * 0.19, 0.1, 0.38, 0.082);
    const ear = new THREE.Group();
    ear.position.set(s * 0.3, 0.42, -0.04);
    ear.rotation.z = -s * 0.28;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 24), orange);
    outer.castShadow = true;
    ear.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 20), new THREE.MeshStandardMaterial({ color: "#3a2519", roughness: 0.8 }));
    inner.position.set(0, -0.06, 0.07);
    ear.add(inner);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 18), sock);
    tip.position.y = 0.22;
    ear.add(tip);
    head.add(ear);
  }
  // snout
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.48, 28), cream);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.09, 0.52);
  snout.scale.set(1, 1, 0.78);
  snout.castShadow = true;
  head.add(snout);
  ell(head, new THREE.MeshPhysicalMaterial({ color: "#1b1210", roughness: 0.18, clearcoat: 1 }), 0.065, 0.055, 0.06, 0, -0.04, 0.78);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: "#3a2218" }));
  smile.position.set(0, -0.16, 0.62);
  smile.rotation.z = Math.PI;
  head.add(smile);
  // arms
  const armL = new THREE.Group();
  armL.position.set(-0.5, 1.15, 0.02);
  capsule(armL, orange, 0.115, 0.3, 0, -0.22, 0);
  ell(armL, sock, 0.12, 0.1, 0.12, 0, -0.5, 0.02);
  body.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0.5, 1.15, 0.02);
  capsule(armR, orange, 0.115, 0.3, 0, -0.22, 0);
  ell(armR, sock, 0.12, 0.1, 0.12, 0, -0.5, 0.02);
  body.add(armR);
  // legs
  const legL = new THREE.Group();
  legL.position.set(-0.2, 0.56, 0);
  capsule(legL, orange, 0.14, 0.14, 0, -0.14, 0);
  capsule(legL, sock, 0.15, 0.1, 0, -0.36, 0);
  ell(legL, sock, 0.17, 0.11, 0.26, 0, -0.48, 0.07);
  root.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  root.add(legR);
  // tail: chain of growing ellipsoids with a white tip
  const tail = new THREE.Group();
  tail.position.set(0, 0.6, -0.34);
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = tail;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, 0.0, i === 0 ? 0 : -0.2);
    const r = 0.14 + Math.sin((i / 4) * Math.PI) * 0.12 + i * 0.012;
    ell(seg, i === 4 ? cream : orange, r, r, r * 1.35, 0, 0, -0.08);
    parent.add(seg);
    segs.push(seg);
    parent = seg;
  }
  tail.rotation.x = -0.55;
  body.add(tail);
  // scarf + gear
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 14, 32), green);
  scarf.position.set(0, 1.26, 0.03);
  scarf.rotation.x = Math.PI / 2 + 0.1;
  scarf.castShadow = true;
  body.add(scarf);
  const stail = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.5, 0.05, 3, 0.02), green);
  stail.position.set(-0.2, 1.0, -0.26);
  stail.castShadow = true;
  body.add(stail);
  satchel(body, 1, 0.78, 0.9);
  const map = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 14), cloth("#f2e2b4"));
  map.rotation.z = Math.PI / 2.4;
  map.position.set(-0.46, 0.92, 0.16);
  map.castShadow = true;
  body.add(map);

  let phase = 1.7;
  const hy = new THREE.Vector2();
  return {
    group: root,
    update(c) {
      phase += c.step * 3.5;
      const w = c.walk;
      const s = Math.sin(phase);
      const idle = Math.sin(c.time * 1.9 + 1);
      legL.rotation.x = s * 0.66 * w;
      legR.rotation.x = -s * 0.66 * w;
      armL.rotation.x = -s * 0.5 * w;
      armR.rotation.x = s * 0.5 * w + (1 - w) * 0.04 * idle;
      body.position.y = Math.abs(s) * 0.06 * w + idle * 0.01 * (1 - w);
      hy.lerp(c.pointer, 1 - Math.pow(0.003, c.dt));
      head.rotation.y = THREE.MathUtils.clamp(hy.x * 0.55, -0.65, 0.65);
      head.rotation.x = -hy.y * 0.25 + (c.talking ? Math.sin(c.time * 10) * 0.06 : 0);
      head.rotation.z = Math.sin(c.time * 1.3 + 2) * 0.04;
      segs.forEach((sg, i) => {
        sg.rotation.y = Math.sin(c.time * 2.2 - i * 0.7) * 0.22;
        sg.rotation.x = 0.06 + Math.sin(c.time * 1.7 - i * 0.6) * 0.04;
      });
      tail.rotation.z = Math.sin(c.time * 1.4) * 0.12;
    },
  };
}

/* ───────────────────────────── OWL (Pip) ───────────────────────────── */
export function buildOwl(): Character {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const brown = fur("#8d6a45", "#e6c79a");
  const dark = fur("#65472b", "#c9a074");
  const cream = fur("#f2dfba", "#fff6e2", 0.9);
  const orange = new THREE.MeshStandardMaterial({ color: "#f19a35", roughness: 0.5 });

  ell(body, brown, 0.4, 0.46, 0.34, 0, 0, 0);
  ell(body, cream, 0.27, 0.34, 0.14, 0, -0.06, 0.24);
  for (let r = 0; r < 3; r++) for (let k = -1; k <= 1; k++) ell(body, dark, 0.045, 0.028, 0.03, k * 0.09 + (r % 2) * 0.045, -0.12 + r * -0.1, 0.35).castShadow = false;
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.06);
  body.add(head);
  ell(head, brown, 0.38, 0.3, 0.3);
  for (const s of [-1, 1]) {
    ell(head, cream, 0.17, 0.17, 0.08, s * 0.14, 0.02, 0.26);
    const e = new THREE.Group();
    e.position.set(s * 0.14, 0.02, 0.31);
    ell(e, new THREE.MeshStandardMaterial({ color: "#fffdf4", roughness: 0.3 }), 0.1, 0.1, 0.05);
    ell(e, eyeMat(), 0.065, 0.07, 0.05, 0, 0, 0.03);
    ell(e, white(), 0.02, 0.02, 0.02, 0.02, 0.03, 0.07).castShadow = false;
    head.add(e);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 14), dark);
    tuft.position.set(s * 0.22, 0.28, 0);
    tuft.rotation.z = -s * 0.4;
    head.add(tuft);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 14), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.03, 0.36);
  head.add(beak);
  // wings: flat paddles on shoulder pivots (flap continuously — the owl hovers)
  const wingL = new THREE.Group();
  wingL.position.set(-0.34, 0.1, 0);
  const wl = ell(wingL, dark, 0.34, 0.06, 0.24, -0.3, 0, 0);
  wl.castShadow = true;
  body.add(wingL);
  const wingR = new THREE.Group();
  wingR.position.set(0.34, 0.1, 0);
  ell(wingR, dark, 0.34, 0.06, 0.24, 0.3, 0, 0);
  body.add(wingR);
  // coin pouch + feet
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), leather());
  pouch.scale.set(1, 0.9, 0.8);
  pouch.position.set(0.18, -0.28, 0.2);
  body.add(pouch);
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.015, 20), new THREE.MeshStandardMaterial({ color: "#f1cf6a", metalness: 0.9, roughness: 0.25 }));
  coin.position.set(0.18, -0.2, 0.27);
  coin.rotation.x = Math.PI / 2;
  body.add(coin);
  for (const s of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.07, 4, 8), orange);
    foot.position.set(s * 0.1, -0.5, 0.06);
    body.add(foot);
  }

  const hy = new THREE.Vector2();
  return {
    group: root,
    update(c) {
      const flap = Math.sin(c.time * 17) * (0.55 + c.walk * 0.25);
      wingL.rotation.z = flap + 0.3;
      wingR.rotation.z = -flap - 0.3;
      body.position.y = Math.sin(c.time * 2.3) * 0.06;
      body.rotation.x = 0.1 + c.walk * 0.1;
      hy.lerp(c.pointer, 1 - Math.pow(0.003, c.dt));
      head.rotation.y = THREE.MathUtils.clamp(hy.x * 0.7, -0.7, 0.7);
      head.rotation.x = -hy.y * 0.2 - 0.1 + (c.talking ? Math.sin(c.time * 9) * 0.07 : 0);
    },
  };
}
