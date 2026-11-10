/* starter-flat.js -- the 1-bedroom starter flat (9m x 7m), converted from the
   standalone walkable demo. Standalone first-person controls/renderer/loop were
   removed; the game's ThirdPersonControls drive the avatar. Seats + uses are
   exposed so sitting / lying / cooking work like every other interior. */
import * as THREE from "three";
import { Quality } from "../../core/quality.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import meta from "./meta.js";

export async function buildStarterFlat(router) {
  const renderer = router.renderer;
  const LOWQ = Quality.isLow;

  const K = 2.05;   /* overall flat scale (was 1.45): ~2x the floor area so the camera has room */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc6e8);
  const root = new THREE.Group(); root.scale.setScalar(K); scene.add(root);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 80);
  camera.rotation.order = "YXZ";

  /* ---------- procedural textures ---------- */
  function makeTex(size, draw) {
    const c = document.createElement("canvas"); c.width = c.height = size;
    draw(c.getContext("2d"), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const TEX_WOOD = makeTex(512, (g, s) => {
    const planks = 6, ph = s / planks;
    for (let i = 0; i < planks; i++) {
      const base = 118 + Math.random() * 46;
      g.fillStyle = `rgb(${base | 0},${(base * 0.67) | 0},${(base * 0.43) | 0})`;
      g.fillRect(0, i * ph, s, ph);
      for (let k = 0; k < 55; k++) {
        g.strokeStyle = `rgba(58,32,12,${0.03 + Math.random() * 0.07})`;
        g.lineWidth = 0.6 + Math.random() * 1.6; g.beginPath();
        const y = i * ph + Math.random() * ph; g.moveTo(0, y);
        g.bezierCurveTo(s * 0.33, y + (Math.random() - 0.5) * 11, s * 0.66, y + (Math.random() - 0.5) * 11, s, y);
        g.stroke();
      }
      if (Math.random() < 0.55) {
        const kx = Math.random() * s, ky = i * ph + ph * 0.5;
        g.strokeStyle = "rgba(70,40,15,0.32)";
        for (let r = 2; r < 15; r += 3) { g.beginPath(); g.ellipse(kx, ky, r * 1.7, r * 0.65, 0, 0, 6.283); g.stroke(); }
      }
      g.fillStyle = "rgba(0,0,0,0.30)"; g.fillRect(0, i * ph + ph - 2, s, 2);
    }
  });
  const TEX_TILE = makeTex(512, (g, s) => {
    g.fillStyle = "#c6cbd1"; g.fillRect(0, 0, s, s);
    const n = 4, c = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 226 + Math.random() * 16;
      g.fillStyle = `rgb(${v | 0},${(v + 2) | 0},${(v + 7) | 0})`; g.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
      for (let k = 0; k < 5; k++) {
        g.strokeStyle = `rgba(178,190,202,${0.12 + Math.random() * 0.18})`; g.lineWidth = 1 + Math.random() * 2;
        g.beginPath(); g.moveTo(i * c + Math.random() * c, j * c + 3); g.lineTo(i * c + Math.random() * c, j * c + c - 3); g.stroke();
      }
    }
  });
  const TEX_WALL = makeTex(256, (g, s) => {
    g.fillStyle = "#efe9e1"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 8000; i++) { const v = Math.random() < 0.5 ? 255 : 178; g.fillStyle = `rgba(${v},${v},${v},0.035)`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  });
  const TEX_FABRIC = makeTex(128, (g, s) => {
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) { const v = 195 + Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v},0.3)`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  });
  const TEX_RUG = makeTex(256, (g, s) => {
    g.fillStyle = "#5a6472"; g.fillRect(0, 0, s, s);
    g.strokeStyle = "#8e9aa8"; g.lineWidth = 8; g.strokeRect(14, 14, s - 28, s - 28);
    g.strokeStyle = "#c9b48a"; g.lineWidth = 3; g.strokeRect(30, 30, s - 60, s - 60);
    g.fillStyle = "rgba(201,180,138,0.35)";
    for (let i = 0; i < 40; i++) g.fillRect(20 + Math.random() * (s - 40), 20 + Math.random() * (s - 40), 6, 6);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  });

  /* ---------- materials ---------- */
  function tiled(baseTex, rx, ry, color, rough = 0.75) {
    const t = baseTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map: t, color: color ?? 0xffffff, roughness: rough });
  }
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    wall: S({ map: TEX_WALL, color: 0xf7f2ea, roughness: 0.96 }),
    wallWarm: S({ map: TEX_WALL, color: 0xe8ddcf, roughness: 0.96 }),
    trim: S({ color: 0xfbfbfb, roughness: 0.45 }),
    glass: S({ color: 0xbfe0ff, transparent: true, opacity: 0.16, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    steel: S({ color: 0xb9bec4, metalness: 0.85, roughness: 0.3 }),
    chrome: S({ color: 0xd8dde2, metalness: 0.95, roughness: 0.15 }),
    black: S({ color: 0x1b1c1f, roughness: 0.5 }),
    screen: S({ color: 0x05070a, roughness: 0.15, metalness: 0.4, emissive: 0x0a1622, emissiveIntensity: 1 }),
    white: S({ color: 0xf4f5f6, roughness: 0.35 }),
    counter: S({ color: 0x2e3237, roughness: 0.35, metalness: 0.25 }),
    woodDark: tiled(TEX_WOOD, 1, 1, 0x7a5334, 0.6),
    woodMid: tiled(TEX_WOOD, 1, 1, 0xa87a4d, 0.65),
    fabricGrey: S({ map: TEX_FABRIC, color: 0x8f97a3, roughness: 0.95 }),
    fabricBlue: S({ map: TEX_FABRIC, color: 0x5f7d9c, roughness: 0.95 }),
    fabricCream: S({ map: TEX_FABRIC, color: 0xe6ddcd, roughness: 0.95 }),
    bedding: S({ map: TEX_FABRIC, color: 0xd9e2ec, roughness: 0.95 }),
    leaf: S({ color: 0x3f7d43, roughness: 0.8 }), leaf2: S({ color: 0x2e6636, roughness: 0.8 }),
    pot: S({ color: 0xb4653f, roughness: 0.85 }),
    rug: S({ map: TEX_RUG, roughness: 1 }),
    lamp: S({ color: 0xfff2d4, emissive: 0xffe6b0, emissiveIntensity: 1.4, roughness: 0.6 }),
    mirror: S({ color: 0xcfd8de, metalness: 0.9, roughness: 0.06 }),
    art1: S({ color: 0xc2703f, roughness: 0.8 }), art2: S({ color: 0x3f6d8c, roughness: 0.8 }), art3: S({ color: 0xd8c48a, roughness: 0.8 }),
  };

  /* ---------- build helpers ---------- */
  const colliders = [], seats = [], uses = [];
  const addCollider = (minX, maxX, minZ, maxZ, y1 = 1.0) => colliders.push({ minX, maxX, minZ, maxZ, y0: 0, y1, level: 0 });
  const colliderAt = (cx, cz, w, d, y1) => addCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, y1);
  const WALL_H = 2.7, WALL_T = 0.12;

  function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = !LOWQ; m.receiveShadow = !LOWQ; return m; }
  function put(parent, mesh, x, y, z, ry = 0) { mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; parent.add(mesh); return mesh; }
  function cyl(rt, rb, h, seg, mat) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = !LOWQ; m.receiveShadow = !LOWQ; return m; }
  function group() { const g = new THREE.Group(); root.add(g); return g; }

  function buildWall(x1, z1, x2, z2, opts = {}) {
    const h = opts.h ?? WALL_H, t = opts.t ?? WALL_T, mat = opts.mat ?? M.wall;
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, ang = Math.atan2(-uz, ux);
    const ops = (opts.openings || []).slice().sort((a, b) => a.from - b.from);
    const segs = []; let cur = 0;
    for (const o of ops) {
      if (o.from > cur + 1e-4) segs.push([cur, o.from, 0, h]);
      if (o.bottom > 0.001) segs.push([o.from, o.to, 0, o.bottom]);
      if (o.top < h - 0.001) segs.push([o.from, o.to, o.top, h]);
      cur = Math.max(cur, o.to);
    }
    if (cur < L - 1e-4) segs.push([cur, L, 0, h]);
    for (const [a, b, y0, y1] of segs) {
      const len = b - a; if (len < 0.005) continue;
      const cx = x1 + ux * (a + b) / 2, cz = z1 + uz * (a + b) / 2;
      const m = box(len, y1 - y0, t, mat); m.position.set(cx, (y0 + y1) / 2, cz); m.rotation.y = ang; m.userData.isWall = true; root.add(m);
      if (y0 < 0.001) {
        const sk = box(len, 0.09, t + 0.03, M.trim); sk.position.set(cx, 0.045, cz); sk.rotation.y = ang; sk.castShadow = false; root.add(sk);
        const ax = x1 + ux * a, az = z1 + uz * a, bx = x1 + ux * b, bz = z1 + uz * b;
        addCollider(Math.min(ax, bx) - Math.abs(uz) * t / 2, Math.max(ax, bx) + Math.abs(uz) * t / 2,
                    Math.min(az, bz) - Math.abs(ux) * t / 2, Math.max(az, bz) + Math.abs(ux) * t / 2, WALL_H);
      }
    }
    for (const o of ops) {
      const mid = (o.from + o.to) / 2, cx = x1 + ux * mid, cz = z1 + uz * mid, w = o.to - o.from, hh = o.top - o.bottom, fd = t + 0.04, fw = 0.05;
      for (const p of [o.from, o.to]) {
        const px = x1 + ux * p, pz = z1 + uz * p, off = (p === o.from ? fw / 2 : -fw / 2);
        const j = box(fw, o.top, fd, M.trim); j.position.set(px + ux * off, o.top / 2, pz + uz * off); j.rotation.y = ang; root.add(j);
      }
      const head = box(w + fw * 2, fw, fd, M.trim); head.position.set(cx, o.top + fw / 2, cz); head.rotation.y = ang; root.add(head);
      if (o.window) {
        const glass = box(w - 0.05, hh - 0.05, 0.02, M.glass); glass.position.set(cx, (o.bottom + o.top) / 2, cz); glass.rotation.y = ang; glass.castShadow = false; root.add(glass);
        const mull = box(0.045, hh - 0.05, 0.055, M.trim); mull.position.set(cx, (o.bottom + o.top) / 2, cz); mull.rotation.y = ang; root.add(mull);
        const sill = box(w + 0.12, 0.05, t + 0.14, M.trim); sill.position.set(cx, o.bottom - 0.03, cz); sill.rotation.y = ang; root.add(sill);
      }
    }
  }
  function floorPatch(x1, z1, x2, z2, mat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat);
    m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2); m.receiveShadow = !LOWQ; root.add(m);
  }
  function rug(cx, cz, w, d, mat = M.rug) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.008, cz); m.receiveShadow = !LOWQ; root.add(m);
  }
  function addCeilingLight(x, z, intensity = 1) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 20),
      S({ color: 0xffffff, emissive: 0xffe9c4, emissiveIntensity: 2.2, roughness: 0.5 }));
    m.position.set(x, WALL_H - 0.03, z); root.add(m);
    const pl = new THREE.PointLight(0xfff0d8, 9 * intensity * K * K, 7 * K, 2); pl.position.set(x, WALL_H - 0.25, z); root.add(pl);
  }
  function addSeat(type, label, x, z, yaw, h) {
    seats.push({ type, label, x, z, dx: Math.sin(yaw), dz: Math.cos(yaw), yaw, h, level: 0, taken: false });
  }
  const addUse = (kind, label, x, z, r = 1.6) => uses.push({ kind, label, x, z, y: 0, level: 0, r });

  /* ---------- shell ---------- */
  floorPatch(0, 0, 5.4, 4.2, tiled(TEX_WOOD, 4.5, 3.5));
  floorPatch(5.4, 0, 9, 4.2, tiled(TEX_TILE, 4, 5));
  floorPatch(0, 4.2, 4.6, 7, tiled(TEX_WOOD, 4, 2.3));
  floorPatch(4.6, 4.2, 7.2, 7, tiled(TEX_TILE, 3, 3.5));
  floorPatch(7.2, 4.2, 9, 7, tiled(TEX_WOOD, 2, 2.3));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), S({ color: 0xf6f4f0, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(4.5, WALL_H, 3.5); ceil.receiveShadow = !LOWQ; root.add(ceil);

  buildWall(0, 0, 9, 0, { openings: [{ from: 1.5, to: 3.5, bottom: 0.9, top: 2.2, window: true }, { from: 6.0, to: 8.0, bottom: 0.9, top: 2.2, window: true }] });
  buildWall(9, 0, 9, 7, { openings: [{ from: 5.0, to: 5.9, bottom: 0, top: 2.1 }] });
  buildWall(0, 7, 9, 7, { openings: [{ from: 1.2, to: 3.4, bottom: 0.9, top: 2.2, window: true }] });
  buildWall(0, 0, 0, 7, {});
  buildWall(0, 4.2, 9, 4.2, { openings: [{ from: 1.0, to: 1.9, bottom: 0, top: 2.05 }, { from: 7.4, to: 8.3, bottom: 0, top: 2.05 }] });
  buildWall(5.4, 0, 5.4, 4.2, { openings: [{ from: 2.2, to: 4.2, bottom: 0, top: 2.4 }] });
  buildWall(4.6, 4.2, 4.6, 7, { mat: M.wallWarm });
  buildWall(7.2, 4.2, 7.2, 7, { openings: [{ from: 5.2, to: 6.1, bottom: 0, top: 2.05 }] });
  /* invisible plug in the entry doorway so the camera can't swing outside */
  addCollider(9.0, 10, 5.0, 5.9, WALL_H);

  /* ---------- living room ---------- */
  (function livingRoom() {
    rug(2.1, 2.0, 3.4, 2.6);
    const s = group(); const W = 2.1, D = 0.9;
    put(s, box(W, 0.30, D, M.fabricGrey), 0, 0.24, 0);
    for (let i = -1; i <= 1; i++) put(s, box(W / 3 - 0.07, 0.17, D - 0.22, M.fabricCream), i * (W / 3), 0.47, 0.06);
    put(s, box(W, 0.58, 0.18, M.fabricGrey), 0, 0.63, -D / 2 + 0.09);
    for (let i = -1; i <= 1; i++) put(s, box(W / 3 - 0.07, 0.44, 0.17, M.fabricBlue), i * (W / 3), 0.62, -D / 2 + 0.24);
    put(s, box(0.17, 0.52, D, M.fabricGrey), -W / 2 + 0.085, 0.43, 0);
    put(s, box(0.17, 0.52, D, M.fabricGrey), W / 2 - 0.085, 0.43, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(s, cyl(0.03, 0.025, 0.12, 6, M.woodDark), sx * (W / 2 - 0.15), 0.06, sz * (D / 2 - 0.12));
    s.position.set(2.1, 0, 0.78); colliderAt(2.1, 0.78, W + 0.1, D + 0.1, 0.9);
    for (const i of [-1, 0, 1]) addSeat("sit", "SIT", 2.1 + i * 0.66, 0.92, 0, 0.5);

    const ct = group();
    put(ct, box(1.3, 0.05, 0.7, M.woodMid), 0, 0.42, 0); put(ct, box(1.15, 0.04, 0.58, M.woodDark), 0, 0.15, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(ct, box(0.05, 0.42, 0.05, M.woodDark), sx * 0.6, 0.21, sz * 0.31);
    put(ct, box(0.22, 0.03, 0.16, M.art3), -0.28, 0.46, 0.02); put(ct, cyl(0.05, 0.045, 0.1, 12, M.white), 0.32, 0.49, -0.05);
    ct.position.set(2.1, 0, 2.15); colliderAt(2.1, 2.15, 1.35, 0.75, 0.5);

    const tv = group();
    put(tv, box(1.8, 0.42, 0.42, M.woodDark), 0, 0.21, 0); put(tv, box(1.86, 0.04, 0.46, M.woodMid), 0, 0.44, 0);
    for (const x of [-0.6, 0, 0.6]) put(tv, box(0.44, 0.3, 0.02, M.black), x, 0.22, 0.215);
    tv.position.set(3.3, 0, 3.92); colliderAt(3.3, 3.92, 1.85, 0.5, 0.5);
    const screen = box(1.22, 0.7, 0.045, M.screen); screen.position.set(3.3, 1.52, 4.11); root.add(screen);
    const bezel = box(1.28, 0.76, 0.03, M.black); bezel.position.set(3.3, 1.52, 4.10); root.add(bezel);

    const bs = group();
    put(bs, box(0.34, 1.9, 0.06, M.woodDark), 0, 0.95, -0.47); put(bs, box(0.34, 1.9, 0.06, M.woodDark), 0, 0.95, 0.47);
    put(bs, box(0.34, 0.05, 1.0, M.woodDark), 0, 1.9, 0);
    for (let i = 0; i < 5; i++) put(bs, box(0.32, 0.035, 0.96, M.woodMid), 0, 0.08 + i * 0.45, 0);
    const bookCols = [M.art1, M.art2, M.art3, M.fabricBlue, M.leaf];
    for (let sh = 0; sh < 4; sh++) { let zz = -0.42; while (zz < 0.4) {
      const bw = 0.03 + Math.random() * 0.05, bh = 0.18 + Math.random() * 0.1;
      const b = box(0.2, bh, bw, bookCols[(Math.random() * 5) | 0]); b.position.set(0.02, 0.1 + sh * 0.45 + bh / 2, zz + bw / 2); bs.add(b); zz += bw + 0.008; } }
    bs.position.set(0.22, 0, 2.4); colliderAt(0.22, 2.4, 0.42, 1.05, 1.95);

    const fl = group();
    put(fl, cyl(0.16, 0.18, 0.04, 16, M.black), 0, 0.02, 0); put(fl, cyl(0.018, 0.018, 1.5, 8, M.black), 0, 0.77, 0); put(fl, cyl(0.2, 0.13, 0.28, 16, M.lamp), 0, 1.6, 0);
    fl.position.set(4.75, 0, 0.85); colliderAt(4.75, 0.85, 0.35, 0.35, 1.75);

    const pl = group();
    put(pl, cyl(0.19, 0.15, 0.36, 14, M.pot), 0, 0.18, 0); put(pl, cyl(0.17, 0.17, 0.04, 14, M.woodDark), 0, 0.37, 0);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const l = box(0.05, 0.5 + Math.random() * 0.35, 0.14, i % 2 ? M.leaf : M.leaf2);
      l.position.set(Math.cos(a) * 0.13, 0.6 + Math.random() * 0.25, Math.sin(a) * 0.13); l.rotation.set(Math.cos(a) * 0.5, a, Math.sin(a) * 0.5); pl.add(l); }
    pl.position.set(0.55, 0, 3.65); colliderAt(0.55, 3.65, 0.42, 0.42, 1.2);

    const art = group(); put(art, box(0.04, 0.62, 0.48, M.art2), 0, 0, 0); put(art, box(0.05, 0.52, 0.38, M.art3), 0.01, 0, 0); art.position.set(0.09, 1.55, 1.2);
    addCeilingLight(2.6, 2.0);
  })();

  /* ---------- kitchen ---------- */
  (function kitchen() {
    const CH = 0.9, CD = 0.6;
    const runS = group();
    put(runS, box(2.9, CH - 0.1, CD, M.white), 0, (CH - 0.1) / 2, 0); put(runS, box(2.96, 0.05, CD + 0.04, M.counter), 0, CH, 0);
    for (let i = 0; i < 4; i++) put(runS, box(0.66, CH - 0.18, 0.02, M.woodMid), -1.08 + i * 0.72, (CH - 0.1) / 2, CD / 2 + 0.005);
    runS.position.set(6.95, 0, 0.32); colliderAt(6.95, 0.32, 2.95, CD + 0.06, CH + 0.05);
    const sink = group();
    put(sink, box(0.62, 0.02, 0.42, M.steel), 0, 0.005, 0); put(sink, box(0.5, 0.16, 0.32, M.steel), 0, -0.08, 0);
    put(sink, cyl(0.025, 0.03, 0.26, 10, M.chrome), 0, 0.13, -0.16);
    const tap = put(sink, cyl(0.02, 0.02, 0.22, 8, M.chrome), 0, 0.24, -0.05); tap.rotation.x = Math.PI / 2.4;
    sink.position.set(7.0, CH + 0.03, 0.32);

    const runE = group();
    put(runE, box(CD, CH - 0.1, 3.3, M.white), 0, (CH - 0.1) / 2, 0); put(runE, box(CD + 0.04, 0.05, 3.36, M.counter), 0, CH, 0);
    for (let i = 0; i < 4; i++) put(runE, box(0.02, CH - 0.18, 0.76, M.woodMid), -CD / 2 - 0.005, (CH - 0.1) / 2, -1.2 + i * 0.8);
    runE.position.set(8.7, 0, 1.85); colliderAt(8.7, 1.85, CD + 0.06, 3.35, CH + 0.05);

    const hob = group(); put(hob, box(0.52, 0.02, 0.52, M.black), 0, 0.012, 0);
    for (const [hx, hz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) put(hob, cyl(0.075, 0.075, 0.014, 16, M.steel), hx, 0.024, hz);
    hob.position.set(8.7, CH + 0.03, 1.6);
    put(scene, box(0.02, 0.5, 0.56, M.screen), 8.38, 0.55, 1.6); put(scene, box(0.03, 0.04, 0.5, M.chrome), 8.37, 0.85, 1.6);
    const hood = group(); put(hood, box(0.55, 0.12, 0.55, M.steel), 0, 0, 0); put(hood, box(0.3, 0.55, 0.3, M.steel), 0, 0.33, 0); hood.position.set(8.7, 1.95, 1.6);

    const up = group(); put(up, box(0.35, 0.72, 3.3, M.white), 0, 0, 0);
    for (let i = 0; i < 4; i++) put(up, box(0.02, 0.64, 0.76, M.woodMid), -0.18, 0, -1.2 + i * 0.8);
    put(up, box(0.02, 0.64, 0.76, M.woodMid), 0.18, 0, -1.2); up.position.set(8.83, 1.88, 1.85);

    const fr = group();
    put(fr, box(0.62, 1.85, 0.62, M.steel), 0, 0.93, 0);
    for (const y of [1.35, 0.58]) { put(fr, box(0.02, 0.72, 0.6, M.chrome), -0.32, y, 0); put(fr, box(0.04, 0.5, 0.03, M.chrome), -0.33, y, 0.2); }
    fr.position.set(8.68, 0, 3.82); colliderAt(8.68, 3.82, 0.68, 0.68, 1.9);

    const isl = group();
    put(isl, box(1.6, CH - 0.1, 0.72, M.woodDark), 0, (CH - 0.1) / 2, 0); put(isl, box(1.7, 0.06, 0.82, M.counter), 0, CH, 0); put(isl, box(1.5, 0.02, 0.62, M.woodMid), 0, 0.1, 0);
    isl.position.set(6.6, 0, 2.35); colliderAt(6.6, 2.35, 1.72, 0.86, CH + 0.06);

    for (const sx of [-0.42, 0.42]) {
      const st = group();
      put(st, cyl(0.19, 0.19, 0.06, 16, M.woodMid), 0, 0.66, 0); put(st, cyl(0.03, 0.03, 0.62, 8, M.black), 0, 0.33, 0); put(st, cyl(0.18, 0.2, 0.03, 16, M.black), 0, 0.02, 0);
      st.position.set(6.6 + sx, 0, 3.0);
      addSeat("sit", "SIT", 6.6 + sx, 3.0, Math.PI, 0.68);   /* faces the island */
    }
    put(scene, cyl(0.07, 0.09, 0.2, 12, M.steel), 6.1, CH + 0.13, 0.32);
    put(scene, box(0.32, 0.02, 0.22, M.woodMid), 7.9, CH + 0.04, 0.34);
    put(scene, cyl(0.1, 0.13, 0.07, 14, M.white), 8.7, CH + 0.06, 0.55);

    addUse("cook", "COOK", 8.0, 1.6); addUse("fridge", "OPEN FRIDGE", 8.1, 3.6); addUse("sink", "USE SINK", 7.0, 0.95);
    addCeilingLight(7.2, 2.1);
  })();

  /* ---------- bedroom ---------- */
  (function bedroom() {
    rug(2.6, 5.7, 2.6, 2.2, S({ map: TEX_RUG, color: 0xc8bfae, roughness: 1 }));
    const b = group();
    put(b, box(2.05, 0.28, 1.65, M.woodDark), 0, 0.16, 0); put(b, box(1.95, 0.22, 1.55, M.bedding), 0.03, 0.41, 0);
    put(b, box(1.5, 0.1, 1.6, M.fabricCream), 0.35, 0.55, 0); put(b, box(0.5, 0.05, 1.6, M.fabricBlue), 1.0, 0.53, 0);
    for (const pz of [-0.4, 0.4]) put(b, box(0.42, 0.14, 0.62, M.white), -0.72, 0.6, pz);
    put(b, box(0.12, 1.05, 1.72, M.fabricGrey), -1.0, 0.55, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(b, box(0.06, 0.16, 0.06, M.woodDark), sx * 0.98, 0.08, sz * 0.76);
    b.position.set(1.15, 0, 5.72); colliderAt(1.15, 5.72, 2.2, 1.75, 0.65);
    addSeat("lie", "LIE DOWN", 1.35, 5.72, Math.PI / 2, 0.74);

    for (const nz of [4.62, 6.82]) {
      const n = group();
      put(n, box(0.45, 0.5, 0.45, M.woodMid), 0, 0.25, 0); put(n, box(0.4, 0.02, 0.02, M.chrome), 0, 0.32, 0.23);
      put(n, cyl(0.09, 0.12, 0.05, 12, M.black), 0, 0.53, 0); put(n, cyl(0.015, 0.015, 0.24, 8, M.black), 0, 0.65, 0); put(n, cyl(0.11, 0.075, 0.16, 14, M.lamp), 0, 0.83, 0);
      n.position.set(2.42, 0, nz); colliderAt(2.42, nz, 0.5, 0.5, 0.95);
    }
    const w = group();
    put(w, box(0.58, 2.2, 2.0, M.white), 0, 1.1, 0);
    put(w, box(0.03, 2.12, 0.96, M.woodMid), -0.3, 1.1, -0.5); put(w, box(0.03, 2.12, 0.96, M.woodMid), -0.3, 1.1, 0.5);
    put(w, box(0.04, 0.5, 0.02, M.chrome), -0.32, 1.15, -0.04); put(w, box(0.04, 0.5, 0.02, M.chrome), -0.32, 1.15, 0.04);
    w.position.set(4.28, 0, 5.4); colliderAt(4.28, 5.4, 0.62, 2.05, 2.2);
    const art = group(); put(art, box(0.04, 0.52, 1.1, M.art1), 0, 0, 0); put(art, box(0.05, 0.42, 0.98, M.art3), 0.01, 0, 0); art.position.set(0.09, 1.75, 5.72);
    addCeilingLight(2.3, 5.7);
  })();

  /* ---------- bathroom ---------- */
  (function bathroom() {
    const tileMat = tiled(TEX_TILE, 3, 1.2);
    const panel = (cx, cz, w, d) => { const m = box(w, 1.25, d, tileMat); m.position.set(cx, 0.625, cz); m.castShadow = false; root.add(m); };
    panel(4.66, 5.6, 0.03, 2.75); panel(7.14, 5.6, 0.03, 2.75); panel(5.9, 6.94, 2.55, 0.03); panel(5.9, 4.26, 2.55, 0.03);
    const t = group();
    put(t, box(0.36, 0.42, 0.24, M.white), 0, 0.55, -0.2); put(t, cyl(0.19, 0.15, 0.4, 18, M.white), 0, 0.26, 0.1);
    put(t, box(0.36, 0.1, 0.5, M.white), 0, 0.46, 0.08); put(t, box(0.38, 0.04, 0.46, M.steel), 0, 0.52, 0.1); put(t, cyl(0.03, 0.03, 0.03, 10, M.chrome), 0, 0.78, -0.22);
    t.position.set(5.3, 0, 6.6); colliderAt(5.3, 6.6, 0.5, 0.72, 0.9);
    addSeat("toilet", "USE TOILET", 5.3, 6.45, Math.PI, 0.48);

    const v = group();
    put(v, box(0.5, 0.8, 0.85, M.woodDark), 0, 0.4, 0); put(v, box(0.54, 0.05, 0.89, M.counter), 0, 0.83, 0);
    put(v, cyl(0.17, 0.14, 0.13, 18, M.white), 0, 0.91, 0); put(v, cyl(0.018, 0.018, 0.22, 8, M.chrome), 0.19, 0.96, 0);
    v.position.set(4.92, 0, 5.05); colliderAt(4.92, 5.05, 0.56, 0.9, 1.0);
    const mir = box(0.03, 0.72, 0.75, M.mirror); mir.position.set(4.68, 1.6, 5.05); mir.castShadow = false; root.add(mir);

    const sh = group();
    put(sh, box(0.95, 0.06, 0.95, M.white), 0, 0.03, 0);
    const g1 = box(0.02, 1.95, 0.95, M.glass); g1.position.set(0.47, 1.0, 0);
    const g2 = box(0.95, 1.95, 0.02, M.glass); g2.position.set(0, 1.0, 0.47); g1.castShadow = g2.castShadow = false; sh.add(g1, g2);
    put(sh, cyl(0.02, 0.02, 0.3, 8, M.chrome), 0.35, 2.1, -0.35); put(sh, cyl(0.11, 0.09, 0.03, 14, M.chrome), 0.35, 1.98, -0.25);
    sh.position.set(6.5, 0, 4.72); colliderAt(6.5, 4.72, 0.98, 0.98, 2.0);

    put(scene, box(0.03, 0.03, 0.6, M.chrome), 7.12, 1.35, 6.1); put(scene, box(0.06, 0.5, 0.45, M.fabricBlue), 7.06, 1.1, 6.1);
    rug(5.6, 5.9, 0.7, 0.5, S({ color: 0xd8e2ea, roughness: 1 }));
    addCeilingLight(5.9, 5.6, 0.6);
  })();

  /* ---------- hall ---------- */
  (function hall() {
    rug(8.1, 5.7, 0.8, 1.9, S({ color: 0x6d6a63, roughness: 1 }));
    const sc = group();
    put(sc, box(0.36, 1.0, 0.9, M.woodMid), 0, 0.5, 0); put(sc, box(0.04, 0.86, 0.42, M.woodDark), -0.19, 0.5, -0.22); put(sc, box(0.04, 0.86, 0.42, M.woodDark), -0.19, 0.5, 0.22);
    put(sc, box(0.02, 0.03, 0.1, M.chrome), -0.21, 0.75, -0.24); put(sc, box(0.02, 0.03, 0.1, M.chrome), -0.21, 0.75, 0.24);
    put(sc, cyl(0.08, 0.1, 0.14, 12, M.pot), 0, 1.07, 0); put(sc, cyl(0.09, 0.05, 0.22, 8, M.leaf), 0, 1.24, 0);
    sc.position.set(8.76, 0, 6.55); colliderAt(8.76, 6.55, 0.42, 0.96, 1.35);
    put(scene, box(0.05, 0.06, 0.7, M.woodDark), 7.24, 1.65, 4.9);
    for (let i = 0; i < 3; i++) put(scene, cyl(0.012, 0.012, 0.08, 6, M.chrome), 7.29, 1.6, 4.68 + i * 0.22);
    const m2 = box(0.03, 0.9, 0.55, M.mirror); m2.position.set(7.24, 1.55, 5.9); m2.rotation.y = Math.PI / 2; m2.castShadow = false; root.add(m2);
    addCeilingLight(8.1, 5.6, 0.6);
  })();

  /* ---------- lighting ---------- */
  root.add(new THREE.HemisphereLight(0xdfe9ff, 0x3a2f28, 1.5));
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
  sun.position.set(11 * K, 10 * K, -5 * K); sun.target.position.set(4.5 * K, 0, 3.5 * K);
  sun.castShadow = !LOWQ;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8 * K, right: 8 * K, top: 8 * K, bottom: -8 * K, near: 1, far: 32 * K });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  /* ---------- game glue ---------- */
  for (const c of colliders) { c.minX *= K; c.maxX *= K; c.minZ *= K; c.maxZ *= K; c.y1 *= K; }
  for (const o of seats) { o.x *= K; o.z *= K; o.h *= K; }
  for (const o of uses) { o.x *= K; o.z *= K; o.r *= K; }
  const world = {
    colliders, seats, uses, stairs: [], platforms: [], levelHeight: () => 0,
    ceilingHeight: WALL_H * K,
    bounds: { minX: 0.3 * K, maxX: 8.7 * K, minZ: 0.3 * K, maxZ: 6.7 * K },
  };
  const ctl = new ThirdPersonControls(camera, renderer.domElement, world, {
    scene, x: 8.2 * K, z: 5.55 * K, yaw: -Math.PI / 2, level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  return {
    three: scene, camera, controls: { update: () => {} },
    crumb: meta.sub, title: "1-BEDROOM FLAT", subtitle: "WALK · SIT · CARRY",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: SIT / USE",
    isInterior: true, sceneId: "myhouse", getExteriorSceneId: () => "myhouse",
    update: (dt) => { ctl.update(dt); },
    dispose: () => ctl.dispose(),
  };
}
