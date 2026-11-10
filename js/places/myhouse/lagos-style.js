/* My House -- "Lagos flat mansion" style layer.

   The house layout (rooms/_meta.js) stays exactly as it was so every piece of
   furniture, seat, drawer and the arrange-furniture editor keep working. This
   module only changes how the shell LOOKS: marble / wood / tile floors, skirting
   and crown trim with a gold line, chandeliers, a Nigerian flag, a tall window
   wall, and a Lagos skyline outside so the home reads as a luxury flat on an
   upper floor instead of a bungalow floating in a field.

   Everything added here is tagged userData.isDecoration so it never turns into
   a collider. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { M, EM } from "../../core/kit.js";

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---- floors ---------------------------------------------------------- */
export function makeFloorTextures() {
  const R = rnd(7);
  const marble = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#f3eee5"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) {
      g.strokeStyle = i % 5 === 0 ? "rgba(190,160,80,.22)" : "rgba(150,150,160,.16)";
      g.lineWidth = R() * 1.8 + .4;
      let x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (R() - .5) * 90; y += (R() - .5) * 90; g.quadraticCurveTo(x + (R() - .5) * 50, y + (R() - .5) * 50, x, y); }
      g.stroke();
    }
    g.strokeStyle = "rgba(120,110,95,.45)"; g.lineWidth = 2;   // 1 m slab joints
    g.strokeRect(0, 0, w, h);
  });
  const wood = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#a8774c"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const v = 150 + (R() * 40 | 0);
      g.fillStyle = `rgb(${v},${v * .68 | 0},${v * .42 | 0})`; g.fillRect(0, i * 32, w, 31);
      g.strokeStyle = "rgba(60,32,16,.7)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
      g.strokeStyle = "rgba(60,32,16,.25)"; g.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const x = R() * w; g.beginPath(); g.moveTo(x, i * 32); g.lineTo(x + 40, i * 32 + 31); g.stroke(); }
    }
  });
  const tile = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#e6e2da"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#bdb6a8"; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2);
    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(8, 8, 40, 40);
  });
  const dark = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#4a4743"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#2c2a27"; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2);
  });
  return { marble, wood, tile, dark };
}

/* tile size in metres for each texture (repeat = room size / tile size) */
const TILE_M = { marble: 3, wood: 2.4, tile: 1.2, dark: 1.4 };
const FLOOR_BY_TYPE = {
  corridor: "marble", living: "marble", kitchen: "dark",
  library: "wood", bedroom: "wood", bath: "tile",
};

export function floorMeshForRoom(room, texs, LOWQ) {
  const kind = FLOOR_BY_TYPE[room.type] || "marble";
  const base = texs[kind];
  const t = base.clone(); t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.max(1, room.w / TILE_M[kind]), Math.max(1, room.d / TILE_M[kind]));
  const mat = LOWQ
    ? new THREE.MeshLambertMaterial({ map: t })
    : new THREE.MeshStandardMaterial({ map: t, roughness: kind === "wood" ? .55 : .22, metalness: kind === "marble" ? .08 : 0 });
  const g = new THREE.BoxGeometry(room.w, .12, room.d);
  const m = new THREE.Mesh(g, mat);
  m.position.set(room.x + room.w / 2, .06, room.z + room.d / 2);
  m.receiveShadow = !LOWQ;
  m.userData.isDecoration = true;
  m.userData.isFloor = true;
  return m;
}

/* ---- wall trim: called per wall segment from interior.js ---------------- */
export const TRIM_MAT = M(0xfaf6ee, .85);
export const GOLD_MAT = new THREE.MeshStandardMaterial({ color: 0xc9a64a, roughness: .35, metalness: .75 });

export function trimForSegment(axis, fixed, s, e, WT, WH, trimBag, goldBag) {
  const ln = e - s; if (ln < .1) return;
  const mid = (s + e) / 2;
  const mk = (h, y, extra, bag) => {
    const w = axis === "z" ? WT + extra : ln, d = axis === "z" ? ln : WT + extra;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(axis === "z" ? fixed : mid, y, axis === "z" ? mid : fixed);
    bag.push(g);
  };
  mk(.2, .1, .07, trimBag);          // skirting
  mk(.26, WH - .13, .12, trimBag);   // crown moulding
  mk(.05, 1.15, .035, goldBag);      // gold dado line
  mk(.04, WH - .32, .05, goldBag);   // gold line under the crown
}

