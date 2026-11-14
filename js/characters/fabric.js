/* fabric.js — realistic cloth for the character wardrobe.
   1) Weave textures: every garment gets a procedurally drawn fabric (cotton, denim twill,
      knit rib, silk/satin, wool, canvas, stretch knit) with a matching bump map, so clothes
      are no longer flat colour.
   2) Wind: cloth materials are patched (onBeforeCompile) so hems, skirts, robes and loose
      sleeves billow downwind and ripple; a soft sheen glints along the folds and pulses with
      the gusts. Wind strength follows the current Weather season (Harmattan, storms, ...).
   Stiff garments (jeans, leggings, tees) get a tiny amount; skirts/dresses/agbada a lot. */
import * as THREE from "three";

/* ── garment style → fabric + how much it moves ── */
const TOP_FABRIC = {
  tshirt: "cotton", longsleeve: "cotton", polo: "pique", tank: "cotton", singlet: "cotton", croptop: "knit",
  vneck: "cotton", tube: "stretch", hoodie: "fleece", sweater: "knit", turtleneck: "knit", jersey: "mesh",
  jacket: "wool", bomber: "satin", suit: "wool", dashiki: "cotton", kaftan: "silk", agbada: "silk", dress: "silk",
};
const BOTTOM_FABRIC = {
  jeans: "denim", shorts: "cotton", tracksuit: "fleece", baggy: "cotton", cargo: "canvas", bermuda: "canvas",
  leggings: "stretch", skirt: "silk", miniskirt: "silk", palazzo: "silk",
};
const TOP_WIND = { dress: 1.0, agbada: 1.0, kaftan: 0.85, dashiki: 0.55, jersey: 0.3, bomber: 0.22, jacket: 0.22, hoodie: 0.2,
  tshirt: 0.2, longsleeve: 0.18, vneck: 0.2, polo: 0.15, sweater: 0.12, croptop: 0.12, tank: 0.18, singlet: 0.18, tube: 0.1,
  turtleneck: 0.1, suit: 0.12 };
const BOTTOM_WIND = { skirt: 1.0, miniskirt: 0.8, palazzo: 0.95, baggy: 0.35, cargo: 0.22, bermuda: 0.2, tracksuit: 0.15,
  shorts: 0.15, jeans: 0.05, leggings: 0.0 };
const SHEEN = { silk: 0.9, satin: 0.9, stretch: 0.55, mesh: 0.35, pique: 0.25, cotton: 0.22, knit: 0.18, fleece: 0.15,
  denim: 0.12, canvas: 0.1, wool: 0.12 };
export const topFabric = (s) => TOP_FABRIC[s] || "cotton";
export const bottomFabric = (s) => BOTTOM_FABRIC[s] || "cotton";
export const topWind = (s) => (TOP_WIND[s] != null ? TOP_WIND[s] : 0.15);
export const bottomWind = (s) => (BOTTOM_WIND[s] != null ? BOTTOM_WIND[s] : 0.1);
export const sheenOf = (kind) => (SHEEN[kind] != null ? SHEEN[kind] : 0.2);

