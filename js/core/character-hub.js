/* ============================================================
   character-hub.js — "TAILOR"
   ============================================================
   Print/zine-inspired character workshop.

   v2 additions over v1:
   • Welcome card on first open — plainly explains every gesture.
   • Persistent "?" help button reopens the card any time.
   • Live "drag to turn" hint inside the mirror frame, hides on
     first drag or after 8 seconds, remembered per session.
   • Mobile layout reworked — no more overlaps:
       - tabs become a horizontal scroll strip under the masthead
       - rack slides up from the bottom as an iOS-style sheet
       - slip moves to the bottom-centre and stays clear of stamps
       - emote stamps become a vertical column on the right
       - slip + stamps fade out while the sheet is open
   • Group-count badges on every tab (Body 3, Top 4, ...)
   • Camera auto-frames the character for portrait screens.
   ============================================================ */

import { GameKeyboard } from "../ui/game-keyboard.js";
import * as THREE from "three";
import { Quality } from "./quality.js";
import { Wardrobe, WARDROBE_TABS, COSTUME_INFO, resolveColor } from "./wardrobe.js";
import { buildCharacter, liveApplyConfig } from "../characters/lowpoly.js";
import { EMOTES, setHand, HAND } from "../characters/animator.js";
import { isEmoteUnlocked, openStyleAbilityShop, getStyleItems, getEquippedWing, setEquippedWing, purchaseStyleItem, attachCosmeticWings, updateCosmeticWings, BODY_TYPES, BODY_STYLES, getBodyOwnership, ownsBodyItem, purchaseBodyItem, getBodySelection, setBodySelection } from "./style-ability-shop.js";
import { Economy } from "./economy.js";
import { State } from "./state.js";
import { buildGWagon3D } from "../vehicles/gwagon3d.js";
import { buildCybertruck3D } from "../vehicles/cybertruck3d.js";
import { buildRangeRover3D } from "../vehicles/rangerover_compound.js";
import { buildMercedes3D } from "../vehicles/mercedes3d.js";
import { buildBMW3D } from "../vehicles/bmw3d.js";
import { buildChiron3D } from "../vehicles/chiron3d.js";
import { buildScrappy3D } from "../vehicles/scrappy3d.js";
import { buildVehicle as buildVehicleSimple } from "../vehicles/models.js";

const CSS_ID = "ph3d-hub-css";
const WELCOME_KEY = "ph3d-hub-welcome-seen";
const DRAG_HINT_KEY = "ph3d-hub-drag-seen";

/* ──────────────────────────────────────────────────────────────
   STYLES
   ────────────────────────────────────────────────────────────── */
