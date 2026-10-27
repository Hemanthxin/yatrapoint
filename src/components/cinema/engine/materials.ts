import * as THREE from "three";

/* Real-world surface textures (Poly Haven, CC0) and the shader patches that put them on the terrain, rocks and trunks. */

const loader = new THREE.TextureLoader();

function placeholder(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** A sampler uniform that starts grey and swaps in the real texture when it arrives — no recompile, no black flash. */
export function texUniform(url: string, srgb = true): THREE.IUniform<THREE.Texture> {
  const u = { value: placeholder() as THREE.Texture };
  loader.load(url, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    u.value = t;
  });
  return u;
}

export const TEX = {
  grass: "/cinema/tex/grass_diff.jpg",
  dirt: "/cinema/tex/dirt_diff.jpg",
  rock: "/cinema/tex/rock_diff.jpg",
  bark: "/cinema/tex/bark_diff.jpg",
  plaster: "/cinema/tex/plaster_diff.jpg",
  roof: "/cinema/tex/roof_diff.jpg",
  planks: "/cinema/tex/planks_diff.jpg",
  linen: "/cinema/tex/linen_diff.jpg",
};

/**
 * The land: grass, dirt track, rock and snow blended per vertex from real photographs.
 * `aMat` = (rock, dirt, snow, unused); the vertex colour is only a gentle tint for large-scale variation.
 */
export function terrainMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const U = { tGrass: texUniform(TEX.grass), tDirt: texUniform(TEX.dirt), tRock: texUniform(TEX.rock) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aMat;\nvarying vec4 vMat;\nvarying vec3 vWP;\nvarying vec3 vWN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMat = aMat; vWP = (modelMatrix * vec4(position, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * normal);");
    sh.fragmentShader =
      "uniform sampler2D tGrass, tDirt, tRock;\nvarying vec4 vMat;\nvarying vec3 vWP;\nvarying vec3 vWN;\n" +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        `
        vec2 p = vWP.xz;
        float macro = texture2D(tGrass, p / 47.0 + 0.31).g;
        vec3 g = texture2D(tGrass, p / 5.2).rgb * (0.55 + 0.95 * macro);
        g = mix(g, texture2D(tGrass, p / 1.3).rgb * 1.05, 0.25);
        vec3 d = texture2D(tDirt, p / 3.6).rgb * (0.7 + 0.6 * texture2D(tDirt, p / 29.0).g);
        vec3 nn = pow(abs(normalize(vWN)), vec3(4.0)); nn /= (nn.x + nn.y + nn.z);
        vec3 r = texture2D(tRock, vWP.zy / 5.0).rgb * nn.x + texture2D(tRock, vWP.xz / 5.0).rgb * nn.y + texture2D(tRock, vWP.xy / 5.0).rgb * nn.z;
        vec3 alb = mix(g, d, clamp(vMat.y, 0.0, 1.0));
        alb = mix(alb, r, clamp(vMat.x, 0.0, 1.0));
        alb = mix(alb, vec3(0.86, 0.88, 0.92), clamp(vMat.z, 0.0, 1.0));
        diffuseColor.rgb = alb * vColor.rgb;
        `,
      );
  };
  return mat;
}

/** Rock: the stone photograph projected from three sides, so it never stretches on a boulder. Works for instanced meshes. */
export function rockMaterial(tint = "#ffffff"): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.92, metalness: 0 });
  const U = { tRock: texUniform(TEX.rock) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvOP = position; vON = normal;");
    sh.fragmentShader =
      "uniform sampler2D tRock;\nvarying vec3 vOP;\nvarying vec3 vON;\n" +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        `
        vec3 nn = pow(abs(normalize(vON)), vec3(3.0)); nn /= (nn.x + nn.y + nn.z);
        vec3 r = texture2D(tRock, vOP.zy * 0.55).rgb * nn.x + texture2D(tRock, vOP.xz * 0.55).rgb * nn.y + texture2D(tRock, vOP.xy * 0.55).rgb * nn.z;
        diffuseColor.rgb *= r * 1.15;
        `,
      );
  };
  return mat;
}

export interface TriOpts {
  tint?: string;
  /** texture repeats per metre */
  scale?: number;
  /** use only the photograph's light and shade, and take the colour from `tint` — for fabric and plaster */
  gray?: boolean;
  /** brightness multiplier on the sample */
  gain?: number;
  roughness?: number;
}

/** Any photograph projected from three sides in object space — fits walls, roofs, logs and canvas without UV work. */
export function triMaterial(url: string, o: TriOpts = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: o.tint ?? "#ffffff", roughness: o.roughness ?? 0.9, metalness: 0 });
  const U = { tTri: texUniform(url), uScale: { value: o.scale ?? 0.5 }, uGain: { value: o.gain ?? 1 } };
  const gray = o.gray ? "1" : "0";
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTP;\nvarying vec3 vTN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTP = position; vTN = normal;");
    sh.fragmentShader =
      "uniform sampler2D tTri; uniform float uScale; uniform float uGain;\nvarying vec3 vTP;\nvarying vec3 vTN;\n" +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        `
        vec3 tn = pow(abs(normalize(vTN)), vec3(3.0)); tn /= (tn.x + tn.y + tn.z);
        vec3 tc = texture2D(tTri, vTP.zy * uScale).rgb * tn.x + texture2D(tTri, vTP.xz * uScale).rgb * tn.y + texture2D(tTri, vTP.xy * uScale).rgb * tn.z;
        #if ${gray}
          float tl = dot(tc, vec3(0.3, 0.59, 0.11));
          tc = vec3(tl);
        #endif
        diffuseColor.rgb *= tc * uGain;
        `,
      );
  };
  return mat;
}