/* ── shared wind state (one rAF loop for the whole game) ── */
const U = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.4, 0.15) }, uGust: { value: 0.4 } };
let _loop = false;
function startLoop() {
  if (_loop || typeof requestAnimationFrame === "undefined") return;
  _loop = true;
  const step = () => {
    const t = performance.now() / 1000;
    let kmh = 12;
    try { const w = window.__ph3d_weather && window.__ph3d_weather.current(); if (w && Number.isFinite(w.wind)) kmh = w.wind; if (w && w.rain) kmh += 8; } catch (e) {}
    const strength = Math.min(1.3, Math.max(0.18, kmh / 26));
    const ang = 0.9 + Math.sin(t * 0.05) * 0.7;
    U.uTime.value = t;
    U.uWind.value.set(Math.cos(ang) * strength, Math.sin(ang) * strength);
    U.uGust.value = Math.min(1, Math.max(0, 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.91 + 1.0)));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* Patch a cloth material once; per-style amounts live in material.userData uniforms. */
export function enableClothFX(mat) {
  if (!mat || mat.userData.clothFX) return mat;
  mat.userData.clothFX = true;
  mat.userData.uAmp = { value: 0 };
  mat.userData.uSheen = { value: 0.2 };
  mat.customProgramCacheKey = () => "clothfx-v1";
  mat.needsUpdate = true;      /* recompile if it was already drawn once */
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uGust = U.uGust;
    sh.uniforms.uAmp = mat.userData.uAmp; sh.uniforms.uSheen = mat.userData.uSheen;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform vec2 uWind;\nuniform float uGust;\nuniform float uAmp;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
{
  float wH = clamp(-position.y * 1.7, 0.0, 1.0);
  wH = wH * wH * (3.0 - 2.0 * wH);
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float ph = uTime * 2.1 + wp.x * 3.1 + wp.z * 2.3 + wp.y * 4.0;
  float flutter = sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.4;
  float push = (0.35 + 0.65 * uGust) * length(uWind);
  vec3 wl = transpose(mat3(modelMatrix)) * vec3(uWind.x, 0.0, uWind.y);
  float k = uAmp * wH;
  transformed += wl * (push * 0.05 * k);
  transformed += normal * (flutter * 0.013 * k * (0.4 + push));
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uGust;\nuniform float uSheen;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
{
  vec3 vd = normalize(vViewPosition);
  float rim = pow(1.0 - abs(dot(normalize(normal), vd)), 2.5);
  float wave = 0.5 + 0.5 * sin(uTime * 1.6 + vViewPosition.y * 9.0 + vViewPosition.x * 5.0);
  float glint = rim * (0.35 + 0.65 * wave) * (0.35 + 0.65 * uGust);
  totalEmissiveRadiance += diffuseColor.rgb * glint * uSheen;
}`);
  };
  startLoop();
  return mat;
}
export function setClothParams(mat, amp, sheen) {
  if (!mat || !mat.userData.uAmp) return;
  mat.userData.uAmp.value = amp;
  mat.userData.uSheen.value = sheen;
}

/* ── weave drawing ── */
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/* draws the thread structure onto g (S×S). mode "color": faint multiply-style marks over the
   dyed cloth; mode "bump": height map on mid grey. */
function drawWeave(g, S, kind, mode) {
  const bump = mode === "bump";
  const R = rng(kind.length * 977 + 13);
  const dark = (a) => (bump ? `rgba(0,0,0,${Math.min(1, a * 4)})` : `rgba(0,0,0,${a})`);
  const light = (a) => (bump ? `rgba(255,255,255,${Math.min(1, a * 4)})` : `rgba(255,255,255,${a})`);
  const line = (x1, y1, x2, y2, w, style) => { g.strokeStyle = style; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  if (kind === "denim") {
    for (let i = -S; i < S * 2; i += 3) line(i, 0, i + S, S, 1.4, dark(0.16));          /* twill diagonal */
    for (let i = -S + 1; i < S * 2; i += 3) line(i, 0, i + S, S, 0.8, light(0.10));
    for (let n = 0; n < 420; n++) { const x = R() * S, y = R() * S; line(x, y, x, y + 2 + R() * 3, 0.8, light(0.18 + R() * 0.12)); } /* slub flecks */
  } else if (kind === "knit" || kind === "fleece") {
    const st = kind === "knit" ? 8 : 5;
    for (let y = 0; y < S; y += st) for (let x = 0; x < S; x += st) {
      line(x, y, x + st / 2, y + st * 0.8, 1.5, dark(kind === "knit" ? 0.20 : 0.10));
      line(x + st / 2, y + st * 0.8, x + st, y, 1.5, dark(kind === "knit" ? 0.20 : 0.10));
      line(x + 1, y + 1, x + st / 2 + 1, y + st * 0.8 + 1, 0.8, light(0.12));
    }
  } else if (kind === "silk" || kind === "satin") {
    for (let i = -S; i < S * 2; i += 22) { const gr = g.createLinearGradient(i, 0, i + 14, 0); gr.addColorStop(0, light(0)); gr.addColorStop(0.5, light(0.09)); gr.addColorStop(1, light(0)); g.fillStyle = gr; g.save(); g.translate(0, 0); g.transform(1, 0, 0.6, 1, 0, 0); g.fillRect(i, 0, 14, S); g.restore(); }
    for (let y = 0; y < S; y += 2) line(0, y, S, y, 0.5, dark(0.035));                  /* fine filament */
  } else if (kind === "wool") {
    for (let y = 0; y < S; y += 6) for (let x = 0; x < S; x += 6) { const f = ((x + y) / 6) % 2; line(x, y + (f ? 0 : 6), x + 6, y + (f ? 6 : 0), 1.2, dark(0.13)); }
  } else if (kind === "canvas") {
    for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? dark(0.10) : light(0.06); g.fillRect(x, y, 3, 3); }
  } else if (kind === "stretch" || kind === "mesh") {
    const st = kind === "mesh" ? 6 : 3;
    for (let y = 0; y < S; y += st) for (let x = 0; x < S; x += st) { g.fillStyle = dark(kind === "mesh" ? 0.20 : 0.08); g.beginPath(); g.arc(x + st / 2, y + st / 2, st * (kind === "mesh" ? 0.32 : 0.28), 0, 7); g.fill(); }
  } else if (kind === "pique") {
    for (let y = 0; y < S; y += 5) for (let x = (y / 5) % 2 ? 0 : 3; x < S; x += 6) { g.fillStyle = dark(0.14); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 2.5); g.lineTo(x, y + 5); g.closePath(); g.fill(); }
  } else {                                                                               /* cotton plain weave */
    for (let i = 0; i < S; i += 2) { line(i, 0, i, S, 0.9, dark(0.07)); line(0, i, S, i, 0.9, dark(0.07)); }
    for (let i = 1; i < S; i += 4) { line(i, 0, i, S, 0.6, light(0.06)); }
  }
}

function noise(g, S, amount, seed) {
  const R = rng(seed), img = g.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}

const _cache = new Map();
/* patternCanvas: the dyed/pattern art (128px, from the wardrobe). Returns { map, bump } textures. */
export function makeFabricTextures(patternCanvas, key, kind) {
  const hit = _cache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true; g.drawImage(patternCanvas, 0, 0, S, S);
  drawWeave(g, S, kind, "color");
  noise(g, S, kind === "silk" || kind === "satin" ? 6 : 16, key.length * 31 + 5);
  const b = document.createElement("canvas"); b.width = b.height = S;
  const gb = b.getContext("2d");
  gb.fillStyle = "#808080"; gb.fillRect(0, 0, S, S);
  drawWeave(gb, S, kind, "bump");
  noise(gb, S, 18, key.length * 17 + 9);
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const out = { map: mk(c, true), bump: mk(b, false) };
  _cache.set(key, out);
  if (_cache.size > 120) {                       /* evict the oldest and free its GPU memory */
    const k0 = _cache.keys().next().value, old = _cache.get(k0);
    _cache.delete(k0); try { old.map.dispose(); old.bump.dispose(); } catch (e) {}
  }
  return out;
}