/* ---- chandelier --------------------------------------------------------- */
export function chandelier(three, x, y, z, s = 1) {
  const g = new THREE.Group();
  const gold = GOLD_MAT;
  const glow = EM(0xfff0c8, 1.6);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.2, 6), gold);
  chain.position.y = .9; g.add(chain);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), gold); g.add(hub);
  for (let tier = 0; tier < 2; tier++) {
    const r = (tier === 0 ? .9 : .55) * s, yy = -.15 - tier * .3;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .03, 6, 24), gold);
    ring.rotation.x = Math.PI / 2; ring.position.y = yy; g.add(ring);
    const n = tier === 0 ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(.09 * s, 8, 6), glow);
      b.position.set(Math.cos(a) * r, yy + .1, Math.sin(a) * r); g.add(b);
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(.04 * s, .28 * s, 5),
        new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: .1, metalness: .1, transparent: true, opacity: .8 }));
      crystal.rotation.x = Math.PI; crystal.position.set(Math.cos(a) * r, yy - .2 * s, Math.sin(a) * r); g.add(crystal);
    }
  }
  g.position.set(x, y, z);
  g.traverse(o => { o.userData.isDecoration = true; });
  three.add(g);
  return g;
}

/* ---- tall window wall with curtains (replaces the small windows) ---------- */
export function addPanoramaWindows(three, LOCAL, bounds, ecx, WT, WH, LOWQ) {
  const glassG = [], frameG = [], curtainG = [];
  const WY0 = .55, WYH = 3.1, WW = 3.2;
  const panel = (axis, fixed, pos, inward) => {
    const mkBox = (w, h, d, ox, oy, list) => {
      const g = new THREE.BoxGeometry(axis === "x" ? w : d, h, axis === "x" ? d : w);
      const off = inward * (WT / 2 + .02);
      if (axis === "x") g.translate(pos + ox, WY0 + WYH / 2 + oy, fixed + off);
      else g.translate(fixed + off, WY0 + WYH / 2 + oy, pos + ox);
      list.push(g);
    };
    mkBox(WW, WYH, .03, 0, 0, glassG);
    mkBox(WW + .14, .08, .06, 0, WYH / 2, frameG); mkBox(WW + .14, .08, .06, 0, -WYH / 2, frameG);
    mkBox(.08, WYH, .06, -WW / 2, 0, frameG); mkBox(.08, WYH, .06, WW / 2, 0, frameG);
    mkBox(.05, WYH, .06, 0, 0, frameG); mkBox(WW, .05, .06, 0, WYH * .1, frameG);
    mkBox(.55, WYH + .3, .1, -WW / 2 - .35, .1, curtainG); mkBox(.55, WYH + .3, .1, WW / 2 + .35, .1, curtainG);
  };
  LOCAL.forEach(r => {
    const f = r.win || "";
    const spread = (len, c) => len >= 9 ? [c - len / 4, c + len / 4] : [c];
    const cxr = r.x + r.w / 2, czr = r.z + r.d / 2;
    if (f.includes("N")) spread(r.w, cxr).forEach(x => panel("x", bounds.mnZ, x, +1));
    if (f.includes("S")) spread(r.w, cxr).forEach(x => { if (Math.abs(x - ecx) > 2.4) panel("x", bounds.mxZ, x, -1); });
    if (f.includes("W")) spread(r.d, czr).forEach(z => panel("z", bounds.mnX, z, +1));
    if (f.includes("E")) spread(r.d, czr).forEach(z => panel("z", bounds.mxX, z, -1));
  });
  /* painted "view" so the glass looks onto Lagos (skyline + lagoon) instead of
     a flat blue card. Same picture on every pane, drawn once. */
  const R = rnd(99);
  const viewTex = canvasTex(256, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#7db8ea"); sky.addColorStop(.7, "#dcecf8"); sky.addColorStop(1, "#f4efe3");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {                       // far towers
      const bw = 14 + R() * 22, bh = 40 + R() * 120, bx = i * 17 - 6 + R() * 8;
      g.fillStyle = i % 2 ? "#8da3b8" : "#7890a8"; g.fillRect(bx, h * .78 - bh, bw, bh);
      g.fillStyle = "rgba(255,240,190,.55)";
      for (let y = h * .78 - bh + 6; y < h * .78 - 4; y += 10) for (let x = bx + 3; x < bx + bw - 3; x += 7) if (R() > .6) g.fillRect(x, y, 3, 4);
    }
    g.fillStyle = "#5f8fb0"; g.fillRect(0, h * .78, w, h * .22);           // lagoon
    g.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 18; i++) g.fillRect(R() * w, h * .8 + R() * h * .18, 12 + R() * 20, 1.5);
    g.strokeStyle = "#e9eef2"; g.lineWidth = 3;                              // bridge
    g.beginPath(); g.moveTo(0, h * .8); g.quadraticCurveTo(w * .5, h * .62, w, h * .8); g.stroke();
  });
  viewTex.wrapS = viewTex.wrapT = THREE.ClampToEdgeWrapping;
  [[glassG, new THREE.MeshBasicMaterial({ map: viewTex })],
   [frameG, GOLD_MAT],
   [curtainG, M(0xd9c9a6, .95)]].forEach(([list, mat]) => {
    if (!list.length) return;
    const merged = mergeGeometries(list, false);
    if (merged) { const m = new THREE.Mesh(merged, mat); m.userData.isDecoration = true; three.add(m); }
    list.forEach(g => g.dispose());
  });
}

