/* ════════════════════════════════════════════════════════════════
   map-app.js — hand-inked city map with building-shaped landmarks
   Public API (unchanged):
     MapApp.open() · MapApp.close() · MapApp.isOpen()
   ════════════════════════════════════════════════════════════════
   Each landmark renders as its own silhouette:
     govhouse        · long white capitol with columns + gold dome
     governor        · gold crown-domed mansion
     hotel           · tall hotel tower with lit windows
     mansion         · wide white mansion with red roof
     myhouse         · Lagos flat mansion block
     prison          · barred cell block + towers
     statejail       · tall barred cell block
     showroom        · glass car showroom
     market          · colourful market stalls with awnings
     airport         · terminal + control tower + runway
     airplane        · swept-wing aircraft on the apron
     university      · university gate with arch
     classroom       · small schoolhouse
     computerlab     · blue tech block with glowing windows
     boropark        · park with trees + fountain
     citypark        · park with trees + gazebo
     pleasurepark    · ferris wheel
     hospital        · white block with red cross
     church          · church with cross
     mosque          · mosque with dome + minarets
     vatican         · basilica with big dome
     statehouse      · government building with flag
     zoo             · zoo cage + tree
     vastcity        · skyline of towers
     duplex          · two-story house
     lagosflat       · apartment block
     forest          · cluster of pine trees
     canteen         · cafeteria with striped awning + tables
     beach           · sea, sand and palm trees
     village         · cluster of huts
     realestate      · house with a "SALE" sign
     jobcenter       · briefcase sign on an office block
   ════════════════════════════════════════════════════════════════ */

import { LANDMARKS } from "../data/landmarks.js";

/* ──────────────────────────────────────────────────────────────
   0. CONSTANTS
   ────────────────────────────────────────────────────────────── */
const INK   = "#2a1d10";
const PAPER = "#efe3bb";
const PAPER2= "#e3d2a0";
const RED   = "#9c3a24";
const SERIF = "Georgia, 'Times New Roman', serif";

const W = { RING_R: 180, RING_RZ: 145, ROAD_W: 10, OFFSET: 10 + 3.5 + 34, LAND_X: 340, LAND_Z: 310 };
const MB = { x0: -415, x1: 355, z0: -335, z1: 452 };

/* Per-landmark ink colour used on the map. */
const LM_COLOR = {
  govhouse:"#c9a961", governor:"#d4b34a", hotel:"#e8c99a", mansion:"#e7e1d7",
  myhouse:"#f0c060", prison:"#8a8e94", statejail:"#8a8e94", showroom:"#c9d2da",
  market:"#e6a45e", airport:"#bfd3e2", airplane:"#dfe8f0", university:"#a8b4d8",
  classroom:"#f2d27a", computerlab:"#4a6a8e", boropark:"#88c68a", citypark:"#88c68a",
  pleasurepark:"#9dd1ff", hospital:"#e8f4f8", church:"#d8c8a8", mosque:"#c8e0d0",
  vatican:"#f0e4c0", statehouse:"#e4e0d4", zoo:"#7aba6a", vastcity:"#6a8aae",
  duplex:"#e8e4dc", lagosflat:"#e8c668", forest:"#3f7d3a", village:"#c8a070", canteen:"#e8a860", beach:"#35a9b4",
  realestate:"#f8ecd4", jobcenter:"#4aa0ff", nightclub:"#b04aff", phoneshop:"#2f9bff",
};

/* Tier-2 layout (kept identical to the old file). */
const TIER2 = {
  N: ["hospital", "church", "mosque", "vatican"],
  E: ["statehouse", "classroom", "computerlab", "zoo"],
  S: ["statejail", "vastcity", "duplex", "lagosflat"],
  W: ["forest", "citypark", "village", "nightclub", "canteen", "beach"],
};
function tier2Pos(lm) {
  for (const k of Object.keys(TIER2)) {
    const idx = TIER2[k].indexOf(lm.id);
    if (idx < 0) continue;
    const n = TIER2[k].length;
    const f = n > 1 ? (idx / (n - 1)) * 2 - 1 : 0;
    const R = W.RING_R, RZ = W.RING_RZ, O = W.OFFSET + 70;
    if (k === "N") return { x: f * R * 0.8, z: -RZ - O, side: 0 };
    if (k === "S") return { x: -f * R * 0.8, z: RZ + O, side: 2 };
    if (k === "E") return { x: R + O, z: f * RZ * 0.8, side: 1 };
    return { x: -R - O, z: -f * RZ * 0.8, side: 3 };
  }
  return null;
}
function compoundPos(lm, i) {
  if (lm.id === "phoneshop") return { x: 120, z: 320, side: 2 };
  if (lm.id === "airplane") return { x: 0, z: 420, side: -1 };
  const t2 = tier2Pos(lm);
  if (t2) return t2;
  const R = W.RING_R, RZ = W.RING_RZ, O = W.OFFSET;
  const side = i % 4, within = Math.floor(i / 4);
  if (side === 0) return { x: -R * 0.66 + within * R * 0.66, z: -RZ - O, side };
  if (side === 1) return { x: R + O, z: -RZ * 0.66 + within * RZ * 0.66, side };
  if (side === 2) return { x: R * 0.66 - within * R * 0.66, z: RZ + O, side };
  return { x: -R - O, z: RZ * 0.66 - within * RZ * 0.66, side };
}
const PLACES = LANDMARKS.map((lm, i) => {
  const p = compoundPos(lm, i);
  return { lm, id: lm.id, x: p.x, z: p.z, side: p.side, color: LM_COLOR[lm.id] || "#d0d6dc" };
});

function routeFor(pl) {
  if (pl.lm.kind === "parent") return { route: "minimap", params: { id: pl.id } };
  if (pl.id === "pleasurepark") return { route: "pleasurepark", params: { id: pl.id } };
  if (pl.id === "showroom")    return { route: "showroom", params: { id: pl.id } };
  if (pl.id === "airplane")    return { route: "airplane", params: {} };
  if (pl.id === "prison")      return { route: "prisonScene", params: {} };
  if (pl.id === "governor")    return { route: "governorScene", params: {} };
  return { route: "interior", params: { id: pl.id } };
}

/* ──────────────────────────────────────────────────────────────
   1. CSS
   ────────────────────────────────────────────────────────────── */
