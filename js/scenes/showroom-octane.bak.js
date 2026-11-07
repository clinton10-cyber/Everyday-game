/* ============================================================
   showroom.js — OCTANE · Boutique Automotive Atelier
   ============================================================
   A reimagined car showroom that reads like a private screening
   room, not a sci-fi HUD.

   AESTHETIC
   ---------
   • Deep charcoal floor, warm brass key light, cream text.
   • Editorial type pairing: Iowan Old Style serif for names,
     SF Mono for specs, system sans for labels.
   • Slow continuous turntable orbit that pauses on drag.
   • Single soft shadow, no floating neon.

   LAYOUT
   ------
   DESKTOP:
     header top · spec sheet right · car rail bottom · car centre.

   MOBILE / SHORT VIEWPORT:
     header top · car middle · rail above spec · spec sheet bottom.
     Customize expands as an inline accordion inside the spec.
     Nothing overlaps.

   LOGIC PRESERVED
   ---------------
   • State.vehicle.model / .body / .rim are set on select or buy.
   • Auth.save({vehicle}) persists the choice.
   • Garage.grantCar adds ownership on purchase.
   • Economy.withdraw deducts on purchase.
   • router.go("city") after buy/select, same as before.
   ============================================================ */

import * as THREE from "three";
import { State } from "../core/state.js";
import { Quality } from "../core/quality.js";
import { Sfx } from "../core/sfx.js";
import { buildGWagon3D } from "../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../vehicles/cybertruck3d.js";
import { buildRangeRover3D } from "../vehicles/rangerover_compound.js";
import { buildMercedes3D } from "../vehicles/mercedes3d.js";
import { buildBMW3D } from "../vehicles/bmw3d.js";
import { buildChiron3D } from "../vehicles/chiron3d.js";
import { buildScrappy3D } from "../vehicles/scrappy3d.js";
import { buildVehicle as buildVehicleSimple, buildHilux } from "../vehicles/models.js";

/* ──────────────────────────────────────────────────────────────
   CATALOG
   ────────────────────────────────────────────────────────────── */
const CARS = [
  { id: "gwagon",     name: "G-Wagon",          tag: "AMG · 4.0L V8 · 577 hp",     price: 48000000,  color: "#24282e" },
  { id: "mercedes",   name: "Mercedes S-Class", tag: "S 580 · 4Matic · 496 hp",    price: 62000000,  color: "#b9c3cd" },
  { id: "cybertruck", name: "Cybertruck",       tag: "Tri-motor · 845 hp",         price: 55000000,  color: "#c4c9d2" },
  { id: "rangerover", name: "Range Rover",      tag: "Autobiography · 523 hp",     price: 71000000,  color: "#f2f4f7" },
  { id: "hilux",      name: "Toyota Hilux",     tag: "2.8 GD-6 · 4×4",             price: 32000000,  color: "#d6dce3" },
  { id: "bmw",        name: "BMW M4",           tag: "Competition · 503 hp",       price: 58000000,  color: "#1f3a93" },
  { id: "chiron",     name: "Bugatti Chiron",   tag: "W16 · 1500 ps · 420 km/h",   price: 280000000, color: "#0e2138" },
  { id: "scrappy",    name: "Scrappy Car",      tag: "Starter · Unbreakable",      price: 0,         color: "#4d6b74" },
];

const BODY_COLORS = [
  "#0d0d0f", "#f2f4f7", "#b8bcc2", "#c0392b", "#1f3a93",
  "#1e8449", "#d4a017", "#7d3c98", "#e67e22", "#16a085",
  "#5d4037", "#00bcd4", "#e91e63", "#37474f",
];
const RIM_COLORS = ["#c9ced6", "#0d0d0f", "#d4af37", "#8e9aa6", "#2b2b2b", "#e8e8e8"];

const FRONT_CORRECTION = {
  gwagon:     Math.PI,
  cybertruck: 0,
  rangerover: 0,
  mercedes:  -Math.PI / 2,
  bmw:       -Math.PI / 2,
  chiron:    -Math.PI / 2,
  hilux:     -Math.PI / 2,
  scrappy:   0,
};