/* ---- Lagos skyline + street far below the flat ----------------------------- */
export function addSkyline(three, W, D, LOWQ) {
  const R = rnd(4242);
  const winTex = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = "#2c3440"; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 4; y += 12) for (let x = 6; x < w - 4; x += 12) {
      g.fillStyle = R() > .45 ? "#ffe6a0" : "#46556a"; g.fillRect(x, y, 6, 7);
    }
  });
  const towers = [], tops = [];
  const n = LOWQ ? 18 : 34;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + R() * .12;
    const dist = Math.max(W, D) * .5 + 26 + R() * 40;
    const w = 7 + R() * 9, d = 7 + R() * 9, h = 22 + R() * 70;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(Math.cos(a) * dist, h / 2 - 26, Math.sin(a) * dist);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 6), uv.getY(k) * (h / 10));
    towers.push(g);
    if (R() > .5) { const t = new THREE.CylinderGeometry(.15, .15, 8, 5); t.translate(Math.cos(a) * dist, h - 26 + 4, Math.sin(a) * dist); tops.push(t); }
  }
  winTex.repeat.set(1, 1);
  const tm = new THREE.Mesh(mergeGeometries(towers, false), new THREE.MeshLambertMaterial({ map: winTex }));
  tm.userData.isDecoration = true; three.add(tm);
  if (tops.length) { const am = new THREE.Mesh(mergeGeometries(tops, false), EM(0xff3030, 1.5)); am.userData.isDecoration = true; three.add(am); }
  towers.concat(tops).forEach(g => g.dispose());
  // street / lagoon level far below
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 40), new THREE.MeshLambertMaterial({ color: 0x5b6772 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -26; ground.userData.isDecoration = true; three.add(ground);
}

/* ---- Nigerian flag + framed art on the living / corridor walls ---------------- */
export function addDecor(three, LOCAL, mnX, mxX, mnZ, mxZ, WH) {
  const liv = LOCAL.find(r => r.id === "living");
  const cor = LOCAL.find(r => r.id === "corridor");
  const g = new THREE.Group();
  if (cor) {
    const fx = cor.x + 2.2, fz = cor.z + cor.d / 2 - .0;
    const flagZ = cor.z + 0.16;          // on the corridor's north wall
    [[-.55, 0x008751], [0, 0xffffff], [.55, 0x008751]].forEach(([dx, c]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.55, 1.5, .04), new THREE.MeshLambertMaterial({ color: c }));
      m.position.set(fx + dx, 3.2, flagZ); g.add(m);
    });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.9, 6), GOLD_MAT);
    pole.rotation.z = Math.PI / 2; pole.position.set(fx, 4.05, flagZ - .02); g.add(pole);
    // big framed canvases along the entry hall's north wall
    [8.8, 18, 24.2].filter(ox => ox < cor.w - 2).forEach((ox, i) => {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, .08), GOLD_MAT);
      fr.position.set(cor.x + ox, 3.1, cor.z + .14); g.add(fr);
      const cv = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, .05), new THREE.MeshLambertMaterial({ color: [0x2f6b7a, 0x8a3b3b, 0x3f7a44][i] }));
      cv.position.set(cor.x + ox, 3.1, cor.z + .18); g.add(cv);
    });
  }
  g.traverse(o => { o.userData.isDecoration = true; });
  three.add(g);
}