const CSS_ID = "ph3d-map-css";
function injectCSS() {
  const old = document.getElementById(CSS_ID);
  if (old) old.remove();
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    #ph3d-map-app {
      position: fixed; inset: 0; z-index: 100; display: none;
      background: #bdb868; color: ${INK};
      font-family: ${SERIF};
      user-select: none; -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
      overflow: hidden;
    }
    #ph3d-map-app.on { display: block; }
    #ph3d-map-canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }

    .ph3d-paper {
      background: linear-gradient(160deg, ${PAPER}, ${PAPER2});
      border: 2px solid ${INK};
      box-shadow: inset 0 0 0 3px ${PAPER}, inset 0 0 0 4px rgba(42,29,16,.55), 0 6px 16px rgba(30,20,5,.45);
    }

    #ph3d-map-hdr {
      position: absolute; top: 0; left: 0; right: 0; z-index: 2; pointer-events: none;
      padding: calc(env(safe-area-inset-top) + 10px) 14px 0;
      display: flex; align-items: center; justify-content: space-between;
    }
    #ph3d-map-hdr .ttl {
      padding: 8px 20px 7px; border-radius: 6px; text-align: center;
      font-size: 13px; font-weight: 700; letter-spacing: .22em; font-variant: small-caps;
    }
    #ph3d-map-hdr .ttl i { display: block; margin-top: 1px; font-size: 9px; letter-spacing: .3em; opacity: .65; font-weight: 400; font-style: normal; }
    #ph3d-map-close {
      pointer-events: auto; width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font: 700 16px ${SERIF}; cursor: pointer;
    }
    #ph3d-map-close:active { transform: scale(.94); }

    #ph3d-map-mini {
      position: absolute; left: 14px; top: calc(env(safe-area-inset-top) + 66px); z-index: 2;
      width: 104px; height: 120px; border: 3px solid ${INK}; border-radius: 3px;
      box-shadow: 0 0 0 2px ${PAPER}, 0 6px 14px rgba(30,20,5,.5); touch-action: none; cursor: pointer;
      background: #7aa0ab;
    }

    #ph3d-map-zoom {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%); z-index: 2;
      display: flex; flex-direction: column; overflow: hidden; border-radius: 24px;
    }
    #ph3d-map-zoom button {
      width: 42px; height: 42px; border: 0; background: transparent; color: ${INK};
      font: 700 20px ${SERIF}; cursor: pointer;
    }
    #ph3d-map-zoom button + button { border-top: 1px solid rgba(42,29,16,.35); }
    #ph3d-map-zoom button:active { background: rgba(42,29,16,.14); }

    #ph3d-map-dock {
      position: absolute; left: 0; right: 0; z-index: 2;
      bottom: calc(env(safe-area-inset-bottom) + 12px);
      display: flex; flex-direction: column; gap: 10px; pointer-events: none;
    }
    #ph3d-map-card {
      pointer-events: auto; margin: 0 14px; padding: 10px 12px 10px 10px;
      display: none; align-items: center; gap: 10px; border-radius: 10px;
    }
    #ph3d-map-card.on { display: flex; }
    #ph3d-map-card .ic { flex: 0 0 auto; width: 52px; height: 52px; }
    #ph3d-map-card .tx { flex: 1 1 auto; min-width: 0; }
    #ph3d-map-card .nm { font-size: 15px; font-weight: 700; letter-spacing: .04em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #ph3d-map-card .sb { margin-top: 3px; font-size: 11px; font-style: italic; opacity: .7;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #ph3d-map-card .go {
      flex: 0 0 auto; cursor: pointer; border-radius: 6px; padding: 11px 16px;
      background: ${RED}; color: ${PAPER}; border: 2px solid ${INK};
      font: 700 12px ${SERIF}; letter-spacing: .14em;
      box-shadow: inset 0 0 0 2px rgba(255,235,190,.35);
    }
    #ph3d-map-card .x {
      flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%; cursor: pointer;
      background: transparent; border: 1.5px solid rgba(42,29,16,.5); color: ${INK}; font-size: 11px;
    }

    #ph3d-map-strip {
      pointer-events: auto; display: flex; gap: 8px; overflow-x: auto; padding: 3px 14px 6px;
      scrollbar-width: none; -webkit-overflow-scrolling: touch;
    }
    #ph3d-map-strip::-webkit-scrollbar { display: none; }
    #ph3d-map-strip .chip {
      flex: 0 0 auto; display: flex; align-items: center; gap: 7px; cursor: pointer;
      padding: 8px 13px; border-radius: 6px; white-space: nowrap;
      background: linear-gradient(160deg, ${PAPER}, ${PAPER2}); border: 2px solid ${INK};
      box-shadow: 0 3px 8px rgba(30,20,5,.4);
      font: 700 11px ${SERIF}; letter-spacing: .06em; font-variant: small-caps;
    }
    #ph3d-map-strip .chip.on { background: ${INK}; color: ${PAPER}; }
    #ph3d-map-strip .chip .d { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid ${INK}; }
  `;
  document.head.appendChild(s);
}

/* ──────────────────────────────────────────────────────────────
   2. BUILDING SILHOUETTES  (canvas 128×128 each)
   ──────────────────────────────────────────────────────────────
   Every icon is drawn at 128×128 and cached. The map scales it.
   Palette per icon uses the LM_COLOR entry as the "base" colour.
   ────────────────────────────────────────────────────────────── */

const _iconCache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function ink(g, w) {
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = INK;
  g.lineWidth = w || 2.4;
}

function rect(g, x, y, w, h, fill) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
  g.strokeRect(x, y, w, h);
}

function poly(g, pts, fill) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.stroke();
}

function arc(g, x, y, r, a0, a1, fill) {
  g.beginPath();
  g.arc(x, y, r, a0, a1);
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.stroke();
}

function base(w, h, fill) {
  const c = makeCanvas(w, h);
  const g = c.getContext("2d");
  g.clearRect(0, 0, w, h);
  if (fill) {
    g.fillStyle = fill;
    g.fillRect(0, 0, w, h);
  }
  ink(g);
  return { c, g };
}

/* Each draw function receives (g, tint) where tint is the LM_COLOR
   for that landmark (base color). */

function drawGovhouse(g, t) {
  // Long white capitol with columns + gold dome
  rect(g, 12, 70, 104, 40, t);
  rect(g, 22, 60, 84, 12, "#efe4c8");
  for (let i = 0; i < 6; i++) rect(g, 24 + i * 14, 74, 6, 30, "#fdf6dc");
  // Dome
  g.fillStyle = "#c9a961";
  g.beginPath(); g.arc(64, 52, 22, Math.PI, 0); g.fill(); g.stroke();
  rect(g, 42, 52, 44, 10, "#c9a961");
  // Flag
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(64, 30); g.lineTo(64, 14); g.stroke();
  poly(g, [[64, 14], [78, 18], [64, 22]], "#3a7ac0");
  ink(g);
}

function drawGovernor(g, t) {
  rect(g, 14, 66, 100, 44, t);
  poly(g, [[14, 66], [64, 30], [114, 66]], "#c9a34a");
  rect(g, 42, 82, 44, 28, t);
  for (let i = 0; i < 4; i++) rect(g, 22 + i * 22, 76, 8, 30, "#fff2d0");
  // Crown
  g.fillStyle = "#ffd76b";
  g.beginPath();
  g.moveTo(54, 30); g.lineTo(58, 20); g.lineTo(64, 28);
  g.lineTo(70, 20); g.lineTo(74, 30);
  g.closePath();
  g.fill(); g.stroke();
  ink(g);
}

function drawHotel(g, t) {
  rect(g, 34, 22, 60, 88, t);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++)
    rect(g, 42 + c * 18, 30 + r * 13, 10, 8, "#7c5c30");
  rect(g, 30, 18, 68, 8, RED);
  // Flag
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(64, 18); g.lineTo(64, 6); g.stroke();
  poly(g, [[64, 6], [76, 9], [64, 12]], "#3a9a5a");
  ink(g);
}

function drawMansion(g, t) {
  rect(g, 14, 74, 100, 34, t);
  poly(g, [[10, 74], [34, 50], [58, 74]], RED);
  poly(g, [[70, 74], [94, 50], [118, 74]], RED);
  poly(g, [[40, 74], [64, 44], [88, 74]], RED);
  for (let i = 0; i < 5; i++) rect(g, 24 + i * 20, 82, 8, 18, "#f6c453");
  rect(g, 58, 90, 12, 18, "#4a3320");
  ink(g);
}

function drawMyhouse(g, t) {
  // Lagos flat mansion: 4-storey block, gold cornice, balconies, penthouse
  rect(g, 16, 30, 96, 80, t);
  rect(g, 12, 26, 104, 6, "#c9a64a");
  rect(g, 34, 14, 60, 12, t);
  rect(g, 30, 12, 68, 3, "#c9a64a");
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) rect(g, 24 + c * 22, 38 + r * 20, 14, 10, "#7fb0d0");
  rect(g, 52, 92, 24, 18, "#2a1d10");
  rect(g, 46, 88, 36, 4, "#c9a64a");
  ink(g);
}

function drawPrison(g, t) {
  rect(g, 14, 62, 100, 50, t);
  rect(g, 6, 42, 22, 70, "#5a5f66");
  rect(g, 100, 42, 22, 70, "#5a5f66");
  for (let i = 0; i < 3; i++) {
    rect(g, 6 + i * 8, 36, 5, 7, "#5a5f66");
    rect(g, 100 + i * 8, 36, 5, 7, "#5a5f66");
  }
  rect(g, 50, 78, 28, 34, "#2a1d10");
  g.strokeStyle = "#8a96a3"; g.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    g.beginPath(); g.moveTo(54 + i * 6, 78); g.lineTo(54 + i * 6, 112); g.stroke();
  }
  g.beginPath(); g.moveTo(50, 92); g.lineTo(78, 92); g.stroke();
  ink(g);
}

function drawStatejail(g, t) {
  // Taller cell block with two bar windows
  rect(g, 20, 30, 88, 84, t);
  rect(g, 30, 44, 24, 26, "#2a1d10");
  rect(g, 74, 44, 24, 26, "#2a1d10");
  g.strokeStyle = "#a0a8b0"; g.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    g.beginPath(); g.moveTo(33 + i * 6, 44); g.lineTo(33 + i * 6, 70); g.stroke();
    g.beginPath(); g.moveTo(77 + i * 6, 44); g.lineTo(77 + i * 6, 70); g.stroke();
  }
  ink(g);
  rect(g, 44, 86, 40, 28, "#2a1d10");
  for (let i = 0; i < 3; i++) {
    g.strokeStyle = "#a0a8b0"; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(48 + i * 12, 86); g.lineTo(48 + i * 12, 114); g.stroke();
  }
  ink(g);
}

function drawShowroom(g, t) {
  rect(g, 10, 60, 108, 52, t);
  rect(g, 8, 54, 112, 8, "#8a96a3");
  rect(g, 18, 66, 92, 40, "#9cc6e0");
  rect(g, 34, 88, 30, 8, RED);
  poly(g, [[42, 88], [48, 76], [74, 76], [80, 88]], "#c25a3d");
  g.fillStyle = "#1a1d22";
  g.beginPath(); g.arc(44, 100, 5, 0, 6.28); g.fill();
  g.beginPath(); g.arc(74, 100, 5, 0, 6.28); g.fill();
  ink(g);
}

function drawMarket(g, t) {
  const cols = ["#b5442a", "#3d6fa8", "#b5442a"];
  for (let i = 0; i < 3; i++) {
    const x = 14 + i * 36;
    rect(g, x, 66, 30, 44, "#efe2bb");
    poly(g, [[x - 2, 66], [x + 15, 40], [x + 32, 66]], cols[i]);
    poly(g, [[x + 8, 110], [x + 15, 96], [x + 22, 110]], "#4a3320");
  }
  g.fillStyle = INK;
  g.fillRect(14, 106, 100, 6);
  ink(g);
}

function drawAirport(g, t) {
  rect(g, 8, 72, 78, 26, "#dfe6ea");
  rect(g, 4, 66, 86, 8, "#8a96a3");
  rect(g, 12, 80, 68, 8, "#7fb2d9");
  // Control tower
  rect(g, 92, 24, 12, 62, t);
  poly(g, [[88, 24], [104, 12], [120, 24]], "#8a96a3");
  rect(g, 86, 26, 32, 8, "#7fb2d9");
  // Runway stripes
  g.strokeStyle = INK; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    g.beginPath(); g.moveTo(20 + i * 22, 108); g.lineTo(32 + i * 22, 108); g.stroke();
  }
  ink(g);
}

function drawAirplane(g, t) {
  // Swept-wing aircraft seen from above
  g.save();
  g.translate(64, 64);
  g.rotate(-0.14);
  poly(g, [[-50, 6], [10, -8], [12, -12], [-50, 24]], "#f2f4f6");
  poly(g, [[50, 6], [-10, -8], [-12, -12], [50, 24]], "#f2f4f6");
  poly(g, [[-8, -12], [8, -12], [8, -46], [-8, -46]], "#e8ecf0");
  poly(g, [[-6, 22], [6, 22], [4, 42], [-4, 42]], "#e8ecf0");
  g.fillStyle = "#3a7ac0";
  g.beginPath(); g.ellipse(0, 0, 12, 40, 0, 0, 6.28); g.fill(); g.stroke();
  g.fillStyle = "#c8ced4";
  g.beginPath(); g.ellipse(-22, 6, 5, 8, 0, 0, 6.28); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(22, 6, 5, 8, 0, 0, 6.28); g.fill(); g.stroke();
  g.restore();
  ink(g);
}

function drawUniversity(g, t) {
  rect(g, 20, 66, 88, 44, t);
  // Arch
  g.fillStyle = "#efe2bb";
  g.beginPath(); g.arc(64, 66, 22, Math.PI, 0); g.fill(); g.stroke();
  rect(g, 42, 66, 44, 20, "#efe2bb");
  // Dome on top
  g.fillStyle = "#3a7ac0";
  g.beginPath(); g.arc(64, 46, 16, Math.PI, 0); g.fill(); g.stroke();
  rect(g, 48, 44, 32, 8, "#3a7ac0");
  // Columns
  for (let i = 0; i < 4; i++) rect(g, 24 + i * 22, 78, 6, 32, "#fff6dc");
  // Flag
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(64, 30); g.lineTo(64, 14); g.stroke();
  poly(g, [[64, 14], [76, 18], [64, 22]], "#3a9a5a");
  ink(g);
}

function drawClassroom(g, t) {
  rect(g, 16, 66, 96, 44, t);
  poly(g, [[10, 66], [40, 44], [70, 66]], "#b04a3a");
  rect(g, 56, 76, 14, 24, "#3a6ab0");
  for (let i = 0; i < 3; i++) rect(g, 22 + i * 12, 76, 8, 8, "#3a6ab0");
  for (let i = 0; i < 3; i++) rect(g, 78 + i * 10, 76, 6, 8, "#3a6ab0");
  rect(g, 74, 44, 10, 24, "#e8c668");
  poly(g, [[74, 44], [84, 36], [94, 44]], "#e8c668");
  ink(g);
}

function drawComputerlab(g, t) {
  rect(g, 16, 42, 96, 68, t);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++)
      rect(g, 22 + c * 18, 52 + r * 16, 12, 10, "#5ee0ff");
  rect(g, 26, 100, 76, 8, "#5ee0ff");
  rect(g, 60, 26, 8, 16, "#5ee0ff");
  ink(g);
}

function drawBoropark(g, t) {
  // Park: grass + big tree + benches
  g.fillStyle = t;
  g.fillRect(8, 60, 112, 50); g.strokeRect(8, 60, 112, 50);
  drawTree(g, 40, 80, 20);
  drawTree(g, 88, 84, 16);
  rect(g, 52, 96, 24, 4, "#8a5a2a");
  g.strokeStyle = INK; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(54, 100); g.lineTo(54, 104); g.stroke();
  g.beginPath(); g.moveTo(74, 100); g.lineTo(74, 104); g.stroke();
  ink(g);
}

function drawCitypark(g, t) {
  g.fillStyle = t;
  g.fillRect(8, 60, 112, 50); g.strokeRect(8, 60, 112, 50);
  // Fountain
  g.fillStyle = "#93b7bf";
  g.beginPath(); g.ellipse(64, 92, 22, 8, 0, 0, 6.28); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(64, 68); g.lineTo(64, 88); g.stroke();
  g.beginPath(); g.arc(64, 70, 4, 0, 6.28); g.fill(); g.stroke();
  // Trees
  drawTree(g, 26, 82, 12);
  drawTree(g, 102, 82, 12);
  ink(g);
}

function drawPleasurepark(g, t) {
  // Ferris wheel
  g.strokeStyle = INK; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(48, 110); g.lineTo(64, 60); g.stroke();
  g.beginPath(); g.moveTo(80, 110); g.lineTo(64, 60); g.stroke();
  g.lineWidth = 3.4;
  g.beginPath(); g.arc(64, 62, 32, 0, 6.28); g.stroke();
  g.lineWidth = 1.8;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28;
    g.beginPath();
    g.moveTo(64, 62);
    g.lineTo(64 + Math.cos(a) * 32, 62 + Math.sin(a) * 32);
    g.stroke();
  }
  const cols = ["#b5442a", "#f2c230", "#3d6fa8", "#4a9a5a"];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.28 + 0.4;
    const cx = 64 + Math.cos(a) * 32, cy = 62 + Math.sin(a) * 32;
    g.fillStyle = cols[i % 4];
    g.beginPath(); g.arc(cx, cy, 5, 0, 6.28); g.fill(); g.stroke();
  }
  g.fillStyle = "#f2c230";
  g.beginPath(); g.arc(64, 62, 5, 0, 6.28); g.fill(); g.stroke();
  ink(g);
}

function drawHospital(g, t) {
  rect(g, 8, 62, 112, 50, t);
  rect(g, 14, 56, 100, 8, "#c8d4dc");
  // Big red cross
  g.fillStyle = "#d03030";
  g.fillRect(56, 74, 16, 30);
  g.fillRect(48, 82, 32, 14);
  // Windows
  for (let i = 0; i < 4; i++) rect(g, 20 + i * 24, 74, 10, 10, "#8ecae0");
  ink(g);
}

function drawChurch(g, t) {
  rect(g, 40, 62, 48, 50, t);
  poly(g, [[40, 62], [64, 36], [88, 62]], "#6a4a3a");
  rect(g, 56, 82, 16, 30, "#5a3a22");
  // Cross
  g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.moveTo(64, 36); g.lineTo(64, 16); g.stroke();
  g.beginPath(); g.moveTo(56, 24); g.lineTo(72, 24); g.stroke();
  ink(g);
}

function drawMosque(g, t) {
  rect(g, 20, 62, 88, 50, t);
  g.fillStyle = "#2f8a6a";
  g.beginPath(); g.arc(64, 60, 26, Math.PI, 0); g.fill(); g.stroke();
  g.fillRect(38, 60, 52, 4); g.strokeRect(38, 60, 52, 4);
  // Minarets
  rect(g, 10, 40, 12, 72, t);
  g.fillStyle = "#2f8a6a";
  g.beginPath(); g.arc(16, 40, 6, Math.PI, 0); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(16, 34); g.lineTo(16, 26); g.stroke();
  rect(g, 106, 40, 12, 72, t);
  g.beginPath(); g.arc(112, 40, 6, Math.PI, 0); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(112, 34); g.lineTo(112, 26); g.stroke();
  // Door
  g.fillStyle = "#2a5a4a";
  g.beginPath(); g.arc(64, 112, 12, Math.PI, 0); g.fill(); g.stroke();
  g.fillRect(52, 100, 24, 12); g.strokeRect(52, 100, 24, 12);
  ink(g);
}

function drawVatican(g, t) {
  // Basilica with columns + big dome
  rect(g, 8, 66, 112, 46, t);
  for (let i = 0; i < 9; i++) rect(g, 12 + i * 12, 74, 5, 38, "#f6efdc");
  g.fillStyle = "#c8bca0";
  g.beginPath(); g.arc(64, 56, 30, Math.PI, 0); g.fill(); g.stroke();
  rect(g, 34, 56, 60, 10, "#c8bca0");
  // Cross on top
  g.strokeStyle = INK; g.lineWidth = 3;
  g.beginPath(); g.moveTo(64, 26); g.lineTo(64, 8); g.stroke();
  g.beginPath(); g.moveTo(56, 16); g.lineTo(72, 16); g.stroke();
  ink(g);
}

function drawStatehouse(g, t) {
  rect(g, 6, 62, 116, 50, t);
  rect(g, 14, 56, 100, 8, "#b8b4a8");
  // Big front columns
  for (let i = 0; i < 7; i++) rect(g, 20 + i * 16, 76, 6, 36, "#f6f4ec");
  // Dome
  g.fillStyle = "#c9a961";
  g.beginPath(); g.arc(64, 52, 20, Math.PI, 0); g.fill(); g.stroke();
  // Flag
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(64, 30); g.lineTo(64, 14); g.stroke();
  poly(g, [[64, 14], [78, 18], [64, 22]], "#3a9a5a");
  ink(g);
}

function drawZoo(g, t) {
  // Cage with animal + tree
  g.fillStyle = t;
  g.fillRect(8, 60, 112, 50); g.strokeRect(8, 60, 112, 50);
  // Cage bars (right side)
  g.strokeStyle = INK; g.lineWidth = 1.8;
  for (let i = 0; i < 6; i++) {
    g.beginPath(); g.moveTo(70 + i * 8, 60); g.lineTo(70 + i * 8, 110); g.stroke();
  }
  g.strokeRect(70, 60, 50, 50);
  // Giraffe silhouette (left side)
  g.fillStyle = "#c8a058";
  g.beginPath(); g.ellipse(34, 90, 10, 14, 0, 0, 6.28); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(34, 76); g.lineTo(40, 60); g.stroke();
  g.fillStyle = "#c8a058";
  g.beginPath(); g.arc(40, 58, 5, 0, 6.28); g.fill(); g.stroke();
  ink(g);
}

function drawVastcity(g, t) {
  // Skyline of towers
  const cols = ["#3a5a7e", "#4a6a8e", "#5a7a9e", "#6a8aae"];
  const heights = [46, 70, 58, 84, 62];
  for (let i = 0; i < 5; i++) {
    const h = heights[i];
    rect(g, 12 + i * 22, 110 - h, 18, h, cols[i]);
    for (let r = 1; r < Math.floor(h / 12); r++) {
      g.fillStyle = "#bfe4ff";
      g.fillRect(15 + i * 22, 110 - h + r * 12, 12, 4);
    }
    ink(g);
  }
  rect(g, 8, 108, 112, 6, INK);
}

function drawDuplex(g, t) {
  // Two-storey house with pitched roof
  rect(g, 20, 70, 88, 40, t);
  poly(g, [[16, 70], [64, 40], [112, 70]], "#b5442a");
  rect(g, 30, 76, 18, 14, "#3a6ab0");
  rect(g, 76, 76, 18, 14, "#3a6ab0");
  rect(g, 30, 96, 18, 14, "#3a6ab0");
  rect(g, 76, 96, 18, 14, "#3a6ab0");
  rect(g, 58, 92, 12, 18, "#4a3320");
  ink(g);
}

function drawLagosflat(g, t) {
  // Multi-storey apartment block
  rect(g, 22, 22, 84, 88, t);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      rect(g, 30 + c * 22, 30 + r * 20, 14, 12, "#7fb0d0");
    }
  }
  rect(g, 56, 96, 16, 14, "#3a2a1a");
  ink(g);
}

function drawForest(g, t) {
  // Cluster of pine trees
  g.fillStyle = "#7fae6a";
  g.fillRect(8, 80, 112, 30); g.strokeRect(8, 80, 112, 30);
  drawPine(g, 32, 60, 22);
  drawPine(g, 64, 50, 30);
  drawPine(g, 96, 62, 20);
  ink(g);
}

function drawCanteen(g, t) {
  // Cafeteria: low hall, awning, tables
  rect(g, 14, 66, 100, 46, t);
  poly(g, [[8, 66], [64, 44], [120, 66]], "#cf5138");
  for (let i = 0; i < 5; i++) rect(g, 18 + i * 20, 66, 10, 8, i % 2 ? "#ffffff" : "#cf5138");
  rect(g, 54, 86, 20, 26, "#3a2a1a");
  rect(g, 20, 80, 22, 14, "#bfe4f0"); rect(g, 86, 80, 22, 14, "#bfe4f0");
  // fork + knife sign
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(60, 30); g.lineTo(60, 46); g.moveTo(68, 30); g.lineTo(68, 46); g.stroke();
  ink(g);
}

function drawBeach(g, t) {
  // Sea, sand strip, two palms
  g.fillStyle = "#5fc3cf"; g.fillRect(8, 74, 112, 22); g.strokeRect(8, 74, 112, 22);
  g.strokeStyle = "#ffffff"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(16, 84); g.quadraticCurveTo(28, 78, 40, 84); g.quadraticCurveTo(52, 90, 64, 84); g.stroke();
  g.fillStyle = "#f0e0bb"; g.fillRect(8, 96, 112, 16); g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(8, 96, 112, 16);
  for (const [x, h] of [[34, 40], [92, 32]]) {
    g.strokeStyle = "#6a4f32"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, 100); g.quadraticCurveTo(x + 4, 100 - h / 2, x + 2, 100 - h); g.stroke();
    g.fillStyle = "#3f7a3a";
    for (const a of [-1, 0, 1]) { g.beginPath(); g.ellipse(x + 2 + a * 9, 100 - h - 2 + Math.abs(a) * 3, 9, 3.5, a * 0.5, 0, 6.28); g.fill(); }
  }
  ink(g);
}

function drawVillage(g, t) {
  // Huts + fire pit
  for (let i = 0; i < 3; i++) {
    const x = 16 + i * 34;
    rect(g, x, 72, 26, 38, t);
    poly(g, [[x - 2, 72], [x + 13, 52], [x + 28, 72]], "#8a6a2a");
    rect(g, x + 9, 96, 8, 14, "#4a2a12");
  }
  // Fire pit
  g.fillStyle = "#ffa040";
  g.beginPath(); g.arc(64, 96, 5, 0, 6.28); g.fill(); g.stroke();
  ink(g);
}

function drawRealestate(g, t) {
  rect(g, 10, 68, 90, 44, t);
  poly(g, [[6, 68], [34, 44], [62, 68]], "#2d6a4f");
  rect(g, 30, 82, 16, 30, "#6b4a2a");
  // SALE sign
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(104, 60); g.lineTo(104, 100); g.stroke();
  rect(g, 90, 60, 28, 22, "#ffffff");
  g.fillStyle = RED;
  g.font = "bold 13px Arial";
  g.textAlign = "center";
  g.fillText("SALE", 104, 76);
  ink(g);
}

function drawJobcenter(g, t) {
  rect(g, 20, 30, 88, 82, t);
  // Briefcase icon in the middle
  rect(g, 50, 66, 28, 22, "#0d3a6a");
  g.fillStyle = "#0d3a6a";
  g.fillRect(60, 60, 8, 6);
  // Briefcase handle
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath(); g.moveTo(62, 60); g.lineTo(62, 56); g.lineTo(66, 56); g.lineTo(66, 60); g.stroke();
  ink(g);
  // Windows
  for (let i = 0; i < 3; i++) rect(g, 30 + i * 22, 86, 12, 10, "#bfe4ff");
}

/* Tree + pine helpers */
function drawTree(g, x, y, r) {
  g.fillStyle = "#7a5230";
  g.fillRect(x - 2, y + r * 0.4, 4, r * 0.9);
  g.fillStyle = "#6faf4e";
  g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); g.stroke();
  ink(g);
}
function drawPine(g, x, y, r) {
  g.fillStyle = "#7a5230";
  g.fillRect(x - 2, y + r * 0.7, 4, r * 0.6);
  poly(g, [[x - r * 0.7, y + r * 0.8], [x, y - r * 0.9], [x + r * 0.7, y + r * 0.8]], "#3f7d3a");
  poly(g, [[x - r * 0.55, y + r * 0.2], [x, y - r * 1.4], [x + r * 0.55, y + r * 0.2]], "#3a7436");
  ink(g);
}

/* Fallback icon */
function drawDefault(g, t) {
  g.fillStyle = t;
  g.beginPath(); g.arc(64, 54, 26, 0, 6.28); g.fill(); g.stroke();
  poly(g, [[38, 74], [90, 74], [64, 118]], t);
  ink(g);
}

/* Dispatch table. */
const ICON_FN = {
  govhouse: drawGovhouse, governor: drawGovernor, hotel: drawHotel,
  mansion: drawMansion, myhouse: drawMyhouse, prison: drawPrison,
  statejail: drawStatejail, showroom: drawShowroom, market: drawMarket,
  airport: drawAirport, airplane: drawAirplane, university: drawUniversity,
  classroom: drawClassroom, computerlab: drawComputerlab, boropark: drawBoropark,
  citypark: drawCitypark, pleasurepark: drawPleasurepark, hospital: drawHospital,
  church: drawChurch, mosque: drawMosque, vatican: drawVatican,
  statehouse: drawStatehouse, zoo: drawZoo, vastcity: drawVastcity,
  duplex: drawDuplex, lagosflat: drawLagosflat, forest: drawForest, canteen: drawCanteen, beach: drawBeach,
  village: drawVillage, realestate: drawRealestate, jobcenter: drawJobcenter,
};

/* Build (and cache) the canvas for one landmark id. */
function iconFor(id) {
  if (_iconCache.has(id)) return _iconCache.get(id);
  const tint = LM_COLOR[id] || "#d0d6dc";
  const { c, g } = base(128, 128, null);
  const fn = ICON_FN[id] || drawDefault;
  try { fn(g, tint); } catch (e) { drawDefault(g, tint); }
  _iconCache.set(id, c);
  return c;
}

/* ──────────────────────────────────────────────────────────────
   3. RIVER + REGIONS + TREES + PARKS  (unchanged from prior file)
   ────────────────────────────────────────────────────────────── */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rrPoints(hx, hz, cr, step, amp, seed) {
  const pts = [];
  const arc = (cx, cz, a0) => {
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * cr, z: cz + Math.sin(a) * cr, nx: Math.cos(a), nz: Math.sin(a) });
    }
  };
  const edge = (x0, z0, x1, z1, nx, nz) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step));
    for (let k = 1; k < n; k++) {
      const f = k / n;
      pts.push({ x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, nx, nz });
    }
  };
  arc(-hx + cr, -hz + cr, Math.PI);       edge(-hx + cr, -hz, hx - cr, -hz, 0, -1);
  arc(hx - cr, -hz + cr, Math.PI * 1.5);  edge(hx, -hz + cr, hx, hz - cr, 1, 0);
  arc(hx - cr, hz - cr, 0);               edge(hx - cr, hz, -hx + cr, hz, 0, 1);
  arc(-hx + cr, hz - cr, Math.PI / 2);    edge(-hx, hz - cr, -hx, -hz + cr, -1, 0);
  pts.forEach((p, i) => {
    const o = amp * (Math.sin(i * 0.55 + seed) * 0.6 + Math.sin(i * 1.37 + seed * 2.1) * 0.4);
    p.x += p.nx * o; p.z += p.nz * o;
  });
  return pts;
}
const inset = (pts, hx, hz, d) => pts.map(p => ({ x: p.x * (1 - d / hx), z: p.z * (1 - d / hz) }));
const LAND = rrPoints(W.LAND_X, W.LAND_Z, 44, 16, 5, 1.3);
const LAND_IN = inset(LAND, W.LAND_X, W.LAND_Z, 9);
const CITY_HX = W.RING_R + 18, CITY_HZ = W.RING_RZ + 18;
const CITY = rrPoints(CITY_HX, CITY_HZ, 26, 13, 3.5, 4.1);
const CITY_IN = inset(CITY, CITY_HX, CITY_HZ, 7);
const PARKS = [
  { x: -0.65 * W.RING_R, z: 0.65 * W.RING_RZ, r: 54 },
  { x: -0.4 * W.RING_R, z: -0.5 * W.RING_RZ, r: 34 },
  { x: 0.55 * W.RING_R, z: -0.45 * W.RING_RZ, r: 42 },
];
const POND = { x: -128, z: 102, rx: 22, ry: 14 };
const riverX = (z) => -299 + Math.sin(z * 0.02) * 14 + Math.sin(z * 0.047) * 6;
const riverHW = (z) => 19 + Math.sin(z * 0.03) * 3;
const TREES = (() => {
  const R = rng(11), out = [];
  const MIN_SPACE = 18, MIN_SQ = MIN_SPACE * MIN_SPACE, TARGET = 260, POOL = 25000;
  for (let n = 0; n < POOL && out.length < TARGET; n++) {
    const x = (R() * 2 - 1) * (W.LAND_X + 40);
    const z = (R() * 2 - 1) * (W.LAND_Z + 30);
    if (x < -W.LAND_X - 16 || x > W.LAND_X + 40 || z < -W.LAND_Z - 14 || z > W.LAND_Z + 14) continue;
    const onRoad = (Math.abs(Math.abs(x) - W.RING_R) < 16 && Math.abs(z) < W.RING_RZ + 16) ||
      (Math.abs(Math.abs(z) - W.RING_RZ) < 16 && Math.abs(x) < W.RING_R + 16) ||
      (Math.abs(z) < 14 && Math.abs(x) < W.RING_R) ||
      (Math.abs(x) < 14 && Math.abs(z) < W.RING_RZ);
    if (onRoad) continue;
    if (PLACES.some(p => Math.hypot(p.x - x, p.z - z) < 52)) continue;
    if (Math.pow((x - POND.x) / (POND.rx + 9), 2) + Math.pow((z - POND.z) / (POND.ry + 9), 2) < 1) continue;
    if (Math.abs(x - riverX(z)) < riverHW(z) + 10) continue;
    const inPark = PARKS.some(p => Math.hypot(p.x - x, p.z - z) < p.r);
    if (R() > (inPark ? 0.80 : 0.20)) continue;
    let bad = false;
    for (let k = 0; k < out.length; k++) {
      const dx = out[k].x - x, dz = out[k].z - z;
      if (dx * dx + dz * dz < MIN_SQ) { bad = true; break; }
    }
    if (bad) continue;
    out.push({ x, z, k: R() < 0.62 ? (R() < 0.5 ? 0 : 1) : 2, s: 0.75 + R() * 0.5 });
  }
  return out.sort((a, b) => a.z - b.z);
})();

/* ──────────────────────────────────────────────────────────────
   4. TEXTURE + TREE SPRITES + helpers
   ────────────────────────────────────────────────────────────── */
const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
function treeSprite(kind) {
  const c = mkCanvas(80, 92), g = c.getContext("2d");
  g.scale(2, 2); ink(g); g.lineWidth = 1.7;
  if (kind === 2) {
    rect(g, 18, 31, 4, 9, "#7a5230");
    poly(g, [[20, 3], [31, 17], [9, 17]], "#3f7d3a");
    poly(g, [[20, 11], [34, 27], [6, 27]], "#46873f");
    poly(g, [[20, 19], [36, 35], [4, 35]], "#3b7436");
  } else {
    const a = kind === 0 ? "#6faf4e" : "#82bb55";
    rect(g, 18, 28, 4, 13, "#7a5230");
    [[12, 25, 9], [28, 25, 9], [20, 17, 12]].forEach(q => {
      g.fillStyle = a; g.beginPath(); g.arc(q[0], q[1], q[2], 0, 6.28); g.fill(); g.stroke();
    });
    g.fillStyle = "rgba(220,245,160,.55)";
    g.beginPath(); g.ellipse(16, 13, 4, 3, -0.5, 0, 6.28); g.fill();
  }
  return c;
}
const _tree = [null, null, null];
const treeImg = (k) => _tree[k] || (_tree[k] = treeSprite(k));

let _paper = null;
function paperPattern(ctx) {
  if (_paper !== null) return _paper;
  const c = mkCanvas(256, 256), g = c.getContext("2d"), R = rng(7);
  for (let i = 0; i < 1500; i++) {
    const x = R() * 256, y = R() * 256, r = R() * 1.7 + 0.3;
    g.fillStyle = R() < 0.5
      ? "rgba(70,55,10," + (0.04 + R() * 0.06) + ")"
      : "rgba(255,250,200," + (0.04 + R() * 0.07) + ")";
    g.fillRect(x, y, r, r);
  }
  for (let i = 0; i < 26; i++) {
    const x = R() * 256, y = R() * 256, r = 14 + R() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(80,60,10,.06)");
    gr.addColorStop(1, "rgba(80,60,10,0)");
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  try { _paper = ctx.createPattern(c, "repeat") || false; } catch (e) { _paper = false; }
  return _paper;
}

/* ──────────────────────────────────────────────────────────────
   5. STATE + BOOT
   ────────────────────────────────────────────────────────────── */
const ZMIN = 0.11, ZMAX = 3;
const S = {
  camX: 0, camY: 0, zoom: 0.5, zoomTarget: 0.5, fly: null,
  selectedId: null, shown: false,
  pts: new Map(), drag: null, pinch: null, moved: false, t0: 0,
};
let _canvas = null, _ctx = null, _mini = null, _mctx = null,
    _dpr = 1, _w = 0, _h = 0, _built = false;
let _lastT = 0, _frame = 0, _chips = [];

/* Helpers */
const w2s = (wx, wz) => ({ x: (wx - S.camX) * S.zoom + _w / 2, y: (wz - S.camY) * S.zoom + _h / 2 });
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function playerPos() {
  try {
    const d = window.__ph3d_drive;
    if (d && d.getPos) {
      const p = d.getPos();
      if (p && isFinite(p.x) && isFinite(p.z)) return { x: p.x, z: p.z, yaw: p.yaw || 0, known: true };
    }
  } catch (e) {}
  return { x: 0, z: 0, yaw: 0, known: false };
}
function fmtDist(m) {
  return m < 1000 ? Math.round(m / 10) * 10 + " m" : (m / 1000).toFixed(1) + " km";
}
function resize() {
  const root = document.getElementById("ph3d-map-app");
  if (!root || !_canvas) return;
  _dpr = Math.min(window.devicePixelRatio || 1, 2);
  _w = root.clientWidth; _h = root.clientHeight;
  _canvas.width = _w * _dpr; _canvas.height = _h * _dpr;
  _canvas.style.width = _w + "px"; _canvas.style.height = _h + "px";
  _ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
  _mini.width = 104 * _dpr; _mini.height = 120 * _dpr;
  _mctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
}
function pathPts(ctx, pts) {
  const P = pts.map(p => w2s(p.x, p.z)), n = P.length;
  const m = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const s = m(P[n - 1], P[0]);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], mm = m(a, b);
    ctx.quadraticCurveTo(a.x, a.y, mm.x, mm.y);
  }
  ctx.closePath();
}

/* ──────────────────────────────────────────────────────────────
   6. UI BUILD
   ────────────────────────────────────────────────────────────── */
function build() {
  if (_built) return;
  injectCSS();
  const root = document.createElement("div");
  root.id = "ph3d-map-app";
  root.innerHTML = `
    <canvas id="ph3d-map-canvas"></canvas>
    <canvas id="ph3d-map-mini"></canvas>
    <div id="ph3d-map-hdr">
      <div class="ttl ph3d-paper">Port Harcourt<i>THE CITY MAP</i></div>
      <div id="ph3d-map-close" class="ph3d-paper">✕</div>
    </div>
    <div id="ph3d-map-zoom" class="ph3d-paper">
      <button id="ph3d-map-zin" aria-label="Zoom in">+</button>
      <button id="ph3d-map-zout" aria-label="Zoom out">−</button>
      <button id="ph3d-map-zme" aria-label="Centre on me">◎</button>
    </div>
    <div id="ph3d-map-dock">
      <div id="ph3d-map-card" class="ph3d-paper">
        <canvas class="ic" width="104" height="104"></canvas>
        <div class="tx"><div class="nm"></div><div class="sb"></div></div>
        <button class="go">GO</button>
        <button class="x" aria-label="Close">✕</button>
      </div>
      <div id="ph3d-map-strip"></div>
    </div>`;
  document.body.appendChild(root);

  _canvas = document.getElementById("ph3d-map-canvas");
  _ctx = _canvas.getContext("2d");
  _mini = document.getElementById("ph3d-map-mini");
  _mctx = _mini.getContext("2d");

  document.getElementById("ph3d-map-close").onclick = () => close();
  document.getElementById("ph3d-map-zin").onclick = () => { S.zoomTarget = Math.min(ZMAX, S.zoomTarget * 1.5); };
  document.getElementById("ph3d-map-zout").onclick = () => { S.zoomTarget = Math.max(ZMIN, S.zoomTarget / 1.5); };
  document.getElementById("ph3d-map-zme").onclick = () => {
    const p = playerPos();
    S.fly = p.known ? { x: p.x, y: p.z } : { x: 0, y: 0 };
    S.zoomTarget = p.known ? Math.max(S.zoomTarget, 0.8) : 0.5;
  };
  root.querySelector("#ph3d-map-card .x").onclick = () => select(null);
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.shown) close(); });

  const strip = document.getElementById("ph3d-map-strip");
  PLACES.forEach((pl) => {
    const el = document.createElement("div");
    el.className = "chip";
    el.innerHTML = '<span class="d" style="background:' + pl.color + '"></span>' + pl.lm.name.replace(/&/g, "&amp;");
    el.onclick = () => {
      select(pl.id);
      S.fly = { x: pl.x, y: pl.z };
      S.zoomTarget = Math.max(S.zoomTarget, 0.75);
    };
    strip.appendChild(el);
    _chips.push({ id: pl.id, el });
  });

  const miniGo = (e) => {
    const r = _mini.getBoundingClientRect();
    const fx = (e.clientX - r.left) / (r.width || 104);
    const fy = (e.clientY - r.top) / (r.height || 120);
    S.fly = null;
    S.camX = MB.x0 + Math.max(0, Math.min(1, fx)) * (MB.x1 - MB.x0);
    S.camY = MB.z0 + Math.max(0, Math.min(1, fy)) * (MB.z1 - MB.z0);
  };
  let miniDown = false;
  _mini.addEventListener("pointerdown", (e) => {
    miniDown = true;
    try { _mini.setPointerCapture(e.pointerId); } catch (x) {}
    miniGo(e); e.stopPropagation();
  });
  _mini.addEventListener("pointermove", (e) => { if (miniDown) miniGo(e); });
  _mini.addEventListener("pointerup", () => { miniDown = false; });
  _mini.addEventListener("pointercancel", () => { miniDown = false; });

  const c = _canvas;
  c.addEventListener("pointerdown", (e) => {
    c.setPointerCapture(e.pointerId);
    S.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    S.fly = null;
    if (S.pts.size === 1) {
      S.drag = { x: e.clientX, y: e.clientY, cx: S.camX, cy: S.camY };
      S.moved = false; S.t0 = performance.now();
    }
    if (S.pts.size === 2) {
      const [a, b] = [...S.pts.values()];
      S.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: S.zoomTarget };
      S.drag = null; S.moved = true;
    }
  });
  c.addEventListener("pointermove", (e) => {
    if (!S.pts.has(e.pointerId)) return;
    S.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (S.pts.size >= 2 && S.pinch) {
      const [a, b] = [...S.pts.values()];
      S.zoomTarget = Math.max(ZMIN, Math.min(ZMAX,
        S.pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / S.pinch.d0));
    } else if (S.drag) {
      const dx = e.clientX - S.drag.x, dy = e.clientY - S.drag.y;
      if (Math.hypot(dx, dy) > 6) S.moved = true;
      if (S.moved) {
        S.camX = S.drag.cx - dx / S.zoom;
        S.camY = S.drag.cy - dy / S.zoom;
      }
    }
  });
  const up = (e) => {
    const was = S.pts.has(e.pointerId);
    S.pts.delete(e.pointerId);
    if (was && S.drag && !S.moved && S.pts.size === 0 &&
        performance.now() - S.t0 < 500) {
      tapAt(e.clientX, e.clientY);
    }
    if (S.pts.size < 2) S.pinch = null;
    if (S.pts.size === 0) S.drag = null;
  };
  c.addEventListener("pointerup", up);
  c.addEventListener("pointercancel", up);
  c.addEventListener("wheel", (e) => {
    e.preventDefault();
    S.zoomTarget = Math.max(ZMIN, Math.min(ZMAX,
      S.zoomTarget * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  }, { passive: false });

  _built = true;
  resize();
  requestAnimationFrame(loop);
}

/* ──────────────────────────────────────────────────────────────
   7. SELECT / CARD / TAP
   ────────────────────────────────────────────────────────────── */
function select(id) {
  S.selectedId = id;
  const card = document.getElementById("ph3d-map-card");
  if (!card) return;
  _chips.forEach(ch => ch.el.classList.toggle("on", ch.id === id));
  if (!id) { card.classList.remove("on"); return; }
  const pl = PLACES.find(p => p.id === id);
  if (!pl) { card.classList.remove("on"); return; }
  const me = playerPos();
  const sub = (pl.lm.sub || "") + (me.known
    ? "  ·  " + fmtDist(Math.hypot(pl.x - me.x, pl.z - me.z)) + " away"
    : "");
  try {
    const ic = card.querySelector(".ic");
    const g = ic.getContext("2d");
    g.clearRect(0, 0, 104, 104);
    g.drawImage(iconFor(pl.id), 0, 0, 104, 104);
  } catch (e) {}
  card.querySelector(".nm").textContent = pl.lm.name;
  card.querySelector(".sb").textContent = sub;
  card.querySelector(".go").textContent =
    pl.lm.kind === "parent" ? "OPEN" : "GO";
  card.querySelector(".go").onclick = () => {
    close();
    try {
      const router = window.__ph3d_router;
      if (!router) return;
      const dest = routeFor(pl);
      router.go(dest.route, dest.params);
    } catch (e) { console.warn(e); }
  };
  card.classList.add("on");
  const chip = _chips.find(ch => ch.id === id);
  if (chip && chip.el.scrollIntoView) {
    try { chip.el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); } catch (e) {}
  }
}
function iconSize() { return Math.max(42, Math.min(76, 36 + S.zoom * 34)); }
function tapAt(sx, sy) {
  let best = null, bd = 34 * 34;
  const off = iconSize() * 0.4;
  for (const pl of PLACES) {
    const p = w2s(pl.x, pl.z), py = p.y - off;
    const d = (p.x - sx) * (p.x - sx) + (py - sy) * (py - sy);
    if (d < bd) { bd = d; best = pl; }
  }
  select(best ? best.id : null);
}

/* ──────────────────────────────────────────────────────────────
   8. DRAW
   ────────────────────────────────────────────────────────────── */
function region(ctx, pts, ptsIn, fill, band, bandW) {
  pathPts(ctx, pts);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK; ctx.lineWidth = bandW + 3; ctx.stroke();
  ctx.strokeStyle = band; ctx.lineWidth = bandW; ctx.stroke();
  pathPts(ctx, ptsIn);
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.setLineDash([]);
}

function draw(t) {
  const ctx = _ctx;
  if (!ctx || !_w) return;
  S.zoom += (S.zoomTarget - S.zoom) * 0.16;
  if (S.fly) {
    S.camX += (S.fly.x - S.camX) * 0.16;
    S.camY += (S.fly.y - S.camY) * 0.16;
    if (Math.hypot(S.fly.x - S.camX, S.fly.y - S.camY) < 0.5) S.fly = null;
  }
  const z = S.zoom, pat = paperPattern(ctx);

  ctx.fillStyle = "#bdb868"; ctx.fillRect(0, 0, _w, _h);
  if (pat) { ctx.fillStyle = pat; ctx.globalAlpha = 0.9; ctx.fillRect(0, 0, _w, _h); ctx.globalAlpha = 1; }

  /* River */
  {
    const z0 = S.camY - _h / 2 / z - 30, z1 = S.camY + _h / 2 / z + 30;
    const a = Math.max(-300, Math.floor(z0 / 18) * 18);
    const b = Math.min(520, Math.ceil(z1 / 18) * 18);
    if (b > a) {
      const L = [], R = [];
      for (let zz = a; zz <= b; zz += 18) {
        const x = riverX(zz), hw = riverHW(zz);
        L.push(w2s(x - hw, zz)); R.push(w2s(x + hw, zz));
      }
      ctx.beginPath();
      L.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
      ctx.closePath();
      ctx.fillStyle = "#93b7bf"; ctx.fill();
      ctx.lineJoin = "round"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); L.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      ctx.beginPath(); R.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    }
  }

  /* Regions */
  region(ctx, LAND, LAND_IN, "#c8c476", "#69a64e", Math.max(6, Math.min(12, 5 + z * 8)));
  region(ctx, CITY, CITY_IN, "#e4b97b", "#7aae55", Math.max(5, Math.min(10, 4 + z * 6)));

  /* Parks + pond */
  ctx.fillStyle = "rgba(95,160,75,.34)";
  PARKS.forEach(p => {
    const s = w2s(p.x, p.z);
    ctx.beginPath(); ctx.arc(s.x, s.y, p.r * z, 0, 6.283); ctx.fill();
  });
  {
    const s = w2s(POND.x, POND.z);
    ctx.fillStyle = "#93b7bf"; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, POND.rx * z, POND.ry * z, 0, 0, 6.283);
    ctx.fill(); ctx.stroke();
  }

  /* Roads */
  {
    const R = W.RING_R, RZ = W.RING_RZ;
    const a = w2s(-R, -RZ), b = w2s(R, -RZ), c = w2s(R, RZ), d = w2s(-R, RZ);
    const e1 = w2s(-R, 0), e2 = w2s(R, 0), n1 = w2s(0, -RZ), n2 = w2s(0, RZ);
    const rw = Math.max(3, W.ROAD_W * z), sw = Math.max(2, W.ROAD_W * 0.5 * z);
    const draw2 = (wid, col, spurs) => {
      ctx.lineWidth = wid; ctx.strokeStyle = col;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (!spurs) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y);
        ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        PLACES.forEach(pl => {
          if (pl.side < 0) return;
          const p = w2s(pl.x, pl.z);
          const q = pl.side === 0 ? w2s(pl.x, -RZ)
                 : pl.side === 1 ? w2s(R, pl.z)
                 : pl.side === 2 ? w2s(pl.x, RZ)
                 : w2s(-R, pl.z);
          ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();
      }
    };
    draw2(sw + 3, INK, true);
    draw2(rw + 3, INK, false);
    draw2(sw, "#dcc58f", true);
    draw2(rw, "#dcc58f", false);
  }

  /* Trees */
  if (z > 0.2) {
    const k = Math.max(0.55, Math.min(1.5, 0.45 + z * 0.9));
    for (const tr of TREES) {
      const s = w2s(tr.x, tr.z);
      if (s.x < -30 || s.x > _w + 30 || s.y < -30 || s.y > _h + 50) continue;
      const w = 22 * tr.s * k, h = w * 1.15;
      ctx.drawImage(treeImg(tr.k), s.x - w / 2, s.y - h * 0.9, w, h);
    }
  }

  /* ─── LANDMARK ICONS ─────────────────────────────────────────
     Each landmark now draws its OWN silhouette instead of a
     generic marker. Order is by z so close ones overlay far ones. */
  const mk = [];
  const isz = iconSize();
  for (const pl of PLACES) {
    const s = w2s(pl.x, pl.z);
    if (s.x < -80 || s.x > _w + 80 || s.y < -80 || s.y > _h + 80) continue;
    mk.push({ pl, s, sel: S.selectedId === pl.id });
  }
  mk.sort((a, b) => a.s.y - b.s.y);

  for (const m of mk) {
    const { pl, s, sel } = m;
    const bob = sel ? -3 - Math.abs(Math.sin(t * 4)) * 4 : 0;
    if (sel) {
      ctx.strokeStyle = "#e8b923"; ctx.lineWidth = 3.5; ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 2, isz * 0.5 + Math.sin(t * 4) * 2, isz * 0.17, 0, 0, 6.283);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    const icon = iconFor(pl.id);
    ctx.drawImage(icon, s.x - isz / 2, s.y - isz * 0.9 + bob, isz, isz);

    /* Badge for parent (sub-map) */
    if (pl.lm.kind === "parent") {
      const bx = s.x + isz * 0.36, by = s.y - isz * 0.78 + bob;
      ctx.fillStyle = RED; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, 6.283);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAPER;
      ctx.font = "700 11px " + SERIF;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("+", bx, by + 0.5);
    }
  }

  /* Ribbon labels */
  if (z > 0.3) {
    ctx.font = "italic 700 12px " + SERIF;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const order = mk.slice().sort((a, b) => (b.sel - a.sel) ||
      (Math.hypot(a.s.x - _w / 2, a.s.y - _h / 2) -
       Math.hypot(b.s.x - _w / 2, b.s.y - _h / 2)));
    const placed = [
      { x: 0, y: 50, w: 132, h: 150 },
      { x: _w - 66, y: _h / 2 - 150, w: 66, h: 230 },
    ];
    const card = document.getElementById("ph3d-map-card");
    const dockTop = _h - ((card && card.classList.contains("on")) ? 175 : 100);
    const maxLen = z > 0.9 ? 24 : 15;
    for (const m of order) {
      let name = m.pl.lm.name;
      name = name.charAt(0) + name.slice(1).toLowerCase();
      name = name.replace(/\b(\w)/g, (c) => c.toUpperCase())
                 .replace(/\bOf\b/g, "of")
                 .replace(/'S\b/g, "'s");
      if (name.length > maxLen) name = name.slice(0, maxLen - 1) + "…";
      const tw = ctx.measureText(name).width + 18, th = 20;
      const x = m.s.x - tw / 2, y = m.s.y + 7;
      if (x < 4 || x + tw > _w - 4 || y < 56 || y + th > dockTop) continue;
      if (!m.sel && placed.some(p =>
        x < p.x + p.w + 3 && x + tw + 3 > p.x &&
        y < p.y + p.h + 3 && y + th + 3 > p.y)) continue;
      placed.push({ x, y, w: tw, h: th });
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + tw, y);
      ctx.lineTo(x + tw - 5, y + th / 2);
      ctx.lineTo(x + tw, y + th);
      ctx.lineTo(x, y + th);
      ctx.lineTo(x + 5, y + th / 2);
      ctx.closePath();
      ctx.fillStyle = m.sel ? RED : PAPER;
      ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = m.sel ? PAPER : INK;
      ctx.fillText(name, m.s.x, y + th / 2 + 0.5);
    }
  }

  /* Player token */
  const me = playerPos();
  if (me.known) {
    const s = w2s(me.x, me.z);
    const pulse = (Math.sin(t * 3) + 1) / 2;
    ctx.fillStyle = "rgba(200,64,42," + (0.14 + pulse * 0.16) + ")";
    ctx.beginPath(); ctx.arc(s.x, s.y, 15 + pulse * 7, 0, 6.283); ctx.fill();
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(-me.yaw + Math.PI);
    ctx.fillStyle = RED; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(6, -11); ctx.lineTo(-6, -11);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#c8402a";
    ctx.beginPath();
    ctx.moveTo(s.x - 8, s.y + 8);
    ctx.lineTo(s.x, s.y - 5);
    ctx.lineTo(s.x + 8, s.y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = "#f2d2a0";
    ctx.beginPath(); ctx.arc(s.x, s.y - 7, 4.6, 0, 6.283);
    ctx.fill(); ctx.stroke();
  }

  /* Compass */
  {
    const cx = _w - 35, cy = _h / 2 - 98;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(239,227,187,.88)"; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, 6.283);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(4, 0); ctx.lineTo(-4, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(4, 0); ctx.lineTo(-4, 0); ctx.closePath();
    ctx.fill();
    ctx.font = "700 9px " + SERIF;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("N", 0, -26);
    ctx.restore();
  }

  /* Paper grain + vignette */
  if (pat) { ctx.fillStyle = pat; ctx.globalAlpha = 0.5; ctx.fillRect(0, 0, _w, _h); ctx.globalAlpha = 1; }
  const vg = ctx.createRadialGradient(
    _w / 2, _h / 2, Math.min(_w, _h) * 0.35,
    _w / 2, _h / 2, Math.max(_w, _h) * 0.78);
  vg.addColorStop(0, "rgba(40,25,5,0)");
  vg.addColorStop(1, "rgba(40,25,5,.42)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, _w, _h);
}

/* ──────────────────────────────────────────────────────────────
   9. MINI-MAP
   ────────────────────────────────────────────────────────────── */
function drawMini() {
  const g = _mctx;
  if (!g) return;
  const mw = 104, mh = 120;
  const sx = (x) => (x - MB.x0) / (MB.x1 - MB.x0) * mw;
  const sy = (z) => (z - MB.z0) / (MB.z1 - MB.z0) * mh;
  g.fillStyle = "#7aa0ab"; g.fillRect(0, 0, mw, mh);
  const lx0 = sx(-W.LAND_X), lx1 = sx(W.LAND_X);
  const ly0 = sy(-W.LAND_Z), ly1 = sy(W.LAND_Z);
  g.fillStyle = "#c8c476";
  rr(g, lx0, ly0, lx1 - lx0, ly1 - ly0, 6); g.fill();
  g.strokeStyle = "#4f8a3c"; g.lineWidth = 2; g.stroke();
  g.fillStyle = "#e4b97b";
  rr(g, sx(-CITY_HX), sy(-CITY_HZ),
     sx(CITY_HX) - sx(-CITY_HX), sy(CITY_HZ) - sy(-CITY_HZ), 4);
  g.fill();
  g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = "#8a6a3a"; g.lineWidth = 1.2;
  g.beginPath();
  g.rect(sx(-W.RING_R), sy(-W.RING_RZ),
    sx(W.RING_R) - sx(-W.RING_R), sy(W.RING_RZ) - sy(-W.RING_RZ));
  g.moveTo(sx(-W.RING_R), sy(0)); g.lineTo(sx(W.RING_R), sy(0));
  g.moveTo(sx(0), sy(-W.RING_RZ)); g.lineTo(sx(0), sy(W.RING_RZ));
  g.stroke();
  g.fillStyle = "#93b7bf"; g.fillRect(sx(-318), 0, sx(-280) - sx(-318), mh);
  PLACES.forEach(pl => {
    g.fillStyle = pl.color; g.strokeStyle = INK; g.lineWidth = 1;
    g.beginPath();
    g.arc(sx(pl.x), sy(pl.z), pl.id === S.selectedId ? 3.6 : 2.5, 0, 6.283);
    g.fill(); g.stroke();
  });
  const me = playerPos();
  if (me.known) {
    g.fillStyle = "#c8402a"; g.strokeStyle = "#fff"; g.lineWidth = 1.2;
    g.beginPath(); g.arc(sx(me.x), sy(me.z), 3, 0, 6.283);
    g.fill(); g.stroke();
  }
  const hw = _w / 2 / S.zoom, hh = _h / 2 / S.zoom;
  const vx = sx(S.camX - hw), vy = sy(S.camY - hh);
  const vw = sx(S.camX + hw) - vx, vh = sy(S.camY + hh) - vy;
  g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 3; g.strokeRect(vx, vy, vw, vh);
  g.strokeStyle = "#fff"; g.lineWidth = 1.6; g.strokeRect(vx, vy, vw, vh);
}

/* ──────────────────────────────────────────────────────────────
   10. LOOP
   ────────────────────────────────────────────────────────────── */
function loop(ts) {
  if (!_built) return;
  requestAnimationFrame(loop);
  if (!S.shown) return;
  const t = (ts || 0) / 1000;
  if (t - _lastT < 0.016) return;
  _lastT = t;
  draw(t);
  if ((_frame++ % 3) === 0) drawMini();
}

/* ──────────────────────────────────────────────────────────────
   11. PUBLIC API
   ────────────────────────────────────────────────────────────── */
function close() {
  const root = document.getElementById("ph3d-map-app");
  if (root) root.classList.remove("on");
  S.shown = false;
  S.pts.clear();
  S.drag = null;
  S.pinch = null;
  select(null);
}

export const MapApp = {
  open() {
    build();
    const root = document.getElementById("ph3d-map-app");
    if (!root) return;
    root.classList.add("on");
    S.shown = true;
    resize();
    const p = playerPos();
    S.fly = null;
    S.camX = p.known ? p.x : 0;
    S.camY = p.known ? p.z : 0;
    S.zoom = S.zoomTarget = p.known ? 0.6 : Math.max(0.3, Math.min(0.5, Math.min(_w / 560, _h / 520)));
    select(null);
    document.getElementById("ph3d-map-strip").scrollLeft = 0;
    drawMini();
  },
  close,
  isOpen() { return S.shown; },
};