function buildSelectedCar(id, body, rim) {
  switch (id) {
    case "gwagon":     return buildGWagon3D(body, rim);
    case "cybertruck": return buildCybertruck3D(body, rim);
    case "rangerover": return buildRangeRover3D(body, rim);
    case "mercedes":   return buildMercedes3D(body, rim);
    case "bmw":        return buildBMW3D(body, rim);
    case "chiron":     return buildChiron3D(body, rim);
    case "scrappy":    return buildScrappy3D(body, rim);
    case "hilux":      return buildHilux(body, rim);
    default:
      try { return buildVehicleSimple(id, body, rim); }
      catch (e) { return buildGWagon3D(body, rim); }
  }
}

/* ──────────────────────────────────────────────────────────────
   STYLES
   ────────────────────────────────────────────────────────────── */
const CSS_ID = "ph3d-showroom-css";

function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    #ph3d-showroom {
      --ink:       #f5f1e8;
      --ink-soft:  #c9c0ad;
      --ink-faint: #807460;
      --rule:      rgba(245, 241, 232, 0.12);
      --rule-2:    rgba(245, 241, 232, 0.22);
      --surface:   rgba(14, 12, 10, 0.86);
      --surface-2: rgba(22, 18, 14, 0.92);
      --brass:     #d4a656;
      --brass-dim: rgba(212, 166, 86, 0.25);

      --serif: "Iowan Old Style", "Hoefler Text", "Palatino Linotype",
               Palatino, Georgia, serif;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue",
              Helvetica, Arial, sans-serif;
      --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;

      position: fixed; inset: 0; z-index: 25;
      pointer-events: none;
      color: var(--ink);
      font-family: var(--sans);
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* ── Masthead ───────────────────────────────────────── */
    .at-header {
      position: absolute;
      top: calc(env(safe-area-inset-top) + 22px);
      left: 28px; right: 28px;
      display: flex; align-items: center; justify-content: space-between;
      z-index: 4; pointer-events: none;
    }
    .at-brand {
      pointer-events: auto;
      display: flex; align-items: baseline; gap: 12px;
    }
    .at-brand-mark {
      font-family: var(--serif);
      font-style: italic;
      font-size: 26px;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: -0.3px;
    }
    .at-brand-sub {
      font-family: var(--mono);
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--ink-faint);
    }
    .at-close {
      pointer-events: auto;
      background: transparent;
      border: 1.5px solid var(--ink-soft);
      color: var(--ink);
      font-family: var(--mono);
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .at-close:hover {
      background: var(--ink);
      color: #0f0e0c;
      border-color: var(--ink);
    }

    /* ── Drag hint ─────────────────────────────────────── */
    .at-hint {
      position: absolute;
      left: 50%; bottom: 22%;
      transform: translateX(-50%);
      z-index: 3;
      display: flex; align-items: center; gap: 8px;
      padding: 7px 14px;
      background: rgba(10, 8, 6, 0.7);
      border: 1px solid var(--rule-2);
      color: var(--ink-soft);
      font-family: var(--mono);
      font-size: 9px; font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    .at-hint.hide { opacity: 0; }
    .at-hint svg {
      width: 11px; height: 11px;
      animation: atSpin 3.2s linear infinite;
    }
    @keyframes atSpin { to { transform: rotate(360deg); } }

    /* ── Spec sheet — right on desktop ─────────────────── */
    .at-spec {
      position: absolute;
      top: 50%; right: 28px;
      transform: translateY(-50%);
      width: min(28vw, 300px);
      max-height: 74vh;
      z-index: 4;
      background: var(--surface);
      border: 1px solid var(--rule-2);
      border-right: 3px solid var(--brass);
      backdrop-filter: blur(20px) saturate(1.1);
      -webkit-backdrop-filter: blur(20px) saturate(1.1);
      padding: 24px 22px 20px;
      pointer-events: auto;
      display: flex; flex-direction: column;
      overflow-y: auto;
    }
    .at-spec::-webkit-scrollbar { width: 3px; }
    .at-spec::-webkit-scrollbar-thumb { background: var(--rule-2); }

    .at-spec-eyebrow {
      font-family: var(--mono);
      font-size: 9px; font-weight: 600;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--brass);
      margin-bottom: 10px;
    }
    .at-spec-name {
      font-family: var(--serif);
      font-style: italic;
      font-size: 30px;
      font-weight: 600;
      color: var(--ink);
      line-height: 1;
      letter-spacing: -0.4px;
      margin: 0;
    }
    .at-spec-tag {
      font-family: var(--sans);
      font-size: 11px;
      color: var(--ink-soft);
      margin-top: 6px;
      line-height: 1.4;
      letter-spacing: 0.01em;
    }
    .at-spec-divider {
      height: 1px; background: var(--rule);
      margin: 18px 0 16px;
    }
    .at-spec-price-label {
      font-family: var(--mono);
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin-bottom: 4px;
    }
    .at-spec-price {
      font-family: var(--mono);
      font-size: 22px;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: -0.3px;
      font-variant-numeric: tabular-nums;
    }
    .at-spec-price.free {
      color: var(--brass);
      font-family: var(--serif);
      font-style: italic;
      font-size: 20px;
    }
    .at-spec-actions {
      margin-top: 18px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .at-action {
      width: 100%;
      padding: 15px 16px;
      border: none;
      font-family: var(--mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      cursor: pointer;
      transition: transform 0.12s ease, background 0.15s ease,
                  color 0.15s ease, border-color 0.15s ease;
      position: relative;
    }
    .at-action:active:not(:disabled) { transform: scale(0.97); }
    .at-action.buy {
      background: var(--brass);
      color: #17130a;
    }
    .at-action.buy:hover { background: #e6ba6a; }
    .at-action.buy:disabled {
      background: transparent;
      color: var(--ink-faint);
      border: 1px solid var(--rule-2);
      cursor: not-allowed;
    }
    .at-action.select {
      background: var(--ink);
      color: #17130a;
    }
    .at-action.select:hover { background: #ffffff; }
    .at-action.active {
      background: transparent;
      color: var(--brass);
      border: 1px solid var(--brass-dim);
      cursor: default;
    }
    .at-action.active::before {
      content: "●";
      font-size: 8px;
      margin-right: 8px;
      vertical-align: middle;
    }

    .at-custom-toggle {
      width: 100%;
      padding: 12px 0;
      background: transparent;
      border: none;
      border-top: 1px solid var(--rule);
      color: var(--ink-soft);
      font-family: var(--mono);
      font-size: 9px; font-weight: 600;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      cursor: pointer;
      text-align: left;
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 18px;
    }
    .at-custom-toggle:hover { color: var(--ink); }
    .at-custom-toggle .at-chev {
      display: inline-block;
      transition: transform 0.2s ease;
      font-family: var(--sans);
      font-size: 10px;
    }
    .at-custom-toggle.open .at-chev { transform: rotate(180deg); }

    .at-custom {
      display: none;
      margin-top: 6px;
    }
    .at-custom.open { display: block; }
    .at-custom-group {
      margin-bottom: 16px;
    }
    .at-custom-label {
      font-family: var(--mono);
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin-bottom: 8px;
    }
    .at-swatches {
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .at-swatch {
      width: 24px; height: 24px;
      border: 1px solid var(--rule-2);
      cursor: pointer;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .at-swatch:hover { transform: scale(1.12); }
    .at-swatch.on {
      box-shadow: 0 0 0 2px var(--brass);
      transform: scale(1.08);
    }

    /* ── Rail — car selector strip ─────────────────────── */
    .at-rail {
      position: absolute;
      left: 28px; right: 28px;
      bottom: calc(env(safe-area-inset-bottom) + 18px);
      z-index: 4;
      pointer-events: auto;
      display: flex; gap: 0;
      overflow-x: auto;
      border-top: 1px solid var(--rule);
      border-bottom: 1px solid var(--rule);
      background: rgba(10, 8, 6, 0.55);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      scrollbar-width: none;
    }
    .at-rail::-webkit-scrollbar { display: none; }
    .at-rail-item {
      flex: 0 0 auto;
      min-width: 118px;
      padding: 12px 16px;
      background: transparent;
      border: none;
      border-right: 1px solid var(--rule);
      color: var(--ink-soft);
      font-family: var(--sans);
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      position: relative;
      display: flex; flex-direction: column; gap: 3px;
    }
    .at-rail-item:last-child { border-right: none; }
    .at-rail-item:hover { color: var(--ink); background: rgba(245,241,232,0.03); }
    .at-rail-item.on {
      color: var(--ink);
      background: rgba(212, 166, 86, 0.06);
    }
    .at-rail-item.on::after {
      content: "";
      position: absolute;
      left: 0; right: 0; bottom: -1px;
      height: 2px;
      background: var(--brass);
    }
    .at-rail-num {
      font-family: var(--mono);
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.24em;
      color: var(--ink-faint);
    }
    .at-rail-item.on .at-rail-num { color: var(--brass); }
    .at-rail-name {
      font-family: var(--serif);
      font-style: italic;
      font-size: 14px;
      font-weight: 600;
      color: inherit;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .at-rail-meta {
      font-family: var(--mono);
      font-size: 9px;
      font-weight: 500;
      color: var(--ink-faint);
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
    }
    .at-rail-item.owned .at-rail-meta { color: var(--brass); }
    .at-rail-item.current .at-rail-meta { color: var(--brass); font-weight: 700; }

    /* ══════════════════════════════════════════════════════
       MOBILE / PORTRAIT — restack to prevent overlap
       ══════════════════════════════════════════════════════ */
    @media (max-width: 900px), (max-height: 500px) {
      .at-header {
        top: calc(env(safe-area-inset-top) + 14px);
        left: 16px; right: 16px;
      }
      .at-brand-mark { font-size: 20px; }
      .at-brand-sub  { font-size: 7px; letter-spacing: 0.26em; }
      .at-close      { padding: 8px 12px; font-size: 9px; letter-spacing: 0.18em; }

      .at-hint {
        bottom: auto;
        top: 62%;
        padding: 6px 10px;
        font-size: 8px;
      }

      /* Spec sheet moves to bottom */
      .at-spec {
        top: auto;
        right: 0; left: 0;
        bottom: 0;
        transform: none;
        width: 100%;
        max-height: 42vh;
        border: none;
        border-top: 2px solid var(--brass);
        border-right: none;
        padding: 16px 18px calc(env(safe-area-inset-bottom) + 14px);
        background: var(--surface-2);
      }
      .at-spec-name { font-size: 22px; }
      .at-spec-tag { font-size: 10px; margin-top: 4px; }
      .at-spec-divider { margin: 12px 0 10px; }
      .at-spec-price { font-size: 18px; }
      .at-spec-price-label { font-size: 7px; margin-bottom: 3px; }
      .at-spec-actions { margin-top: 12px; }
      .at-action { padding: 12px; font-size: 9px; letter-spacing: 0.2em; }
      .at-custom-toggle { margin-top: 12px; padding: 10px 0; font-size: 8px; }

      /* Rail sits above the spec sheet */
      .at-rail {
        left: 0; right: 0;
        bottom: 42vh;
        border-top: 1px solid var(--rule);
        border-bottom: 1px solid var(--rule);
        background: rgba(10, 8, 6, 0.82);
      }
      .at-rail-item { min-width: 96px; padding: 9px 12px; }
      .at-rail-num { font-size: 7px; }
      .at-rail-name { font-size: 12px; }
      .at-rail-meta { font-size: 8px; }
    }

    @media (max-height: 500px) {
      /* landscape phones — squeeze the spec sheet further */
      .at-spec { max-height: 60vh; padding: 10px 14px calc(env(safe-area-inset-bottom) + 10px); }
      .at-spec-name { font-size: 18px; }
      .at-spec-actions { margin-top: 8px; }
      .at-action { padding: 10px; font-size: 8px; }
      .at-rail { bottom: 60vh; }
    }

    @media (max-width: 380px) {
      .at-spec-name { font-size: 20px; }
      .at-spec-price { font-size: 16px; }
      .at-rail-item { min-width: 86px; padding: 8px 10px; }
      .at-rail-name { font-size: 11px; }
    }
  `;
  document.head.appendChild(s);
}

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */
function fmtNaira(n) {
  if (n === 0) return "Free";
  return "₦" + n.toLocaleString();
}

function disposeTree(root) {
  if (!root) return;
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { if (m && m.dispose) m.dispose(); });
    }
  });
}

/* ──────────────────────────────────────────────────────────────
   MAIN SCENE
   ────────────────────────────────────────────────────────────── */
export async function showroomScene(params, router) {
  const LOW = Quality.isLow;
  injectCSS();

  const Auth = window.__ph3d_auth;
  const Eco = window.__ph3d_economy;

  /* ── Three.js ──────────────────────────────────────── */
  const three = new THREE.Scene();
  three.background = new THREE.Color(0x0f0e0c);
  three.fog = new THREE.Fog(0x0f0e0c, 20, 46);

  const camera = new THREE.PerspectiveCamera(
    38, innerWidth / innerHeight, 0.1, 60
  );

  function placeCamera() {
    const aspect = innerWidth / innerHeight;
    const base = 8.5;
    const d = Math.max(base, base * Math.pow(1 / Math.max(aspect, 0.42), 0.55));
    /* On small/short viewports the rail (car name strip) + spec
       sheet stack across the bottom ~42-60vh of the screen (see
       the @media rules in injectCSS). Centering the car at screen-
       middle puts it right behind that stack, so the name/price
       panel visually covers the car. Shift the look target (and
       camera) upward so the car renders in the clear band above
       the UI instead of dead-center. */
    const isSmall = innerWidth <= 900 || innerHeight <= 500;
    const lookY = isSmall ? 1.65 : 0.72;
    camera.position.set(0, isSmall ? 3.1 : 2.2, d);
    camera.lookAt(0, lookY, 0);
  }
  placeCamera();

  /* Lights — cinematic key/rim/fill */
  three.add(new THREE.AmbientLight(0x1a1815, 1.7));
  three.add(new THREE.HemisphereLight(0x332a1e, 0x08060a, 0.9));

  const keyLight = new THREE.DirectionalLight(0xffd9a0, 2.3);
  keyLight.position.set(6, 8, 5);
  three.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xc7b3ff, 1.15);
  rimLight.position.set(-5, 3.4, -6);
  three.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0xffeecc, 0.55);
  fillLight.position.set(-4, 2, 5);
  three.add(fillLight);

  const floorSpot = new THREE.PointLight(0xffc88a, 1.4, 12, 2);
  floorSpot.position.set(0, 0.35, 0);
  three.add(floorSpot);

  /* Backdrop gradient plane behind */
  const backdropCanvas = document.createElement("canvas");
  backdropCanvas.width = 256;
  backdropCanvas.height = 256;
  const bctx = backdropCanvas.getContext("2d");
  const bgrad = bctx.createRadialGradient(128, 190, 0, 128, 190, 210);
  bgrad.addColorStop(0,   "#2c2216");
  bgrad.addColorStop(0.55,"#17120d");
  bgrad.addColorStop(1,   "#08060a");
  bctx.fillStyle = bgrad;
  bctx.fillRect(0, 0, 256, 256);
  const backdropTex = new THREE.CanvasTexture(backdropCanvas);
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ map: backdropTex, depthWrite: false })
  );
  backdrop.position.set(0, 4, -12);
  three.add(backdrop);

  /* Floor */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ color: 0x08070a })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  three.add(floor);

  /* Soft shadow under the car */
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext("2d");
  const sgrad = sctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  sgrad.addColorStop(0,   "rgba(0,0,0,0.72)");
  sgrad.addColorStop(0.5, "rgba(0,0,0,0.22)");
  sgrad.addColorStop(1,   "rgba(0,0,0,0)");
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 256, 256);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({
      map: shadowTex, transparent: true, depthWrite: false,
    })
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.005;
  three.add(shadowMesh);

  /* Warm floor halo under the car */
  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = haloCanvas.height = 256;
  const hctx = haloCanvas.getContext("2d");
  const hgrad = hctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  hgrad.addColorStop(0,   "rgba(255, 200, 140, 0.18)");
  hgrad.addColorStop(0.6, "rgba(180, 120, 60, 0.06)");
  hgrad.addColorStop(1,   "rgba(0, 0, 0, 0)");
  hctx.fillStyle = hgrad;
  hctx.fillRect(0, 0, 256, 256);
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  const haloMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({
      map: haloTex, transparent: true, depthWrite: false,
    })
  );
  haloMesh.rotation.x = -Math.PI / 2;
  haloMesh.position.y = 0.002;
  three.add(haloMesh);

  /* Car group — everything rotates around this */
  const carGroup = new THREE.Group();
  three.add(carGroup);

  /* ── State ────────────────────────────────────────── */
  const state = {
    selected: null,
    body: "#24282e",
    rim: "#c9ced6",
    targetYaw: Math.PI * 0.22,
    currentYaw: Math.PI * 0.22,
    dragging: false,
    lastX: 0,
    carScale: 1,
    idleDrift: 0.12,        /* rad / s when idle */
    lastInteraction: 0,     /* ms timestamp */
    carMesh: null,
  };

  /* Determine initial car — the one currently equipped */
  const startId = (State.vehicle && State.vehicle.model) || "gwagon";
  const startCar = CARS.find(c => c.id === startId) || CARS[0];
  state.selected = startCar;
  state.body = startCar.color;
  state.rim = "#c9ced6";
  /* If currently equipped with body/rim, use those */
  if (State.vehicle && State.vehicle.model === startCar.id) {
    state.body = State.vehicle.body || state.body;
    state.rim  = State.vehicle.rim  || state.rim;
  }

  /* ── Car rebuild ──────────────────────────────────── */
  function rebuildCar() {
    if (state.carMesh) {
      carGroup.remove(state.carMesh);
      disposeTree(state.carMesh);
      state.carMesh = null;
    }
    const car = buildSelectedCar(state.selected.id, state.body, state.rim);

    const correct = FRONT_CORRECTION[state.selected.id];
    if (correct !== undefined) car.rotation.y = correct;

    const box = new THREE.Box3().setFromObject(car);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 3.4 / maxDim;
    car.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(car);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    car.position.x -= center.x;
    car.position.z -= center.z;
    car.position.y -= box2.min.y;
    car.position.y += 0.01;

    carGroup.add(car);
    state.carMesh = car;
    state.carScale = 0.82; /* entrance animation */
  }
  rebuildCar();

  /* ── UI DOM ───────────────────────────────────────── */
  const ui = document.createElement("div");
  ui.id = "ph3d-showroom";
  ui.innerHTML = `
    <header class="at-header">
      <div class="at-brand">
        <div class="at-brand-mark">Octane</div>
        <div class="at-brand-sub">Boutique Atelier</div>
      </div>
      <button class="at-close" id="at-close">Close</button>
    </header>

    <div class="at-hint" id="at-hint">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7"/>
        <path d="M3 4v5h5"/>
      </svg>
      <span>drag to rotate</span>
    </div>

    <aside class="at-spec" id="at-spec">
      <div class="at-spec-eyebrow">Current Selection</div>
      <h1 class="at-spec-name" id="at-name">—</h1>
      <div class="at-spec-tag" id="at-tag">—</div>

      <div class="at-spec-divider"></div>

      <div class="at-spec-price-label">Price</div>
      <div class="at-spec-price" id="at-price">—</div>

      <div class="at-spec-actions">
        <button class="at-action buy" id="at-action">—</button>
      </div>

      <button class="at-custom-toggle" id="at-custom-toggle">
        <span>Customize</span>
        <span class="at-chev">▾</span>
      </button>
      <div class="at-custom" id="at-custom">
        <div class="at-custom-group">
          <div class="at-custom-label">Body Paint</div>
          <div class="at-swatches" id="at-body-swatches"></div>
        </div>
        <div class="at-custom-group">
          <div class="at-custom-label">Rim Finish</div>
          <div class="at-swatches" id="at-rim-swatches"></div>
        </div>
      </div>
    </aside>

    <nav class="at-rail" id="at-rail"></nav>
  `;
  document.body.appendChild(ui);

  const elName = ui.querySelector("#at-name");
  const elTag  = ui.querySelector("#at-tag");
  const elPrice = ui.querySelector("#at-price");
  const elAction = ui.querySelector("#at-action");
  const elRail = ui.querySelector("#at-rail");
  const elBodySw = ui.querySelector("#at-body-swatches");
  const elRimSw  = ui.querySelector("#at-rim-swatches");
  const elCustom = ui.querySelector("#at-custom");
  const elCustomToggle = ui.querySelector("#at-custom-toggle");
  const elHint = ui.querySelector("#at-hint");

  /* ── Ownership / status helpers ───────────────────── */
  function ownedList() {
    return (Auth && Auth.user && Array.isArray(Auth.user.cars)) ? Auth.user.cars : [];
  }
  function isOwned(id) { return ownedList().indexOf(id) >= 0; }
  function isCurrent(id) {
    return isOwned(id) && State.vehicle && State.vehicle.model === id;
  }

  /* ── Spec sheet render ────────────────────────────── */
  function renderSpec() {
    const car = state.selected;
    elName.textContent = car.name;
    elTag.textContent = car.tag;
    if (car.price === 0) {
      elPrice.textContent = "Starter · Free";
      elPrice.classList.add("free");
    } else {
      elPrice.textContent = fmtNaira(car.price);
      elPrice.classList.remove("free");
    }
    renderActionButton();
    renderSwatches();
  }

  /* ── Action button state ──────────────────────────── */
  function renderActionButton() {
    const car = state.selected;
    const bal = Eco ? Eco.balance : 0;
    elAction.className = "at-action";
    elAction.disabled = false;
    elAction.onclick = null;

    if (isCurrent(car.id)) {
      elAction.classList.add("active");
      elAction.textContent = "Currently Driving";
      elAction.disabled = true;
      return;
    }
    if (isOwned(car.id)) {
      elAction.classList.add("select");
      elAction.textContent = "Select This Car";
      elAction.onclick = () => doSelect(car);
      return;
    }
    if (car.price === 0) {
      elAction.classList.add("buy");
      elAction.textContent = "Claim Starter Car";
      elAction.onclick = () => doBuy(car);
      return;
    }
    if (bal < car.price) {
      elAction.classList.add("buy");
      elAction.textContent = "Need ₦" + (car.price - bal).toLocaleString();
      elAction.disabled = true;
      return;
    }
    elAction.classList.add("buy");
    elAction.textContent = "Buy · " + fmtNaira(car.price);
    elAction.onclick = () => doBuy(car);
  }

  /* ── Swatches ─────────────────────────────────────── */
  function renderSwatches() {
    elBodySw.innerHTML = "";
    BODY_COLORS.forEach(c => {
      const d = document.createElement("div");
      d.className = "at-swatch" + (state.body === c ? " on" : "");
      d.style.background = c;
      d.onclick = () => {
        state.body = c;
        renderSwatches();
        rebuildCar();
      };
      elBodySw.appendChild(d);
    });
    elRimSw.innerHTML = "";
    RIM_COLORS.forEach(c => {
      const d = document.createElement("div");
      d.className = "at-swatch" + (state.rim === c ? " on" : "");
      d.style.background = c;
      d.onclick = () => {
        state.rim = c;
        renderSwatches();
        rebuildCar();
      };
      elRimSw.appendChild(d);
    });
  }

  /* ── Rail render ──────────────────────────────────── */
  function renderRail() {
    elRail.innerHTML = "";
    CARS.forEach((car, i) => {
      const item = document.createElement("button");
      item.className = "at-rail-item";
      if (state.selected.id === car.id) item.classList.add("on");
      if (isCurrent(car.id)) item.classList.add("current");
      else if (isOwned(car.id)) item.classList.add("owned");

      let meta;
      if (isCurrent(car.id)) meta = "Driving";
      else if (isOwned(car.id)) meta = "Owned";
      else if (car.price === 0) meta = "Free";
      else meta = "₦" + (car.price / 1000000).toFixed(0) + "M";

      item.innerHTML =
        `<span class="at-rail-num">${String(i + 1).padStart(2, "0")}</span>` +
        `<span class="at-rail-name">${car.name}</span>` +
        `<span class="at-rail-meta">${meta}</span>`;

      item.onclick = () => selectCar(car);
      elRail.appendChild(item);
    });
  }

  /* ── Select a car from the rail ───────────────────── */
  function selectCar(car) {
    state.selected = car;
    state.body = car.color;
    state.rim = "#c9ced6";
    if (State.vehicle && State.vehicle.model === car.id) {
      state.body = State.vehicle.body || state.body;
      state.rim  = State.vehicle.rim  || state.rim;
    }
    renderSpec();
    renderRail();
    rebuildCar();
    elCustom.classList.remove("open");
    elCustomToggle.classList.remove("open");
  }

  /* ── Buy ──────────────────────────────────────────── */
  async function doBuy(car) {
    if (!Eco) {
      if (window.__ph3d_phone) window.__ph3d_phone._toast("Economy offline");
      return;
    }
    if (car.price > 0) {
      if (Eco.balance < car.price) {
        if (window.__ph3d_phone) window.__ph3d_phone._toast("Not enough money");
        try { Sfx.play("purchase_fail"); } catch (_) {}
        return;
      }
      Eco.withdraw(car.price);
      try { Sfx.play("purchase_ok"); } catch (_) {}
    }
    try {
      if (window.__ph3d_garage) window.__ph3d_garage.grantCar(car.id);
    } catch (e) { /* non-fatal */ }
    await persistVehicle(car);
    renderSpec();
    renderRail();
    if (window.__ph3d_phone) {
      window.__ph3d_phone._toast("Bought " + car.name);
    }
    setTimeout(() => { try { router.go("city"); } catch (e) {} }, 800);
  }

  /* ── Select ───────────────────────────────────────── */
  async function doSelect(car) {
    if (!isOwned(car.id) && car.price > 0) return;
    if (!isOwned(car.id) && car.price === 0) {
      try {
        if (window.__ph3d_garage) window.__ph3d_garage.grantCar(car.id);
      } catch (e) {}
    }
    await persistVehicle(car);
    renderSpec();
    renderRail();
    if (window.__ph3d_phone) {
      window.__ph3d_phone._toast("Now driving " + car.name);
    }
    setTimeout(() => { try { router.go("city"); } catch (e) {} }, 600);
  }

  /* ── Persist ──────────────────────────────────────── */
  async function persistVehicle(car) {
    if (!State.vehicle) State.vehicle = {};
    State.vehicle.model = car.id;
    State.vehicle.body = state.body;
    State.vehicle.rim = state.rim;
    try {
      if (Auth && Auth.save) {
        await Auth.save({
          vehicle: { model: car.id, body: state.body, rim: state.rim },
        });
      }
    } catch (e) { /* non-fatal */ }
  }

  /* ── Wire up ──────────────────────────────────────── */
  ui.querySelector("#at-close").onclick = () => {
    try { router.go("city"); } catch (e) {}
  };

  elCustomToggle.onclick = () => {
    elCustom.classList.toggle("open");
    elCustomToggle.classList.toggle("open");
  };

  /* Live balance refresh */
  if (Eco && typeof Eco.onChange === "function") {
    Eco.onChange(() => renderActionButton());
  }

  /* Drag-to-rotate on the renderer canvas */
  const canvas = router.renderer.domElement;
  const onPD = (e) => {
    state.dragging = true;
    state.lastX = e.clientX;
    state.lastInteraction = performance.now();
    hideHint();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  };
  const onPM = (e) => {
    if (!state.dragging) return;
    const dx = e.clientX - state.lastX;
    state.lastX = e.clientX;
    state.targetYaw += dx * 0.010;
    state.lastInteraction = performance.now();
  };
  const onPU = (e) => {
    state.dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  };
  canvas.addEventListener("pointerdown", onPD);
  canvas.addEventListener("pointermove", onPM);
  canvas.addEventListener("pointerup", onPU);
  canvas.addEventListener("pointercancel", onPU);

  /* Drag hint — hide on first drag or after 8s */
  let hintTimer = setTimeout(hideHint, 8000);
  function hideHint() {
    if (elHint) elHint.classList.add("hide");
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  }

  /* ── Initial render ───────────────────────────────── */
  renderSpec();
  renderRail();

  /* ── Resize ───────────────────────────────────────── */
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    placeCamera();
  };
  window.addEventListener("resize", onResize);

  /* ── Animation loop hook ──────────────────────────── */
  let lastT = performance.now();

  return {
    three,
    camera,
    controls: { update: () => {} },
    crumb: "OCTANE",
    title: "Boutique Atelier",
    subtitle: "Choose your machine",
    hint: "",
    update: (dt, t) => {
      dt = Math.min(dt || 0.016, 0.05);

      /* Idle turntable — resumes 3s after the user stops dragging */
      const idleSince = performance.now() - state.lastInteraction;
      if (!state.dragging && idleSince > 3000) {
        state.targetYaw += state.idleDrift * dt;
      }

      /* Damped rotation */
      state.currentYaw +=
        (state.targetYaw - state.currentYaw) * Math.min(1, dt * 8);
      carGroup.rotation.y = state.currentYaw;

      /* Entrance scale (pop-in on car change) */
      state.carScale += (1.0 - state.carScale) * Math.min(1, dt * 12);
      if (state.carMesh) {
        state.carMesh.parent === carGroup &&
          carGroup.scale.setScalar(state.carScale);
      }

      /* Ground shadow follows yaw so it rotates with the car */
      shadowMesh.rotation.z = state.currentYaw * 0.3;

      /* Slight camera breathing */
      const breath = Math.sin(t * 0.5) * 0.02;
      const isSmall = innerWidth <= 900 || innerHeight <= 500;
      camera.position.y = (isSmall ? 3.1 : 2.2) + breath;

      lastT = performance.now();
    },
    dispose: () => {
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPD);
      canvas.removeEventListener("pointermove", onPM);
      canvas.removeEventListener("pointerup", onPU);
      canvas.removeEventListener("pointercancel", onPU);
      if (hintTimer) clearTimeout(hintTimer);
      if (state.carMesh) { disposeTree(state.carMesh); state.carMesh = null; }
      disposeTree(carGroup);
      disposeTree(backdrop);
      if (shadowMesh.material.map) shadowMesh.material.map.dispose();
      if (haloMesh.material.map) haloMesh.material.map.dispose();
      shadowMesh.material.dispose();
      haloMesh.material.dispose();
      floor.material.dispose();
      floor.geometry.dispose();
      backdropTex.dispose();
      try { ui.remove(); } catch (e) {}
    },
  };
}