function injectCSS() {
  if (document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    #ph3d-hub {
      --paper: #ece4d2;
      --paper-deep: #ddd1b8;
      --ink: #1b1a17;
      --ink-soft: #3d3a32;
      --ink-faint: #7a7466;
      --rule: #b8ad96;
      --accent: #b1472f;

      --serif: "Iowan Old Style", "Hoefler Text", "Palatino Linotype",
               Palatino, Georgia, serif;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue",
              Helvetica, Arial, sans-serif;
      --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;

      position: fixed; inset: 0; z-index: 90;
      display: none;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--sans);
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    #ph3d-hub.on { display: block; }

    /* Paper grain */
    .tb-grain {
      position: absolute; inset: 0; pointer-events: none; z-index: 1;
      background-image:
        radial-gradient(rgba(27,26,23,0.045) 1px, transparent 1px),
        radial-gradient(rgba(27,26,23,0.030) 1px, transparent 1px);
      background-size: 3px 3px, 7px 7px;
      background-position: 0 0, 1px 2px;
      mix-blend-mode: multiply;
      opacity: 0.9;
    }
    .tb-crease {
      position: absolute; top: 0; bottom: 0; left: 50%;
      width: 1px; transform: translateX(-0.5px);
      background: linear-gradient(to bottom,
        transparent 0%, rgba(27,26,23,0.06) 8%,
        rgba(27,26,23,0.10) 50%, rgba(27,26,23,0.06) 92%,
        transparent 100%);
      pointer-events: none; z-index: 1;
    }

    /* Canvas */
    #ph3d-hub canvas.tb-render {
      position: absolute; inset: 0; width: 100%; height: 100%;
      display: block; touch-action: none; cursor: grab;
      z-index: 0;
    }
    #ph3d-hub canvas.tb-render:active { cursor: grabbing; }

    /* ── Masthead ───────────────────────────────────────── */
    .tb-masthead {
      position: absolute;
      top: calc(env(safe-area-inset-top) + 22px);
      left: 28px; right: 28px;
      z-index: 3;
      display: flex; align-items: flex-end; justify-content: space-between;
      pointer-events: none;
    }
    .tb-mast-left { line-height: 1; }
    .tb-mast-title {
      font-family: var(--serif);
      font-size: 34px; font-style: italic; font-weight: 600;
      letter-spacing: -0.5px; color: var(--ink);
    }
    .tb-mast-rule {
      margin-top: 6px; height: 2px;
      background: var(--ink); width: 84px;
    }
    .tb-mast-sub {
      margin-top: 8px;
      font-family: var(--mono);
      font-size: 9px; letter-spacing: 0.32em;
      text-transform: uppercase; color: var(--ink-soft);
    }
    .tb-mast-right {
      display: flex; gap: 8px; pointer-events: auto;
    }
    .tb-help, .tb-close {
      background: transparent;
      border: 1.5px solid var(--ink);
      color: var(--ink);
      font-family: var(--mono);
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .tb-close { padding: 10px 16px; }
    .tb-wings { padding:10px 14px; border:1.5px solid #9a7940; color:#6f5426; background:linear-gradient(135deg,#f8edcf,#e4c98d); font:700 10px var(--mono); letter-spacing:.16em; text-transform:uppercase; cursor:pointer; }
    .tb-wings:hover { background:#e7d3a5; }
    .tb-wing-card { padding:13px; margin:0 0 12px; border:1px solid #c9b98f; background:linear-gradient(145deg,#f5efdf,#e7dcc4); }
    .tb-wing-card h3 { margin:0 0 5px; font:italic 19px var(--serif); }
    .tb-wing-card p { margin:0 0 10px; color:#625b4e; font-size:11px; line-height:1.45; }
    .tb-wing-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; font:11px var(--mono); }
    .tb-wing-action { border:1px solid #7e6335; background:#30291d; color:#f7edda; padding:9px 12px; font:700 10px var(--mono); letter-spacing:.1em; cursor:pointer; }
    .tb-wing-action:disabled { opacity:.5; cursor:default; }
    .tb-wing-equipped { color:#47705c; font-weight:800; }
    .tb-help {
      width: 42px; height: 42px; padding: 0;
      font-family: var(--serif);
      font-style: italic; font-size: 20px; letter-spacing: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .tb-close:hover, .tb-help:hover {
      background: var(--ink); color: var(--paper);
    }

    /* ── Fitting mirror frame ──────────────────────────── */
    .tb-mirror-frame {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -54%);
      width: min(46vw, 320px);
      height: min(78vh, 560px);
      border: 2px solid var(--ink);
      border-radius: 160px 160px 4px 4px / 200px 200px 4px 4px;
      background: transparent;
      pointer-events: none;
      z-index: 1;
      box-shadow:
        inset 0 0 0 6px var(--paper),
        inset 0 0 0 7px var(--ink);
    }
    .tb-mirror-frame::before,
    .tb-mirror-frame::after {
      content: "";
      position: absolute; left: -8px; right: -8px; height: 2px;
      background: var(--ink);
    }
    .tb-mirror-frame::before { top: 46px; opacity: 0.55; }
    .tb-mirror-frame::after  { bottom: 46px; opacity: 0.55; }

    /* Drag hint under the mirror */
    .tb-drag-hint {
      position: absolute;
      left: 50%; bottom: 20%;
      transform: translateX(-50%);
      z-index: 2;
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px;
      background: var(--ink);
      color: var(--paper);
      font-family: var(--mono);
      font-size: 9px; font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      white-space: nowrap;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.4s ease, transform 0.4s ease;
    }
    .tb-drag-hint.hide {
      opacity: 0;
      transform: translateX(-50%) translateY(-6px);
    }
    .tb-drag-hint svg {
      width: 12px; height: 12px;
      animation: dragRotate 3s linear infinite;
    }
    @keyframes dragRotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* ── Category tabs (desktop: vertical left column) ───── */
    .tb-tabs {
      position: absolute;
      top: 50%; left: 28px;
      transform: translateY(-46%);
      z-index: 3;
      display: flex; flex-direction: column; gap: 2px;
      pointer-events: auto;
    }
    .tb-tab {
      position: relative;
      background: transparent; border: none;
      padding: 12px 18px 12px 20px;
      font-family: var(--sans);
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--ink-faint);
      cursor: pointer;
      text-align: left;
      transition: color 0.15s ease;
    }
    .tb-tab::before {
      content: "";
      position: absolute;
      left: 0; top: 50%;
      width: 8px; height: 2px;
      background: var(--ink-faint);
      transform: translateY(-50%);
      transition: width 0.18s ease, background 0.18s ease;
    }
    .tb-tab:hover { color: var(--ink-soft); }
    .tb-tab:hover::before { width: 12px; background: var(--ink-soft); }
    .tb-tab.on { color: var(--ink); }
    .tb-tab.on::before { width: 22px; background: var(--accent); }
    .tb-tab.on .tb-tab-count { color: var(--accent); }
    .tb-tab-count {
      font-family: var(--mono);
      font-size: 9px; font-weight: 500;
      letter-spacing: 0.1em;
      color: var(--ink-faint);
      margin-left: 6px;
      vertical-align: super;
    }

    /* ── Rack (right side panel) ─────────────────────────── */
    .tb-rack {
      position: absolute;
      top: 50%; right: 28px;
      transform: translate(24px, -46%);
      width: min(26vw, 240px);
      max-height: 72vh;
      z-index: 3;
      pointer-events: auto;
      background: var(--paper);
      border-left: 1px solid var(--rule);
      padding: 4px 0 4px 24px;
      opacity: 0;
      transition: opacity 0.24s ease, transform 0.24s ease;
      overflow-y: auto;
    }
    .tb-rack.on { opacity: 1; transform: translate(0, -46%); }
    .tb-rack::-webkit-scrollbar { width: 4px; }
    .tb-rack::-webkit-scrollbar-thumb { background: var(--rule); }

    .tb-rack-head {
      padding-bottom: 12px;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--ink);
    }
    .tb-rack-headline {
      display: flex; align-items: baseline; gap: 10px;
    }
    .tb-rack-title {
      font-family: var(--serif);
      font-style: italic;
      font-size: 20px;
      color: var(--ink);
    }
    .tb-rack-count {
      font-family: var(--mono);
      font-size: 9px;
      letter-spacing: 0.24em;
      color: var(--ink-faint);
      margin-left: auto;
    }
    .tb-rack-handle { display: none; }
    .tb-rack-close { display: none; }

    .tb-group { margin-bottom: 22px; }
    .tb-group-label {
      font-family: var(--mono);
      font-size: 9px; letter-spacing: 0.26em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin-bottom: 10px;
      display: flex; align-items: center; gap: 8px;
    }
    .tb-group-label em {
      font-style: normal;
      color: var(--accent);
      font-weight: 700;
      margin-right: 2px;
    }
    .tb-group-label::after {
      content: "";
      flex: 1; height: 1px;
      background: var(--rule);
    }

    .tb-chip-set {
      display: flex; flex-wrap: wrap; gap: 4px;
    }
    .tb-chip {
      padding: 6px 10px;
      background: transparent;
      border: 1px solid var(--rule);
      color: var(--ink-soft);
      font-family: var(--sans);
      font-size: 10px; font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .tb-chip:hover {
      border-color: var(--ink-soft);
      color: var(--ink);
    }
    .tb-chip.on {
      background: var(--ink);
      border-color: var(--ink);
      color: var(--paper);
    }

    .tb-swatch-set {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(26px, 1fr));
      gap: 4px;
    }
    .tb-swatch {
      position: relative;
      aspect-ratio: 1;
      border: 1px solid rgba(27,26,23,0.18);
      cursor: pointer;
      transition: transform 0.12s ease;
    }
    .tb-swatch:hover { transform: scale(1.08); z-index: 1; }
    .tb-swatch.on { outline: 2px solid var(--ink); outline-offset: 1px; }


    .tb-swatch-auto {
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; color: var(--ink-soft); background: var(--paper-deep);
    }
    .tb-swatch-custom {
      background: conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e);
      overflow: hidden;
    }
    .tb-swatch-custom input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; border: 0; padding: 0; }
    .tb-note {
      margin-top: 8px; font-family: var(--mono); font-size: 9px; line-height: 1.5;
      letter-spacing: 0.04em; color: var(--accent);
    }
    .tb-fit { display: flex; flex-direction: column; gap: 8px; }
    .tb-fit-labels {
      display: flex; justify-content: space-between;
      font-family: var(--mono);
      font-size: 9px; letter-spacing: 0.2em;
      color: var(--ink-faint);
      text-transform: uppercase;
    }
    .tb-fit input[type=range] {
      -webkit-appearance: none; appearance: none;
      width: 100%; height: 1px;
      background: var(--ink); outline: none;
    }
    .tb-fit input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 14px; height: 14px;
      background: var(--paper);
      border: 2px solid var(--ink);
      border-radius: 50%;
      cursor: pointer;
    }

    /* ── Emote stamps ───────────────────────────────────── */
    .tb-stamps {
      position: absolute;
      left: 50%;
      bottom: calc(env(safe-area-inset-bottom) + 20px);
      transform: translateX(-50%);
      z-index: 3;
      display: flex; gap: 10px;
      pointer-events: auto;
      transition: opacity 0.2s ease;
    }
    .tb-stamp {
      width: 52px; height: 52px;
      background: var(--paper);
      border: 1.5px solid var(--ink);
      border-radius: 50%;
      color: var(--ink);
      font-family: var(--mono);
      font-size: 9px; font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 1px;
      transition: all 0.12s ease;
    }
    .tb-stamp .tb-stamp-ico {
      font-size: 15px; line-height: 1;
      font-family: var(--serif);
      font-style: italic; font-weight: 600;
    }
    .tb-stamp:hover { background: var(--ink); color: var(--paper); }
    .tb-stamp.on {
      background: var(--accent); border-color: var(--accent);
      color: var(--paper);
    }

    /* ── Order slip (name) ──────────────────────────────── */
    .tb-slip {
      position: absolute;
      left: 28px;
      bottom: calc(env(safe-area-inset-bottom) + 20px);
      z-index: 3;
      width: 220px;
      pointer-events: auto;
      background: var(--paper);
      border: 1.5px solid var(--ink);
      padding: 12px 14px 14px;
      transition: opacity 0.2s ease;
    }
    .tb-slip-lbl {
      font-family: var(--mono);
      font-size: 8px; font-weight: 700;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin-bottom: 6px;
    }
    .tb-slip-row { display: flex; gap: 6px; }
    .tb-slip-row input {
      flex: 1;
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--ink);
      color: var(--ink);
      font-family: var(--serif);
      font-style: italic;
      font-size: 20px; font-weight: 500;
      padding: 2px 0 4px;
      outline: none;
      min-width: 0;
    }
    .tb-slip-row input::placeholder { color: var(--ink-faint); }
    .tb-save {
      background: var(--ink); color: var(--paper); border: none;
      padding: 0 12px;
      font-family: var(--mono);
      font-size: 9px; font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .tb-save:hover { background: var(--accent); }

    /* ── Welcome modal ────────────────────────────────────── */
    .tb-welcome {
      position: absolute; inset: 0;
      z-index: 20;
      background: rgba(27, 26, 23, 0.72);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
    }
    .tb-welcome.on { opacity: 1; pointer-events: auto; }
    .tb-welcome-card {
      max-width: 400px; width: 100%;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      background: var(--paper);
      border: 2px solid var(--ink);
      padding: 28px 26px 22px;
      box-shadow: 8px 8px 0 var(--ink);
      position: relative;
    }
    .tb-welcome-eyebrow {
      font-family: var(--mono);
      font-size: 9px; letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin-bottom: 10px;
    }
    .tb-welcome-h {
      font-family: var(--serif);
      font-style: italic;
      font-size: 30px; font-weight: 600;
      color: var(--ink);
      margin: 0 0 6px; line-height: 1;
    }
    .tb-welcome-rule {
      height: 2px; background: var(--ink);
      width: 60px; margin: 12px 0 18px;
    }
    .tb-welcome-list {
      list-style: none; padding: 0; margin: 0 0 22px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .tb-welcome-list li {
      font-family: var(--sans);
      font-size: 13px; line-height: 1.45;
      color: var(--ink-soft);
      padding-left: 26px; position: relative;
    }
    .tb-welcome-list li::before {
      content: counter(list-item, decimal-leading-zero);
      position: absolute; left: 0; top: 2px;
      font-family: var(--mono);
      font-size: 10px; font-weight: 700;
      color: var(--accent);
    }
    .tb-welcome-list strong {
      color: var(--ink); font-weight: 700;
    }
    .tb-welcome-ok {
      width: 100%; padding: 14px;
      background: var(--ink); color: var(--paper);
      border: none;
      font-family: var(--mono);
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s;
    }
    .tb-welcome-ok:hover { background: var(--accent); }

    /* ══════════════════════════════════════════════════════
       MOBILE / SHORT-VIEWPORT LAYOUT
       Reflowed so tabs, mirror, stamps, slip and rack never
       overlap. Portrait phones and landscape phones all use
       this layout.
       ══════════════════════════════════════════════════════ */
    @media (max-width: 900px), (max-height: 500px) {
      .tb-masthead {
        left: 16px; right: 16px;
        top: calc(env(safe-area-inset-top) + 14px);
      }
      .tb-mast-title { font-size: 24px; }
      .tb-mast-rule  { width: 48px; margin-top: 4px; }
      .tb-mast-sub   { font-size: 8px; margin-top: 6px; letter-spacing: 0.26em; }
      .tb-close      { padding: 8px 12px; font-size: 9px; letter-spacing: 0.18em; }
      .tb-help       { width: 34px; height: 34px; font-size: 16px; }

      /* Tabs → horizontal strip below masthead */
      .tb-tabs {
        top: calc(env(safe-area-inset-top) + 78px);
        left: 0; right: 0;
        transform: none;
        flex-direction: row;
        gap: 0;
        padding: 0 16px 8px;
        overflow-x: auto;
        border-bottom: 1px solid var(--rule);
        scrollbar-width: none;
      }
      .tb-tabs::-webkit-scrollbar { display: none; }
      .tb-tab {
        padding: 10px 12px 8px;
        font-size: 10px;
        letter-spacing: 0.14em;
        flex-shrink: 0;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
      }
      .tb-tab::before { display: none; }
      .tb-tab.on {
        color: var(--ink);
        border-bottom-color: var(--accent);
      }
      .tb-tab.on::before { display: none; }

      /* Mirror — smaller, sits between tabs and bottom stack */
      .tb-mirror-frame {
        width: 55vw; height: 44vh;
        max-width: 220px; max-height: 360px;
        top: 52%;
        transform: translate(-50%, -50%);
      }
      .tb-mirror-frame::before { top: 32px; opacity: 0.45; }
      .tb-mirror-frame::after  { bottom: 32px; opacity: 0.45; }

      /* Drag hint — below the mirror, above the slip */
      .tb-drag-hint {
        bottom: 20%;
        font-size: 8px;
        padding: 6px 12px;
      }

      /* Stamps → vertical column, right edge */
      .tb-stamps {
        top: 52%;
        bottom: auto;
        left: auto;
        right: 10px;
        transform: translateY(-50%);
        flex-direction: column;
        gap: 6px;
      }
      .tb-stamp {
        width: 40px; height: 40px;
        font-size: 7px; letter-spacing: 0.06em;
      }
      .tb-stamp .tb-stamp-ico { font-size: 12px; }

      /* Slip → bottom-centre, full width minus padding */
      .tb-slip {
        left: 50%;
        transform: translateX(-50%);
        bottom: calc(env(safe-area-inset-bottom) + 12px);
        width: min(280px, calc(100vw - 32px));
        padding: 9px 12px 10px;
      }
      .tb-slip-lbl { font-size: 7px; margin-bottom: 4px; letter-spacing: 0.24em; }
      .tb-slip-row input { font-size: 15px; padding: 2px 0 3px; }
      .tb-save { font-size: 8px; padding: 0 9px; letter-spacing: 0.16em; }

      /* Rack → bottom sheet */
      .tb-rack {
        left: 0; right: 0;
        top: auto; bottom: 0;
        width: 100%;
        max-height: 66vh;
        transform: translateY(100%);
        border-left: none;
        border-top: 2px solid var(--ink);
        border-radius: 18px 18px 0 0;
        padding: 12px 20px calc(env(safe-area-inset-bottom) + 20px);
        z-index: 6;
      }
      .tb-rack.on { transform: translateY(0); }
      .tb-rack-head {
        padding-top: 0; padding-bottom: 12px;
        position: sticky; top: 0;
        background: var(--paper);
        z-index: 2;
      }
      .tb-rack-handle {
        display: block;
        width: 40px; height: 4px;
        background: var(--rule);
        border-radius: 2px;
        margin: 0 auto 12px;
      }
      .tb-rack-headline {
        display: flex; align-items: center; gap: 10px;
      }
      .tb-rack-title { font-size: 17px; }
      .tb-rack-count { margin-left: auto; }
      .tb-rack-close {
        display: flex; align-items: center; justify-content: center;
        width: 28px; height: 28px;
        background: transparent;
        border: 1px solid var(--ink);
        color: var(--ink);
        border-radius: 50%;
        font-family: var(--sans);
        font-size: 13px;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
      }

      /* When rack is open, hide the elements that would collide */
      #ph3d-hub.tb-rack-open .tb-slip,
      #ph3d-hub.tb-rack-open .tb-stamps,
      #ph3d-hub.tb-rack-open .tb-drag-hint {
        opacity: 0;
        pointer-events: none;
      }
    }

    /* Extremely short viewports — landscape phones */
    @media (max-height: 500px) {
      .tb-mirror-frame {
        width: auto; height: 72vh; max-height: none;
        aspect-ratio: 0.5;
      }
      .tb-drag-hint { bottom: 14%; }
    }


    /* name field (game keyboard) */
    .tb-name-field {
      flex: 1; min-width: 0;
      background: transparent; border: none; border-bottom: 1px solid var(--ink);
      color: var(--ink); font-family: var(--serif); font-style: italic;
      font-size: 20px; font-weight: 500; padding: 2px 0 4px; line-height: 1.25; height: 1.25em;
    }
    .tb-name-field.gk-empty::before { color: var(--ink-faint) !important; }
    /* typing: everything else steps aside so the name slip sits right above the keyboard */
    #ph3d-hub.tb-typing .tb-tabs, #ph3d-hub.tb-typing .tb-rack,
    #ph3d-hub.tb-typing .tb-stamps, #ph3d-hub.tb-typing .tb-drag-hint { opacity: 0; pointer-events: none; }
    #ph3d-hub.tb-typing .tb-slip {
      left: 50%; right: auto; transform: translateX(-50%);
      width: min(360px, calc(100vw - 32px));
      bottom: calc(var(--tb-kb, 0px) + 10px); z-index: 8;
    }

    /* ══ LANDSCAPE PHONE: tabs left · character middle · options panel right ══ */
    @media (orientation: landscape) and (max-height: 520px) {
      #ph3d-hub { --tb-lw: 118px; --tb-rw: min(40vw, 300px); }
      .tb-masthead {
        top: calc(env(safe-area-inset-top) + 6px);
        left: calc(env(safe-area-inset-left) + 14px);
        right: calc(env(safe-area-inset-right) + 14px);
        align-items: center;
      }
      .tb-mast-left { display: flex; align-items: baseline; gap: 10px; }
      .tb-mast-title { font-size: 20px; }
      .tb-mast-rule { display: none; }
      .tb-mast-sub { margin: 0; font-size: 8px; letter-spacing: 0.22em; }
      .tb-close { padding: 6px 11px; }
      .tb-help { width: 28px; height: 28px; font-size: 14px; }

      /* tabs: compact vertical list in the left column */
      .tb-tabs {
        top: 40px; bottom: calc(env(safe-area-inset-bottom) + 84px);
        left: calc(env(safe-area-inset-left) + 8px); right: auto;
        width: var(--tb-lw);
        transform: none; flex-direction: column; gap: 0;
        padding: 0 6px 0 0; overflow-x: hidden; overflow-y: auto;
        border-bottom: none; border-right: 1px solid var(--rule);
      }
      .tb-tab {
        padding: 8px 6px 8px 9px; font-size: 9px; letter-spacing: 0.12em;
        border-bottom: none; border-left: 2px solid transparent; margin: 0; width: 100%;
        display: flex; align-items: center; justify-content: space-between; gap: 4px;
      }
      .tb-tab.on { border-bottom-color: transparent; border-left-color: var(--accent); }

      /* character: tall mirror centred between the columns */
      .tb-mirror-frame {
        left: var(--tb-cx, 50%); top: 40px; bottom: auto;
        height: calc(100vh - 96px); width: auto; aspect-ratio: 0.5; max-height: none; max-width: none;
        transform: translateX(-50%);
        transition: left 0.24s ease;
      }
      .tb-mirror-frame::before { top: 28px; } .tb-mirror-frame::after { bottom: 28px; }
      .tb-drag-hint { left: var(--tb-cx, 50%); bottom: 52px; transition: left 0.24s ease, opacity 0.4s ease; }

      /* stamps: a row under the character */
      .tb-stamps {
        left: var(--tb-cx, 50%); right: auto; top: auto;
        bottom: calc(env(safe-area-inset-bottom) + 8px);
        transform: translateX(-50%); flex-direction: row; gap: 7px;
        transition: left 0.24s ease, opacity 0.2s ease;
      }
      .tb-stamp { width: 38px; height: 38px; }

      /* name slip: bottom of the left column */
      .tb-slip {
        left: calc(env(safe-area-inset-left) + 8px); transform: none;
        bottom: calc(env(safe-area-inset-bottom) + 8px);
        width: var(--tb-lw); padding: 6px 8px 7px;
      }
      .tb-slip-row { flex-direction: column; gap: 5px; }
      .tb-slip-row .tb-name-field { font-size: 14px; }
      .tb-save { align-self: flex-start; padding: 5px 10px; font-size: 8px; }

      /* options: a side panel (not a bottom sheet) so you always see the character */
      .tb-rack {
        top: 40px; bottom: 8px; right: calc(env(safe-area-inset-right) + 8px); left: auto;
        width: var(--tb-rw); max-height: none; height: auto;
        transform: translateX(calc(100% + 24px)); opacity: 1;
        border-top: none; border-left: 1px solid var(--ink); border-radius: 0;
        padding: 4px 10px 10px 14px; z-index: 4;
      }
      .tb-rack.on { transform: translateX(0); }
      .tb-rack-handle { display: none; }
      .tb-rack-head { padding-bottom: 6px; }
      .tb-rack-title { font-size: 15px; }
      .tb-group { margin-bottom: 12px; }
      #ph3d-hub.tb-rack-open .tb-slip, #ph3d-hub.tb-rack-open .tb-stamps { opacity: 1; pointer-events: auto; }
      #ph3d-hub.tb-typing .tb-tabs, #ph3d-hub.tb-typing .tb-rack,
      #ph3d-hub.tb-typing .tb-stamps, #ph3d-hub.tb-typing .tb-drag-hint { opacity: 0; pointer-events: none; }
    }

    /* Smallest phones */
    @media (max-width: 380px) {
      .tb-mast-title { font-size: 21px; }
      .tb-mirror-frame { width: 56vw; height: 40vh; }
      .tb-stamp { width: 36px; height: 36px; }
      .tb-stamp .tb-stamp-ico { font-size: 11px; }
      .tb-welcome-h { font-size: 24px; }
      .tb-welcome-list li { font-size: 12px; }
    }
  `;
  document.head.appendChild(s);
}

/* ──────────────────────────────────────────────────────────────
   Vehicle factory
   ────────────────────────────────────────────────────────────── */
function buildSelectedCar(defId, body, rim) {
  switch (defId) {
    case "gwagon":     return buildGWagon3D(body, rim);
    case "cybertruck": return buildCybertruck3D(body, rim);
    case "rangerover": return buildRangeRover3D(body, rim);
    case "mercedes":   return buildMercedes3D(body, rim);
    case "bmw":        return buildBMW3D(body, rim);
    case "chiron":     return buildChiron3D(body, rim);
    case "scrappy":    return buildScrappy3D(body, rim);
    default:
      try { return buildVehicleSimple(defId, body, rim); }
      catch (e) { return buildGWagon3D(body, rim); }
  }
}

const CAR_FRONT_CORRECTION = {
  gwagon:     Math.PI,
  cybertruck: 0,
  rangerover: 0,
  mercedes:  -Math.PI / 2,
  bmw:       -Math.PI / 2,
  chiron:    -Math.PI / 2,
  scrappy:   0,
  nk250:     0,
  hoverboard: 0,
};

/* ──────────────────────────────────────────────────────────────
   CharacterHub
   ────────────────────────────────────────────────────────────── */
export class CharacterHub {
  constructor() {
    this.visible = false;
    this._built = false;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.charRoot = null;
    this.charRig = null;
    this.carRoot = null;
    this._raf = 0;
    this._lastT = 0;
    this._emote = null;
    this._emoteT = 0;
    this._emoteDur = 0;
    this._fpsLimiter = 0;
    this._fitValue = 0;   /* legacy – build now lives in Wardrobe.config.build */
    this._dom = null;
    this._isDragging = false;
    this._lastX = 0;
    this._targetRotY = 0;
    this._categories = WARDROBE_TABS.map(t => ({ id: t.id, label: t.label, groups: t.groups.length }));
    this._activeCategory = null;
    this._emoteButtons = {};
    this._dragHintTimer = null;
    this._sceneAnchor = null;
    this._charAnchor = null;
    this._carAnchor = null;
    this._onResize = () => this._resize();
    this._onKey = (e) => { if (e.key === "Escape" && this.visible) this.close(); };
  }

  /* ────────────────────────────────────────────────────────
     OPEN / CLOSE
     ──────────────────────────────────────────────────────── */
  open() {
    try {
      if (!this._built) this._build();
    } catch (e) {
      console.warn("[hub] build failed", e);
      return;
    }
    this.visible = true;
    this._dom.root.classList.add("on");
    this._resize();
    requestAnimationFrame(() => this._layout());
    this._rebuildAvatar();
    this._rebuildCar();
    this._startLoop();
    const nameInput = this._dom.root.querySelector("#tb-name");
    if (nameInput) {
      const n = (window.__ph3d_auth && window.__ph3d_auth.profile && window.__ph3d_auth.profile.username)
        || localStorage.getItem("ph3d.player.name") || "";
      nameInput.value = n;
    }
    let seen = null;
    try { seen = sessionStorage.getItem(WELCOME_KEY); } catch (e) {}
    if (!seen) this._showWelcome(); else this._showDragHint();
  }

  close() {
    this.visible = false;
    if (this._nameKb) this._nameKb.deactivate();
    this._stopLoop();
    if (this._dom && this._dom.root) {
      this._dom.root.classList.remove("on");
      this._dom.root.classList.remove("tb-rack-open", "tb-typing");
      this._dom.rack.classList.remove("on");
      this._dom.root.querySelectorAll(".tb-tab").forEach(b => b.classList.remove("on"));
    }
    this._activeCategory = null;
    this._hideWelcome();
  }

  /* ────────────────────────────────────────────────────────
     BUILD DOM + THREE SCENE (once)
     ──────────────────────────────────────────────────────── */
  _build() {
    injectCSS();
    const root = document.createElement("div");
    root.id = "ph3d-hub";
    root.innerHTML = `
      <canvas class="tb-render"></canvas>
      <div class="tb-grain"></div>
      <div class="tb-crease"></div>
      <div class="tb-mirror-frame"></div>
      <div class="tb-drag-hint hide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
        <span>Drag to turn</span>
      </div>
      <div class="tb-masthead">
        <div class="tb-mast-left">
          <div class="tb-mast-title">Tailor</div>
          <div class="tb-mast-rule"></div>
          <div class="tb-mast-sub">Made to measure</div>
        </div>
        <div class="tb-mast-right">
          <button class="tb-help" id="tb-help" aria-label="Help">?</button>
          <button class="tb-wings" id="tb-body">Body</button>
          <button class="tb-wings" id="tb-wings">✦ Wings</button>
          <button class="tb-close" id="tb-close">Close</button>
        </div>
      </div>
      <div class="tb-tabs" id="tb-tabs"></div>
      <div class="tb-rack" id="tb-rack">
        <div class="tb-rack-head">
          <div class="tb-rack-handle"></div>
          <div class="tb-rack-headline">
            <span class="tb-rack-title" id="tb-rack-title"></span>
            <span class="tb-rack-count" id="tb-rack-count"></span>
            <button class="tb-rack-close" id="tb-rack-close" aria-label="Close panel">✕</button>
          </div>
        </div>
        <div id="tb-rack-body"></div>
      </div>
      <div class="tb-slip">
        <div class="tb-slip-lbl">Name on the order</div>
        <div class="tb-slip-row">
          <div id="tb-name" class="tb-name-field" data-placeholder="your name"></div>
          <button class="tb-save" id="tb-save">Save</button>
        </div>
      </div>
      <div class="tb-stamps" id="tb-stamps"></div>
      <div class="tb-welcome" id="tb-welcome">
        <div class="tb-welcome-card">
          <div class="tb-welcome-eyebrow">Welcome to the</div>
          <div class="tb-welcome-h">Tailor</div>
          <div class="tb-welcome-rule"></div>
          <ul class="tb-welcome-list">
            <li><strong>Drag</strong> the mirror to turn your character.</li>
            <li><strong>Tap a tab</strong> (Body, Top, …) to open its rack.</li>
            <li><strong>Pick</strong> styles and colours — changes apply instantly.</li>
            <li><strong>Stamps</strong> at the bottom play emotes.</li>
            <li><strong>?</strong> reopens this card any time.</li>
          </ul>
          <button class="tb-welcome-ok" id="tb-welcome-ok">Got it</button>
        </div>
      </div>`;
    document.body.appendChild(root);

    this._dom = {
      root,
      canvas: root.querySelector("canvas.tb-render"),
      tabs: root.querySelector("#tb-tabs"),
      rack: root.querySelector("#tb-rack"),
      welcome: root.querySelector("#tb-welcome"),
      dragHint: root.querySelector(".tb-drag-hint"),
    };

    /* three.js */
    const lowTier = Quality.current && Quality.current.tier === "low";
    this.renderer = new THREE.WebGLRenderer({ canvas: this._dom.canvas, antialias: !lowTier, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowTier ? 1.5 : 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#ece4d2");
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 1.02, 5.9);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8ad96, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(2.5, 4, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffe2c0, 0.35);
    rim.position.set(-3, 2, -3);
    this.scene.add(rim);

    this._sceneAnchor = new THREE.Group();
    this._charAnchor = new THREE.Group();
    this._carAnchor = new THREE.Group();
    this._carAnchor.position.set(-2.6, 0, -2.2);
    this._sceneAnchor.add(this._charAnchor);
    this._sceneAnchor.add(this._carAnchor);
    this.scene.add(this._sceneAnchor);

    this._categories = WARDROBE_TABS.map(t => ({ id: t.id, label: t.label, groups: t.groups.length }));
    this._buildTabs();
    this._buildStamps();

    /* Controls */
    root.querySelector("#tb-rack-close").onclick = () => this._toggleCategory(this._activeCategory);
    root.querySelector("#tb-close").onclick = () => this.close();
    root.querySelector("#tb-help").onclick = () => this._showWelcome();
    root.querySelector("#tb-wings").onclick = () => this._toggleWingsPanel();
    root.querySelector("#tb-body").onclick = () => this._toggleBodyPanel();
    root.querySelector("#tb-welcome-ok").onclick = () => this._hideWelcome();

    const nameInput = root.querySelector("#tb-name");
    const saveName = () => {
      let n = (nameInput.value || "").trim().slice(0, 16);
      if (n.length < 2) return;
      try { localStorage.setItem("ph3d.player.name", n); } catch (e) {}
      try {
        const A = window.__ph3d_auth;
        if (A && A.profile) A.profile.username = n;
      } catch (e) {}
      const el = document.getElementById("pp-name");
      if (el) el.textContent = n;
      nameInput.blur();
    };
    root.querySelector("#tb-save").onclick = saveName;
    /* the game's own keyboard — the system keyboard never opens, so the hub never jumps around */
    this._nameKb = GameKeyboard.attach(nameInput, {
      maxLength: 16,
      onSubmit: saveName,
      onEscape: () => this.close(),
      onResize: (h) => { root.style.setProperty("--tb-kb", h + "px"); root.classList.toggle("tb-typing", h > 0); this._layout(); },
    });

    /* Drag to rotate */
    const cv = this._dom.canvas;
    cv.addEventListener("pointerdown", (e) => {
      this._isDragging = true;
      this._lastX = e.clientX;
      this._hideDragHint();
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener("pointermove", (e) => {
      if (!this._isDragging) return;
      this._targetRotY += (e.clientX - this._lastX) * 0.012;
      this._lastX = e.clientX;
    });
    const endDrag = () => { this._isDragging = false; };
    cv.addEventListener("pointerup", endDrag);
    cv.addEventListener("pointercancel", endDrag);

    window.addEventListener("resize", this._onResize);
    window.addEventListener("keydown", this._onKey);

    this._built = true;
  }

  _resize() {
    if (!this.renderer || !this._dom) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._adjustCamera();
    this._layout();
  }

  /* Landscape phones: tabs left · character middle · options panel right. The character is nudged
     (camera view offset) so it stays centred in the free space between the two columns. */
  _isLand() { return window.innerWidth > window.innerHeight && window.innerHeight <= 520; }
  _layout() {
    if (!this._dom || !this._dom.root) return;
    const root = this._dom.root, W = window.innerWidth;
    if (!this._isLand()) { root.style.removeProperty("--tb-cx"); this._viewTarget = 0; return; }
    const tr = this._dom.tabs.getBoundingClientRect();
    const left = tr.right + 8;
    const open = root.classList.contains("tb-rack-open");
    const right = open ? this._dom.rack.offsetLeft - 8 : W - 12;
    const cx = Math.round((left + right) / 2);
    root.style.setProperty("--tb-cx", cx + "px");
    this._viewTarget = W / 2 - cx;
  }
  _stepView(dt) {
    const tgt = this._viewTarget || 0;
    this._viewCur = (this._viewCur || 0) + (tgt - (this._viewCur || 0)) * Math.min(1, dt * 9);
    const W = window.innerWidth, H = window.innerHeight;
    if (Math.abs(this._viewCur) > 0.4) this.camera.setViewOffset(W, H, this._viewCur, 0, W, H);
    else if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();
  }

  _adjustCamera() {
    if (!this.camera) return;
    const aspect = window.innerWidth / window.innerHeight;
    const baseZ = 5.9;
    const z = Math.max(baseZ, baseZ * Math.pow(1 / Math.max(aspect, 0.3), 0.4));
    this.camera.position.z = z;
    this.camera.lookAt(0, 1.02, 0);
  }

  _buildTabs() {
    const tabs = this._dom.tabs;
    tabs.innerHTML = "";
    this._categories.forEach(cat => {
      const b = document.createElement("button");
      b.className = "tb-tab";
      b.dataset.cat = cat.id;
      b.innerHTML =
        `<span>${cat.label}</span>` +
        `<span class="tb-tab-count">${cat.groups}</span>`;
      b.onclick = () => this._toggleCategory(cat.id);
      tabs.appendChild(b);
    });
  }

  _toggleCategory(catId) {
    const root = this._dom.root;
    const rack = this._dom.rack;
    this._hideDragHint();

    if (this._activeCategory === catId) {
      this._activeCategory = null;
      root.classList.remove("tb-rack-open");
      root.querySelectorAll(".tb-tab").forEach(b => b.classList.remove("on"));
      rack.classList.remove("on");
      this._layout();
      return;
    }
    this._activeCategory = catId;
    root.querySelectorAll(".tb-tab").forEach(b =>
      b.classList.toggle("on", b.dataset.cat === catId));
    const cat = this._categories.find(c => c.id === catId);
    this._renderRack(catId, cat.label);
    rack.classList.add("on");
    root.classList.add("tb-rack-open");
    this._layout();
  }

  _toggleBodyPanel() {
    const root=this._dom.root, rack=this._dom.rack;
    this._hideDragHint(); this._activeCategory="__body";
    root.querySelectorAll(".tb-tab").forEach(b=>b.classList.remove("on"));
    root.querySelector("#tb-rack-title").textContent="Body Types & Styles";
    root.querySelector("#tb-rack-count").textContent="CUSTOM FIT";
    const body=root.querySelector("#tb-rack-body"), selected=getBodySelection();
    const typeCards=[{id:"faceted",name:"Faceted",price:0,desc:"Default faceted character body."},...BODY_TYPES].map(x=>{
      const active=selected.type===x.id, owned=x.id==="faceted"||ownsBodyItem("types",x.id);
      return `<article class="tb-wing-card"><div class="tb-group-label"><em>◈</em> BODY TYPE</div><h3>${x.name}</h3><p>${x.desc}</p><div class="tb-wing-meta"><span>${active?'<b class="tb-wing-equipped">SELECTED</b>':owned?"OWNED":Economy.format(x.price)}</span><button class="tb-wing-action" data-body-type="${x.id}">${active?"SELECTED":owned?"USE":"PURCHASE"}</button></div></article>`;
    }).join("");
    const styleCards=[{id:"faceted",name:"Faceted Default",price:0,desc:"The game's signature faceted finish."},...BODY_STYLES].map(x=>{
      const active=selected.style===x.id, owned=x.id==="faceted"||ownsBodyItem("styles",x.id);
      return `<article class="tb-wing-card"><div class="tb-group-label"><em>✧</em> BODY STYLE</div><h3>${x.name}</h3><p>${x.desc}</p><div class="tb-wing-meta"><span>${active?'<b class="tb-wing-equipped">SELECTED</b>':owned?"OWNED":Economy.format(x.price)}</span><button class="tb-wing-action" data-body-style="${x.id}">${active?"SELECTED":owned?"USE":"PURCHASE"}</button></div></article>`;
    }).join("");
    body.innerHTML=`<div class="tb-note">Five additional body proportions and six purchasable body finishes. Faceted remains the free default.</div><h3 class="tb-group-label">BODY TYPE</h3>${typeCards}<h3 class="tb-group-label">BODY STYLE</h3>${styleCards}`;
    const apply=()=>{Wardrobe.config.look=selected.style==="faceted"?"faceted":(BODY_STYLES.find(x=>x.id===selected.style)?.look||"faceted");Wardrobe.config.bodyStyle=selected.style;const t=BODY_TYPES.find(x=>x.id===selected.type);Wardrobe.config.build=t?t.build:0;Wardrobe.config.bodyHeight=t?t.height:1;Wardrobe.save();this._rebuildAvatar();this._toggleBodyPanel();};
    body.querySelectorAll("[data-body-type]").forEach(btn=>btn.onclick=()=>{const id=btn.dataset.bodyType;if(id!=="faceted"&&!ownsBodyItem("types",id)){const r=purchaseBodyItem("types",id);if(!r.ok){btn.textContent=r.reason==="funds"?"NOT ENOUGH FUNDS":"UNAVAILABLE";return;}}selected.type=id;setBodySelection("type",id);apply();});
    body.querySelectorAll("[data-body-style]").forEach(btn=>btn.onclick=()=>{const id=btn.dataset.bodyStyle;if(id!=="faceted"&&!ownsBodyItem("styles",id)){const r=purchaseBodyItem("styles",id);if(!r.ok){btn.textContent=r.reason==="funds"?"NOT ENOUGH FUNDS":"UNAVAILABLE";return;}}selected.style=id;setBodySelection("style",id);apply();});
    rack.classList.add("on");root.classList.add("tb-rack-open");this._layout();
  }

  _toggleWingsPanel() {
    const root=this._dom.root, rack=this._dom.rack;
    this._hideDragHint();
    this._activeCategory="__wings";
    root.querySelectorAll(".tb-tab").forEach(b=>b.classList.remove("on"));
    this._dom.root.querySelector("#tb-rack-title").textContent="Wings & Regalia";
    this._dom.root.querySelector("#tb-rack-count").textContent="03 · DESIGNS";
    const body=this._dom.root.querySelector("#tb-rack-body");
    const wings=getStyleItems().filter(x=>x.category==="Wings");
    const equipped=getEquippedWing();
    body.innerHTML=wings.map(w=>{
      const active=equipped===w.id;
      const owned=w.owned;
      const tone=w.id==="angel_wings"?"PEARL · GOLD":w.id==="shadow_wings"?"OBSIDIAN · AMETHYST":"SAPPHIRE · NEON";
      return `<article class="tb-wing-card"><div class="tb-group-label"><em>✦</em>${tone}</div><h3>${w.name}</h3><p>${w.desc}</p><div class="tb-wing-meta"><span>${active?'<span class="tb-wing-equipped">EQUIPPED</span>':owned?'OWNED':Economy.format(w.price)}</span><button class="tb-wing-action" data-wing="${w.id}" ${!owned&&Economy.balance<w.price?'':' '}>${active?'UNEQUIP':owned?'EQUIP':'PURCHASE'}</button></div></article>`;
    }).join("")+`<div class="tb-note">One pair can be worn at a time. Your selection is saved on this device and appears on your character in the world.</div>`;
    body.querySelectorAll("[data-wing]").forEach(btn=>btn.onclick=()=>{
      const id=btn.dataset.wing;
      if(getEquippedWing()===id){setEquippedWing(null);}
      else if(getStyleItems().find(x=>x.id===id)?.owned){setEquippedWing(id);}
      else {const result=purchaseStyleItem(id); if(!result.ok){btn.textContent=result.reason==="funds"?"NOT ENOUGH FUNDS":"UNAVAILABLE";return;} setEquippedWing(id);}
      this._rebuildAvatar();
      try { const player=window.__ph3d_walkCtrl; if(player?.avatar) attachCosmeticWings(player.avatar); } catch {}
      this._toggleWingsPanel();
      try { window.__ph3d_phone?._toast(getEquippedWing()?"Wings equipped":"Wings put away"); } catch {}
    });
    rack.classList.add("on"); root.classList.add("tb-rack-open"); this._layout();
  }

  _renderRack(catId, title) {
    const cfg = Wardrobe.config;
    const bodyEl  = this._dom.root.querySelector("#tb-rack-body");
    const titleEl = this._dom.root.querySelector("#tb-rack-title");
    const countEl = this._dom.root.querySelector("#tb-rack-count");
    const tab = WARDROBE_TABS.find(t => t.id === catId);
    if (!tab) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = "";
    let groupCount = 0;

    const addGroup = (label, content) => {
      const g = document.createElement("div");
      g.className = "tb-group";
      const lbl = document.createElement("div");
      lbl.className = "tb-group-label";
      lbl.innerHTML = `<em>·</em>${label}`;
      g.appendChild(lbl);
      g.appendChild(content);
      bodyEl.appendChild(g);
      groupCount++;
    };
    const refresh = () => { this._rebuildAvatar(); this._renderRack(catId, title); };
    const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), Wardrobe.config);

    const chips = (opts, cur, onPick, icons) => {
      const wrap = document.createElement("div");
      wrap.className = "tb-chip-set";
      opts.forEach(o => {
        const c = document.createElement("button");
        c.className = "tb-chip" + (o === cur ? " on" : "");
        c.textContent = (icons && icons[o] ? icons[o] + " " : "") + o;
        c.onclick = () => onPick(o);
        wrap.appendChild(c);
      });
      return wrap;
    };

    /* swatches + a "custom colour" wheel (+ optional "auto / default" swatch) */
    const swatches = (palette, cur, onPick, autoLabel) => {
      const wrap = document.createElement("div");
      wrap.className = "tb-swatch-set";
      if (autoLabel) {
        const a = document.createElement("div");
        a.className = "tb-swatch tb-swatch-auto" + (cur == null ? " on" : "");
        a.title = autoLabel; a.textContent = "↺";
        a.onclick = () => onPick(null);
        wrap.appendChild(a);
      }
      palette.forEach((col, i) => {
        const sw = document.createElement("div");
        sw.className = "tb-swatch" + (cur === i ? " on" : "");
        sw.style.background = col;
        sw.onclick = () => onPick(i);
        wrap.appendChild(sw);
      });
      const isCustom = typeof cur === "string";
      const cu = document.createElement("label");
      cu.className = "tb-swatch tb-swatch-custom" + (isCustom ? " on" : "");
      cu.title = "Custom colour";
      if (isCustom) cu.style.background = cur;
      const inp = document.createElement("input");
      inp.type = "color";
      inp.value = isCustom ? cur : (palette[typeof cur === "number" ? cur : 0] || "#888888");
      inp.oninput = () => { cu.style.background = inp.value; };
      inp.onchange = () => onPick(inp.value);
      cu.appendChild(inp);
      wrap.appendChild(cu);
      return wrap;
    };

    tab.groups.forEach(gr => {
      if (gr.when && !gr.when(cfg)) return;
      if (gr.kind === "pills") {
        addGroup(gr.label, chips(gr.options, cfg[gr.key], (o) => { Wardrobe.set(gr.key, o); refresh(); }));
        if (gr.note) {
          const n = gr.note(cfg);
          if (n) { const el = document.createElement("div"); el.className = "tb-note"; el.textContent = n; bodyEl.lastChild.appendChild(el); }
        }
      } else if (gr.kind === "color") {
        addGroup(gr.label, swatches(gr.palette, get(gr.key), (v) => { Wardrobe.set(gr.key, v); this._rebuildAvatar(); this._renderRack(catId, title); }, gr.auto));
      } else if (gr.kind === "slider") {
        const fitWrap = document.createElement("div");
        fitWrap.className = "tb-fit";
        fitWrap.innerHTML =
          `<div class="tb-fit-labels"><span>${gr.lo}</span><span>${gr.hi}</span></div>` +
          `<input type="range" min="${gr.min}" max="${gr.max}" step="${gr.step}" value="${+get(gr.key) || 0}"/>`;
        const slider = fitWrap.querySelector("input");
        let t = 0;
        slider.oninput = () => {
          cancelAnimationFrame(t);
          t = requestAnimationFrame(() => { Wardrobe.set(gr.key, parseFloat(slider.value)); this._rebuildAvatar(); });
        };
        addGroup(gr.label, fitWrap);
      } else if (gr.kind === "item" || gr.kind === "costume") {
        const cur = get(gr.key);
        const isCostume = gr.kind === "costume";
        const curStyle = isCostume ? (cur || "none") : (cur && cur.style) || "none";
        const icons = isCostume ? Object.fromEntries(Object.entries(COSTUME_INFO).map(([k, v]) => [k, v.icon])) : null;
        addGroup(gr.label, chips(["none", ...gr.options], curStyle, (o) => {
          if (isCostume) Wardrobe.set("costume", o === "none" ? null : o);
          else Wardrobe.setItem(gr.key, o);
          refresh();
        }, icons));
        if (!isCostume && cur && gr.colors) {
          gr.colors.forEach(cc => {
            addGroup(cc.label, swatches(cc.palette, cur[cc.sub], (v) => {
              Wardrobe.set(gr.key + "." + cc.sub, v); this._rebuildAvatar(); this._renderRack(catId, title);
            }, cc.auto));
          });
        }
      }
    });

    countEl.textContent = String(groupCount).padStart(2, "0") + " · groups";
  }

  _buildStamps() {
    const wrap = this._dom.root.querySelector("#tb-stamps");
    const list = [
      { id: "wave",     ico: "☻", label: "Wave"  },
      { id: "clap",     ico: "☺", label: "Clap"  },
      { id: "flex",     ico: "✦", label: "Flex"  },
      { id: "meditate", ico: "☾", label: "Zen"   },
      { id: "dance",    ico: "♪", label: "Dance" },
    ];
    this._emoteButtons = {};
    list.forEach(em => {
      const b = document.createElement("button");
      b.className = "tb-stamp";
      b.dataset.emote = em.id;
      b.innerHTML =
        `<span class="tb-stamp-ico">${em.ico}</span>` +
        `<span>${em.label}</span>`;
      b.onclick = () => this.playEmote(em.id);
      wrap.appendChild(b);
      this._emoteButtons[em.id] = b;
    });
  }

  /* ────────────────────────────────────────────────────────
     WELCOME / DRAG HINT
     ──────────────────────────────────────────────────────── */
  _showWelcome() {
    if (!this._dom || !this._dom.welcome) return;
    this._dom.welcome.classList.add("on");
    sessionStorage.setItem(WELCOME_KEY, "1");
    this._hideDragHint();
  }

  _hideWelcome() {
    if (!this._dom || !this._dom.welcome) return;
    this._dom.welcome.classList.remove("on");
    this._showDragHint();
  }

  _showDragHint() {
    if (!this._dom || !this._dom.dragHint) return;
    if (sessionStorage.getItem(DRAG_HINT_KEY)) return;
    this._dom.dragHint.classList.remove("hide");
    if (this._dragHintTimer) clearTimeout(this._dragHintTimer);
    this._dragHintTimer = setTimeout(() => this._hideDragHint(), 8000);
  }

  _hideDragHint() {
    if (!this._dom || !this._dom.dragHint) return;
    if (this._dom.dragHint.classList.contains("hide")) return;
    this._dom.dragHint.classList.add("hide");
    sessionStorage.setItem(DRAG_HINT_KEY, "1");
    if (this._dragHintTimer) { clearTimeout(this._dragHintTimer); this._dragHintTimer = null; }
  }

  /* ────────────────────────────────────────────────────────
     AVATAR / CAR REBUILD
     ──────────────────────────────────────────────────────── */
  _rebuildAvatar() {
    /* fast path: recolour or rebuild the existing avatar in place */
    if (this.charRoot && this.charRig && this.charRig.mats) {
      try {
        if (liveApplyConfig(this.charRoot, this.charRig, Wardrobe.config)) {
          this._resetIdlePose();
          attachCosmeticWings(this.charRoot);
          return;
        }
      } catch (e) { console.warn("[hub] live wardrobe", e); }
    }
    if (this.charRoot) {
      this._charAnchor.remove(this.charRoot);
      this._disposeTree(this.charRoot);
      this.charRoot = null;
      this.charRig = null;
    }
    const built = buildCharacter(Wardrobe.config);
    this.charRoot = built.root;
    this.charRig = built.rig;
    this.charRoot.position.set(0, 0, 0);
    this.charRoot.rotation.y = 0;
    this._charAnchor.add(this.charRoot);
    try { attachCosmeticWings(this.charRoot); } catch (e) { console.warn("[hub] wing preview",e); }
    this._applyFit();
    this._resetIdlePose();
  }

  _applyFit() { /* body build is baked into the character by lowpoly.js (config.build) */ }

  _rebuildCar() {
    if (!this._carAnchor) return;
    if (this.carRoot) {
      this._carAnchor.remove(this.carRoot);
      this._disposeTree(this.carRoot);
      this.carRoot = null;
    }
    const v = State.vehicle || {};
    const modelId = v.model || "scrappy";
    const body = v.body || "#4d6b74";
    const rim = v.rim || "#8d9298";
    let car;
    try { car = buildSelectedCar(modelId, body, rim); }
    catch (e) { return; }

    if (CAR_FRONT_CORRECTION[modelId] !== undefined) {
      car.rotation.y = CAR_FRONT_CORRECTION[modelId];
    }
    const box = new THREE.Box3().setFromObject(car);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 3.2 / maxDim;
    car.scale.setScalar(s);

    const box2 = new THREE.Box3().setFromObject(car);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    car.position.x -= center.x;
    car.position.z -= center.z;
    car.position.y -= box2.min.y;

    this._carAnchor.add(car);
    this.carRoot = car;
  }

  /* ────────────────────────────────────────────────────────
     EMOTE STATE
     ──────────────────────────────────────────────────────── */
  playEmote(name) {
    if (!EMOTES[name]) return;
    if (!isEmoteUnlocked(name)) { openStyleAbilityShop(); return; }
    this._emote = name;
    this._emoteT = 0;
    this._emoteDur = EMOTES[name].dur;
    for (const [id, btn] of Object.entries(this._emoteButtons)) {
      btn.classList.toggle("on", id === name);
    }
    this._resetIdlePose();
  }

  _resetIdlePose() {
    if (!this.charRig) return;
    const R = this.charRig;
    if (R.hips)  { R.hips.rotation.set(0, 0, 0); R.hips.position.y = 0.935; }
    if (R.spine) { R.spine.rotation.set(0, 0, 0); R.spine.position.set(0, 0.06, 0); }
    if (R.neck)  R.neck.rotation.set(0, 0, 0);
    if (R.head)  R.head.rotation.set(0, 0, 0);
    for (const arm of [R.armL, R.armR]) {
      if (!arm) continue;
      if (arm.shoulder) arm.shoulder.rotation.set(0, 0, 0);
      if (arm.elbow)    arm.elbow.rotation.set(0, 0, 0);
      if (arm.wrist)    arm.wrist.rotation.set(0, arm === R.armL ? 1.2 : -1.2, 0);
      if (arm.fingers) for (const f of arm.fingers) {
        if (f.group)    f.group.rotation.x = 0;
        if (f.midJoint) f.midJoint.rotation.x = 0;
      }
      if (arm.thumb) arm.thumb.rotation.set(0, 0, 0);
    }
    for (const leg of [R.legL, R.legR]) {
      if (!leg) continue;
      if (leg.hip)   leg.hip.rotation.set(0, 0, 0);
      if (leg.knee)  leg.knee.rotation.set(0, 0, 0);
      if (leg.ankle) leg.ankle.rotation.set(0, 0, 0);
    }
  }

  _tickEmote(dt) {
    if (!this._emote || !this.charRig) return;
    this._emoteT += dt;
    const t = this._emoteT;
    const dur = this._emoteDur;
    const R = this.charRig;

    if (t >= dur) {
      this._emote = null;
      for (const b of Object.values(this._emoteButtons)) b.classList.remove("on");
      this._resetIdlePose();
      return;
    }
    const norm = t / dur;
    const blend = norm < 0.10 ? norm / 0.10
                : norm > 0.85 ? (1 - norm) / 0.15
                : 1;
    switch (this._emote) {
      case "wave":     this._poseWave(t, blend, R); break;
      case "clap":     this._poseClap(t, blend, R); break;
      case "flex":     this._poseFlex(t, blend, R); break;
      case "meditate": this._poseMeditate(t, blend, R); break;
      case "dance":    this._poseDance(t, blend, R); break;
    }
  }

  _poseWave(t, k, R) {
    const osc = Math.sin(t * 12) * 0.45;
    const sway = Math.sin(t * 6) * 0.1;
    if (R.armR) {
      R.armR.shoulder.rotation.z = -1.4 * k;
      R.armR.shoulder.rotation.x = 0.2 * k;
      R.armR.elbow.rotation.z = -1.8 * k + osc * k;
      R.armR.wrist.rotation.y = 2.8 * k;
      R.armR.wrist.rotation.z = Math.cos(t * 12) * 0.3 * k;
    }
    if (R.head) { R.head.rotation.y = -0.2 * k; R.head.rotation.z = sway; }
    if (R.spine) R.spine.rotation.z = -0.05 * k + sway;
    if (R.hips)  R.hips.rotation.z = sway * 0.5;
    setHand(R.armR, -1, "open");
  }

  _poseClap(t, k, R) {
    const phase = (t * 3.5) % 1;
    const clap = phase < 0.25 ? Math.sin((phase / 0.25) * Math.PI) : 0;
    const bounce = Math.max(0, clap);
    if (R.armL) {
      R.armL.shoulder.rotation.x = -0.8 * k - 0.6 * clap * k;
      R.armL.shoulder.rotation.z = 0.4 * k;
      R.armL.elbow.rotation.x = -1.6 * k;
    }
    if (R.armR) {
      R.armR.shoulder.rotation.x = -0.8 * k - 0.6 * clap * k;
      R.armR.shoulder.rotation.z = -0.4 * k;
      R.armR.elbow.rotation.x = -1.6 * k;
    }
    if (R.spine) R.spine.rotation.x = 0.05 * k + 0.08 * clap * k;
    if (R.hips)  R.hips.position.y = 0.935 - 0.06 * bounce * k;
    if (R.head)  R.head.rotation.x = -0.1 * clap * k;
    setHand(R.armL, +1, "open");
    setHand(R.armR, -1, "open");
  }

  _poseFlex(t, k, R) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 8.0 - 1.2);
    const sway  = Math.sin(t * 4.0) * 0.05;
    if (R.armL) {
      R.armL.shoulder.rotation.z = 1.6 * k + 0.1 * pulse * k;
      R.armL.elbow.rotation.z    = 2.2 * k + 0.15 * pulse * k;
      R.armL.wrist.rotation.y    = -1.5 * k;
    }
    if (R.armR) {
      R.armR.shoulder.rotation.z = -1.6 * k - 0.1 * pulse * k;
      R.armR.elbow.rotation.z    = -2.2 * k - 0.15 * pulse * k;
      R.armR.wrist.rotation.y    = 1.5 * k;
    }
    if (R.spine) {
      R.spine.rotation.x = -0.1 * k - 0.05 * pulse * k;
      R.spine.rotation.z = sway * k;
    }
    if (R.head) R.head.rotation.z = sway * 1.5 * k;
    if (R.hips) R.hips.rotation.z = -sway * k;
    setHand(R.armL, +1, "fist");
    setHand(R.armR, -1, "fist");
  }

  _poseMeditate(t, k, R) {
    const float = Math.sin(t * 1.5) * 0.08;
    if (R.hips) R.hips.position.y = 0.935 - 0.73 * k + float * k;
    if (R.legL && R.legL.hip) {
      R.legL.hip.rotation.x = -2.4 * k;
      R.legL.hip.rotation.z = 0.855 * k;
      R.legL.knee.rotation.x = 2.543 * k;
      if (R.legL.ankle) R.legL.ankle.rotation.x = 0.35 * k;
    }
    if (R.legR && R.legR.hip) {
      R.legR.hip.rotation.x = -2.4 * k;
      R.legR.hip.rotation.z = -0.855 * k;
      R.legR.knee.rotation.x = 2.543 * k;
      if (R.legR.ankle) R.legR.ankle.rotation.x = 0.35 * k;
    }
    if (R.armL) {
      R.armL.shoulder.rotation.x = -0.31 * k;
      R.armL.shoulder.rotation.z = 0.13 * k;
      R.armL.elbow.rotation.x = -0.81 * k;
      R.armL.wrist.rotation.y = Math.PI * k;
    }
    if (R.armR) {
      R.armR.shoulder.rotation.x = -0.31 * k;
      R.armR.shoulder.rotation.z = -0.13 * k;
      R.armR.elbow.rotation.x = -0.81 * k;
      R.armR.wrist.rotation.y = -Math.PI * k;
    }
    if (R.spine) R.spine.rotation.x = 0.05 * k + Math.sin(t * 1.7) * 0.02 * k;
    if (R.head)  R.head.rotation.x = 0.07 * k;
    setHand(R.armL, +1, "mudra");
    setHand(R.armR, -1, "mudra");
  }

  _poseDance(t, k, R) {
    const b = t * 2.5;
    const bounce = Math.abs(Math.sin(Math.PI * b));
    const sway = Math.sin(Math.PI * b);
    if (R.hips) {
      R.hips.position.y = 0.935 - 0.08 * bounce * k;
      R.hips.rotation.y = -sway * 0.3 * k;
      R.hips.rotation.z = sway * 0.1 * k;
    }
    if (R.spine) {
      R.spine.rotation.y = sway * 0.4 * k;
      R.spine.rotation.x = 0.05 * k + 0.08 * bounce * k;
      R.spine.rotation.z = -sway * 0.1 * k;
    }
    if (R.head) {
      R.head.rotation.y = -sway * 0.2 * k;
      R.head.rotation.z = sway * 0.1 * k;
      R.head.rotation.x = -0.1 * bounce * k;
    }
    if (R.legL && R.legR) {
      const liftL = Math.max(0, sway);
      const liftR = Math.max(0, -sway);
      R.legL.hip.rotation.x  = -liftL * 0.6 * k;
      R.legL.knee.rotation.x =  liftL * 0.9 * k;
      R.legR.hip.rotation.x  = -liftR * 0.6 * k;
      R.legR.knee.rotation.x =  liftR * 0.9 * k;
    }
    const armL = Math.sin(Math.PI * b);
    if (R.armL) {
      R.armL.shoulder.rotation.x = -1.2 * k + armL * 0.8 * k;
      R.armL.shoulder.rotation.z =  0.6 * k;
      R.armL.elbow.rotation.x    = -1.5 * k + armL * 0.6 * k;
    }
    if (R.armR) {
      R.armR.shoulder.rotation.x = -1.2 * k - armL * 0.8 * k;
      R.armR.shoulder.rotation.z = -0.6 * k;
      R.armR.elbow.rotation.x    = -1.5 * k - armL * 0.6 * k;
    }
    setHand(R.armL, +1, "fist");
    setHand(R.armR, -1, "fist");
  }

  /* ────────────────────────────────────────────────────────
     RENDER LOOP
     ──────────────────────────────────────────────────────── */
  _startLoop() {
    if (this._raf) return;
    this._lastT = performance.now();
    const loop = (t) => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - this._lastT) / 1000);
      this._lastT = t;
      if (!this.visible) return;
      this._stepView(dt);

      const tier = Quality.current.tier;
      const cap = tier === "low" ? 30 : tier === "medium" ? 45 : 60;
      this._fpsLimiter += dt;
      if (this._fpsLimiter < 1 / cap) return;
      this._fpsLimiter = 0;

      if (this._sceneAnchor) {
        this._sceneAnchor.rotation.y +=
          (this._targetRotY - this._sceneAnchor.rotation.y) * Math.min(1, dt * 8);
      }

      if (!this._emote && this.charRig) {
        const b = Math.sin(t * 0.0016);
        if (this.charRig.spine) {
          this.charRig.spine.rotation.x = b * 0.025;
          this.charRig.spine.position.y = 0.06 + b * 0.004;
        }
        if (this.charRig.hips) {
          this.charRig.hips.position.y = 0.935 + b * 0.004;
        }
        if (this.charRig.head) {
          this.charRig.head.rotation.y = Math.sin(t * 0.0009) * 0.05;
          this.charRig.head.rotation.x = Math.sin(t * 0.0012) * 0.02;
        }
      }
      if (this.charRoot) {
        const sway = Math.sin(t * 0.0005) * 0.03;
        this.charRoot.rotation.y = sway;
        try { updateCosmeticWings(this.charRoot,t/1000,{state:"standing",flip:false}); } catch {}
      }

      this._tickEmote(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this._raf = requestAnimationFrame(loop);
  }

  _stopLoop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _disposeTree(root) {
    if (!root) return;
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { if (m && m.dispose) m.dispose(); });
      }
    });
  }

  dispose() {
    this.close();
    if (this._dragHintTimer) clearTimeout(this._dragHintTimer);
    if (this.renderer) {
      try { this.renderer.dispose(); } catch (e) {}
      this.renderer = null;
    }
    if (this._dom && this._dom.root) this._dom.root.remove();
    window.removeEventListener("resize", this._onResize);
    this._built = false;
  }
}

export const Hub = new CharacterHub();
