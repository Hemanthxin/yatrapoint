import * as THREE from "three";

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}
function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Fine speckle used as a bump map so fur reads as fuzzy instead of plastic. */
export function furBump(): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 90 + Math.random() * 110;
    g.fillStyle = `rgb(${v},${v},${v})`;
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    g.fillRect(x, y, 1 + Math.random() * 1.6, 2 + Math.random() * 3.2);
  }
  const t = tex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

/** Soft round glow — suns, lanterns, fireflies, bokeh. */
export function glowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.2, "rgba(255,255,255,0.65)");
  gr.addColorStop(0.5, "rgba(255,255,255,0.18)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}

/** A fluffy cumulus puff. */
export function cloudTexture(seed = 1): THREE.CanvasTexture {
  const [c, g] = canvas(256, 160);
  let s = seed * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd() * 176;
    const y = 60 + rnd() * 50 - Math.abs(x - 128) * 0.12;
    const r = 24 + rnd() * 34;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,0.55)");
    gr.addColorStop(0.6, "rgba(255,255,255,0.22)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // flat-ish underside
  const fade = g.createLinearGradient(0, 100, 0, 160);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = fade;
  g.fillRect(0, 100, 256, 60);
  return tex(c);
}

/** Four-point sparkle star (the floating stars in the reference). */
export function starTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  gr.addColorStop(0, "rgba(255,246,200,1)");
  gr.addColorStop(0.25, "rgba(255,222,120,0.55)");
  gr.addColorStop(1, "rgba(255,200,80,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(255,250,225,0.95)";
  g.beginPath();
  g.moveTo(64, 6);
  g.quadraticCurveTo(68, 60, 122, 64);
  g.quadraticCurveTo(68, 68, 64, 122);
  g.quadraticCurveTo(60, 68, 6, 64);
  g.quadraticCurveTo(60, 60, 64, 6);
  g.fill();
  return tex(c);
}

/** A glassy bubble with a travel icon inside (map, compass, mountain, lantern…). */
export function bubbleIcon(emoji: string): THREE.CanvasTexture {
  const [c, g] = canvas(256);
  g.font = "120px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 128, 136);
  return tex(c);
}

/** Vertical soft gradient for light shafts. */
export function shaftTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(255,255,255,0.9)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 256);
  const mask = g.createLinearGradient(0, 0, 64, 0);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(0.5, "rgba(0,0,0,0)");
  mask.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = mask;
  g.fillRect(0, 0, 64, 256);
  return tex(c);
}

/** Engraved rune on the keystone. */
export function runeTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128);
  g.strokeStyle = "#fff2b8";
  g.lineWidth = 7;
  g.lineCap = "round";
  g.shadowColor = "#ffd060";
  g.shadowBlur = 18;
  g.beginPath();
  g.arc(64, 64, 34, 0, Math.PI * 2);
  g.moveTo(64, 26);
  g.lineTo(76, 58);
  g.lineTo(100, 60);
  g.lineTo(80, 76);
  g.lineTo(88, 100);
  g.lineTo(64, 84);
  g.lineTo(40, 100);
  g.lineTo(48, 76);
  g.lineTo(28, 60);
  g.lineTo(52, 58);
  g.closePath();
  g.stroke();
  return tex(c);
}

/** Wooden sign board with lettering. */
export function signTexture(label: string): THREE.CanvasTexture {
  const [c, g] = canvas(512, 160);
  const gr = g.createLinearGradient(0, 0, 0, 160);
  gr.addColorStop(0, "#f0d49a");
  gr.addColorStop(1, "#d3a55a");
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 160);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(110,70,20,${0.05 + Math.random() * 0.08})`;
    g.beginPath();
    g.moveTo(0, Math.random() * 160);
    g.lineTo(512, Math.random() * 160);
    g.stroke();
  }
  g.fillStyle = "#3a2410";
  g.font = "700 62px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, 256, 84, 470);
  return tex(c);
}
