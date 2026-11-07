/* airplane/interior.js — Boeing 787 Dreamliner walkable interior.
   Sections (front→back along -z axis):
     Cockpit (z=-18..-14), First Class (z=-14..-6, 4 suites),
     Business Class (z=-6..4, 3 rows × 2), Galley A (z=4..6),
     Economy (z=6..26, 12 rows × 3+3), Galley B (z=26..28),
     Lavatories (z=28..30 rear).
   Uses ThirdPersonControls pattern. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { createPlaneNPCs } from "../../core/plane-npcs.js";

export async function buildInterior(router) {

  /* ── SCENE ── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ab8e8);
  scene.fog = new THREE.Fog(0x8ab8e8, 55, 140);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.06, 220);
  camera.rotation.order = "YXZ";

  /* ── LIGHTING ── */
  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x4a5870, 1.0));
  const sun = new THREE.DirectionalLight(0xfff8ee, 1.1);
  sun.position.set(10, 30, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 40;   sun.shadow.camera.bottom = -40;
  scene.add(sun);

  // Cabin ambient strip lights (LED ceiling strips)
  [-10, 0, 10, 20].forEach(z => {
    const pl = new THREE.PointLight(0xeef4ff, 0.8, 20, 2);
    pl.position.set(0, 3.2, z); scene.add(pl);
  });
  // Window ambient glow
  const wl = new THREE.PointLight(0xc8e4ff, 0.5, 12, 2);
  wl.position.set(-3.6, 1.8, 10); scene.add(wl);
  const wl2 = wl.clone(); wl2.position.set(3.6, 1.8, 10); scene.add(wl2);
  // Cockpit blue glow
  const cockL = new THREE.PointLight(0x3080d0, 1.2, 10, 2);
  cockL.position.set(0, 2.0, -16); scene.add(cockL);

  /* ── HELPERS ── */
  const BOXG = new THREE.BoxGeometry(1, 1, 1);
  const CYLG = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const MC = new Map();

  function mat(c, o) {
    if (o && o.map) return new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
    const k = c + "|" + JSON.stringify(o || 0);
    let m = MC.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); MC.set(k, m); }
    return m;
  }
  const glow = c => new THREE.MeshBasicMaterial({ color: c });

  const world = new THREE.Group(); scene.add(world);
  const solid = [], seats = [], uses = [];

  function box(w, h, d, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(BOXG, typeof m === "number" ? mat(m) : m);
    s.scale.set(w, h, d); s.position.set(x, y, z);
    s.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    s.castShadow = true; s.receiveShadow = true;
    world.add(s);
    if (o.solid) {
      const c = Math.abs(Math.cos(o.ry || 0)), n = Math.abs(Math.sin(o.ry || 0));
      solid.push({ x, z, hw: (c * w + n * d) / 2, hd: (n * w + c * d) / 2 });
    }
    return s;
  }
  function cyl(r, h, x, y, z, m) {
    const s = new THREE.Mesh(CYLG, typeof m === "number" ? mat(m) : m);
    s.scale.set(r * 2, h, r * 2); s.position.set(x, y, z);
    s.castShadow = true; world.add(s);
    return s;
  }

  /* ── TUBE GEOMETRY ──
     The fuselage is oval: ~6m wide, ~4m tall interior.
     We build a simplified rectangular cross-section with curved suggests.
     Aisle width: 0.9m.  Seat pitch varies per class. */

  const CW  = 6.0;   // cabin width
  const CH  = 3.8;   // cabin height
  const W_T = 0.18;  // wall thickness

  // ─── FLOOR ───
  // Single continuous floor panel
  box(CW, 0.14, 50, 0, 0.07, 6, mat(0xd8d0c0));   // Economy + galley
  box(CW, 0.14, 20, 0, 0.07, -8, mat(0xc0b8a8));  // First + Business
  box(CW, 0.14, 5, 0, 0.07, -17.5, mat(0x606468));// Cockpit

  // ─── FUSELAGE WALLS ───
  // Left wall (x=-3)
  box(W_T, CH, 52, -3, CH/2, 5, mat(0xe4e8ec));
  // Right wall (x=3)
  box(W_T, CH, 52,  3, CH/2, 5, mat(0xe4e8ec));
  // Nose wall (cockpit front, z=-20)
  box(CW, CH, W_T, 0, CH/2, -20, mat(0x5a5e62), { solid: true });
  // Tail wall (z=31)
  box(CW, CH, W_T, 0, CH/2, 31, mat(0xa8aab0), { solid: true });
  // Cockpit divider (z=-14) - door at centre
  box(2.2, CH, W_T, -2.15, CH/2, -14, mat(0x5a5e62), { solid: true });
  box(2.2, CH, W_T,  2.15, CH/2, -14, mat(0x5a5e62), { solid: true });
  // F-class / Business divider (z=-6) - galley curtain represented as thin wall
  box(2.2, CH, W_T, -2.15, CH/2, -6, mat(0xc0bcb4), { solid: true });
  box(2.2, CH, W_T,  2.15, CH/2, -6, mat(0xc0bcb4), { solid: true });
  // Galley A divider (z=4 and z=6)
  box(CW, CH, W_T, 0, CH/2, 4, mat(0xa8aaae), { solid: true });
  box(CW, CH, W_T, 0, CH/2, 6, mat(0xa8aaae), { solid: true });
  // Galley B divider (z=26 and z=28)
  box(CW, CH, W_T, 0, CH/2, 26, mat(0xa8aaae), { solid: true });
  box(CW, CH, W_T, 0, CH/2, 28, mat(0xa8aaae), { solid: true });

  // ─── CEILING ───
  box(CW, 0.14, 55, 0, CH + 0.07, 5.5, mat(0xf4f2ee));
  box(CW, 0.14, 6, 0, CH + 0.07, -17, mat(0x5a5e62));

  // LED strip lights along ceiling
  for (let z = -12; z < 29; z += 4) {
    box(5.6, 0.04, 0.1, 0, CH - 0.05, z, glow(0xeef4ff));
  }

  // ─── OVERHEAD BINS ───
  // Left side bins
  for (let z = 6; z < 27; z += 1.65) {
    box(0.8, 0.5, 1.55, -2.5, 2.75, z + 0.7, mat(0xdad6d0), { solid: true });
  }
  // Right side bins
  for (let z = 6; z < 27; z += 1.65) {
    box(0.8, 0.5, 1.55, 2.5, 2.75, z + 0.7, mat(0xdad6d0), { solid: true });
  }
  // First class / business bins
  for (let z = -13; z < 4; z += 2.2) {
    box(0.7, 0.55, 2.0, -2.5, 2.75, z + 0.85, mat(0xcecac2), { solid: true });
    box(0.7, 0.55, 2.0,  2.5, 2.75, z + 0.85, mat(0xcecac2), { solid: true });
  }

  // ─── WINDOWS ───
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xa8d8f4, transparent: true, opacity: 0.6 });
  for (let z = -12; z < 28; z += 2.2) {
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.36), glassMat);
    wl.position.set(-3.08, 1.4, z); world.add(wl);
    const wr = wl.clone(); wr.position.x = 3.08; world.add(wr);
    // Window surround
    box(0.06, 0.54, 0.44, -3.04, 1.4, z, mat(0xdad6d0));
    box(0.06, 0.54, 0.44,  3.04, 1.4, z, mat(0xdad6d0));
  }

  /* ─── COCKPIT (z=-20..-14) ─── */
  // Instrument panel
  box(4.0, 1.2, 0.5, 0, 1.0, -19.4, mat(0x2a2e32), { solid: true });
  box(4.0, 0.06, 0.55, 0, 1.62, -19.4, mat(0x3a3e42));
  // Screens
  const screenCols = [0x1a3a6a, 0x1a4a2a, 0x2a3a1a, 0x3a2a1a, 0x1a3a6a];
  for (let i = 0; i < 5; i++) {
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.52, 0.02), new THREE.MeshBasicMaterial({ color: screenCols[i] }));
    scr.position.set(-1.7 + i * 0.84, 1.35, -19.17); world.add(scr);
  }
  // Overhead panel
  box(4.0, 0.6, 0.6, 0, 3.3, -19, mat(0x2a2e32), { solid: true });
  // Pilot seats
  function pilotSeat(x) {
    box(0.62, 0.50, 0.62, x, 0.25, -17.5, mat(0x1a1e22), { solid: true });
    box(0.62, 1.1, 0.1, x, 1.00, -17.2, mat(0x1a1e22));  /* backrest behind pilot (+Z) */
    cyl(0.06, 0.44, x - 0.28, 0.1, -17.5, mat(0x2a2e32));
    cyl(0.06, 0.44, x + 0.28, 0.1, -17.5, mat(0x2a2e32));
    seats.push({ type: "sit", label: "PILOT SEAT", x, z: -17.5, yaw: Math.PI, h: 0.50, level: 0, taken: false });
  }
  pilotSeat(-0.85); pilotSeat(0.85);
  uses.push({ kind: "use", label: "FLY AIRCRAFT", x: 0, z: -18.8, y: 0, level: 0, r: 2.2 });

  // Yoke (steering column)
  cyl(0.04, 0.6, -0.85, 0.74, -18.8, mat(0x3a3e42));
  box(0.55, 0.06, 0.1, -0.85, 1.06, -18.8, mat(0x2a2e32));
  cyl(0.04, 0.6,  0.85, 0.74, -18.8, mat(0x3a3e42));
  box(0.55, 0.06, 0.1,  0.85, 1.06, -18.8, mat(0x2a2e32));

  // Centre console
  box(0.6, 0.75, 1.0, 0, 0.37, -18.2, mat(0x2a2e32), { solid: true });
  for (let i = 0; i < 6; i++) box(0.08, 0.08, 0.08, -0.22 + (i % 3) * 0.22, 0.78, -18.6 + Math.floor(i / 3) * 0.28, glow([0xff5533, 0xffcc33, 0x33cc55, 0x3399ff, 0xff8833, 0xcc33ff][i]));

  /* ─── FIRST CLASS (z=-14..-6) — 4 suites × 2 sides ─── */
  const fcSeatColor = mat(0x3a2a48);
  const fcPrivColor = mat(0x4a3a58);

  function firstClassSuite(x, z, facingZ) {
    // Suite pod shell
    const wall = mat(0xc8c4bc);
    box(1.5, 0.40, 0.7, x, 0.34, z, fcSeatColor, { solid: true });  // seat base (top 0.54)
    box(1.5, 1.1, 0.1, x, 1.0, z - Math.sign(facingZ - z) * 0.35, fcSeatColor);
    // Side table
    box(0.42, 0.06, 0.42, x + (x < 0 ? -0.85 : 0.85), 0.62, z, mat(0xa8a0a0), { solid: true });
    // Personal screen
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.02), new THREE.MeshBasicMaterial({ color: 0x1a2a4a }));
    scr.position.set(x + (x < 0 ? -0.72 : 0.72), 1.35, z); world.add(scr);
    // Pod divider
    box(1.65, 1.4, 0.08, x, 0.7, z + 0.4 * Math.sign(x), wall, { solid: true });

    seats.push({ type: "sit", label: "FIRST CLASS", x, z, yaw: Math.PI, h: 0.54, level: 0, taken: false });
    uses.push({ kind: "watch", label: "IN-FLIGHT ENTERTAINMENT", x, z: z - Math.sign(facingZ - z) * 1.2, y: 0, level: 0, r: 1.4 });
  }

  // 4 first-class pods per side, facing fwd (facing z=-20)
  [-7.5, -9, -10.5, -12].forEach(z => {
    firstClassSuite(-1.8, z, -20);
    firstClassSuite( 1.8, z, -20);
  });

  /* ─── BUSINESS CLASS (z=-6..4) — 3 rows × 2+2 ─── */
  const bizColor = mat(0x2a3848);
  const bizCush  = mat(0x4a5868);

  function bizSeat(x, z) {
    box(0.55, 0.42, 0.5, x, 0.21, z, bizColor, { solid: true });
    box(0.55, 0.85, 0.08, x, 0.75, z + 0.28, bizColor);
    box(0.08, 0.42, 0.5, x - 0.32, 0.55, z, bizColor);
    box(0.08, 0.42, 0.5, x + 0.32, 0.55, z, bizColor);
    box(0.48, 0.14, 0.45, x, 0.49, z - 0.02, bizCush);
    box(0.48, 0.4, 0.08, x, 0.78, z + 0.22, bizCush);
    // Tray table
    box(0.44, 0.04, 0.36, x, 0.9, z - 0.30, mat(0x9aa0a8));
    // Screen
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.02), new THREE.MeshBasicMaterial({ color: 0x1a2a3a }));
    scr.position.set(x, 1.4, z - 0.34); world.add(scr);
    seats.push({ type: "sit", label: "BUSINESS CLASS", x, z, yaw: Math.PI, h: 0.56, level: 0, taken: false });
    uses.push({ kind: "watch", label: "IN-FLIGHT ENTERTAINMENT", x, z: z - 1.2, y: 0, level: 0, r: 1.2 });
  }

  [-4.5, -2.2, 0, 2.2].forEach(z => {
    bizSeat(-2.0, z); bizSeat(-1.0, z);
    bizSeat( 1.0, z); bizSeat( 2.0, z);
  });

  /* ─── GALLEY A (z=4..6) ─── */
  // Service cart bay left
  box(0.7, 1.25, 1.7, -2.6, 0.62, 5, mat(0xa8aaac), { solid: true });
  box(0.68, 0.06, 1.65, -2.6, 1.24, 5, mat(0xc8cacc));
  for (let r = 0; r < 3; r++) box(0.65, 0.04, 1.6, -2.6, 0.25 + r * 0.35, 5, mat(0xb8bab8));
  // Service cart bay right
  box(0.7, 1.25, 1.7, 2.6, 0.62, 5, mat(0xa8aaac), { solid: true });
  // Galley work counter
  box(4.2, 0.88, 0.52, 0, 0.44, 4.5, mat(0x9aa0a4), { solid: true });
  box(4.4, 0.06, 0.56, 0, 0.91, 4.5, mat(0xc8cac8));
  // Overhead galley cabinet
  box(4.2, 0.6, 0.52, 0, 3.1, 4.5, mat(0xb8babc), { solid: true });
  uses.push({ kind: "cook", label: "PREPARE MEAL", x: 0, z: 3.6, y: 0, level: 0, r: 2 });
  // Rolling meal cart
  box(0.42, 1.0, 0.62, -1.2, 0.5, 5, mat(0xc8cac8), { solid: true });
  for (let r = 0; r < 4; r++) box(0.4, 0.04, 0.6, -1.2, 0.15 + r * 0.22, 5, mat(0xaaaaaa));
  cyl(0.04, 0.04, -1.0, 0.02, 4.72, mat(0x666666));
  cyl(0.04, 0.04, -1.4, 0.02, 4.72, mat(0x666666));

  /* ─── ECONOMY CABIN (z=6..26) — 12 rows × 3+3 ─── */
  const ecoColor   = mat(0x4a5060);
  const ecoCush    = mat(0x5a6070);
  const headrestM  = mat(0xf0eeea);

  function ecoSeat(x, z) {
    box(0.44, 0.4, 0.45, x, 0.2, z, ecoColor, { solid: true });
    box(0.44, 0.78, 0.08, x, 0.68, z + 0.24, ecoColor);
    box(0.06, 0.4, 0.45, x - 0.25, 0.52, z, ecoColor);
    box(0.06, 0.4, 0.45, x + 0.25, 0.52, z, ecoColor);
    box(0.4, 0.12, 0.4, x, 0.46, z - 0.02, ecoCush);
    box(0.4, 0.36, 0.07, x, 0.72, z + 0.18, ecoCush);
    box(0.4, 0.18, 0.08, x, 1.02, z + 0.2, headrestM);
    // Tray table (folded)
    box(0.38, 0.03, 0.28, x, 0.84, z - 0.30, mat(0xa0a4a8));
    // Small screen
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.015), new THREE.MeshBasicMaterial({ color: 0x1a2030 }));
    scr.position.set(x, 1.28, z - 0.3); world.add(scr);
    seats.push({ type: "sit", label: "ECONOMY SEAT", x, z: z - 0.04, yaw: Math.PI, h: 0.52, level: 0, taken: false });
  }

  for (let row = 0; row < 12; row++) {
    const z = 7 + row * 1.65;
    ecoSeat(-2.45, z); ecoSeat(-1.62, z); ecoSeat(-0.8, z);
    ecoSeat( 0.8, z);  ecoSeat( 1.62, z); ecoSeat( 2.45, z);
  }

  // Aisle seat armrest markers
  for (let row = 0; row < 12; row++) {
    const z = 7 + row * 1.65;
    uses.push({ kind: "eat", label: "SERVE MEAL", x: 0, z, y: 0, level: 0, r: 0.5 });
  }
  uses.push({ kind: "eat", label: "CABIN SERVICE", x: 0, z: 15, y: 0, level: 0, r: 8 });

  /* ─── GALLEY B (z=26..28) ─── */
  box(4.2, 0.88, 0.52, 0, 0.44, 27.5, mat(0x9aa0a4), { solid: true });
  box(4.4, 0.06, 0.56, 0, 0.91, 27.5, mat(0xc8cac8));
  box(0.7, 1.25, 1.7, -2.6, 0.62, 27, mat(0xa8aaac), { solid: true });
  box(0.7, 1.25, 1.7,  2.6, 0.62, 27, mat(0xa8aaac), { solid: true });
  uses.push({ kind: "cook", label: "REAR GALLEY", x: 0, z: 27, y: 0, level: 0, r: 1.6 });

  /* ─── LAVATORIES (z=28..31) ─── */
  // Left lav
  box(1.8, CH, W_T, -2.1, CH/2, 28, mat(0xa8aaae), { solid: true });
  box(W_T, CH, 2.8, -3, CH/2, 29.4, mat(0xa8aaae), { solid: true });
  box(1.8, CH, W_T, -2.1, CH/2, 31, mat(0xa8aaae), { solid: true });
  // Toilet left
  box(0.42, 0.4, 0.22, -2.5, 0.2, 30.4, mat(0xf6f6f6));
  cyl(0.19, 0.38, -2.5, 0.19, 29.9, mat(0xf6f6f6));
  box(0.38, 0.06, 0.5, -2.5, 0.42, 30.15, mat(0xeaeaea));
  seats.push({ type: "toilet", label: "USE TOILET", x: -2.5, z: 29.9, dx: 0, dz: 1, yaw: 0, h: 0.48, level: 0, taken: false });
  box(0.6, 0.75, 0.42, -2.6, 0.37, 28.7, mat(0xd0d0d0), { solid: true });
  box(0.55, 0.04, 0.4, -2.6, 0.76, 28.7, mat(0xe0e0e0));
  cyl(0.022, 0.22, -2.6, 0.88, 28.55, mat(0xc0c4c8));
  uses.push({ kind: "wash", label: "WASH HANDS", x: -2.6, z: 28.3, y: 0, level: 0, r: 1.2 });

  // Right lav
  box(1.8, CH, W_T,  2.1, CH/2, 28, mat(0xa8aaae), { solid: true });
  box(W_T, CH, 2.8,  3, CH/2, 29.4, mat(0xa8aaae), { solid: true });
  box(1.8, CH, W_T,  2.1, CH/2, 31, mat(0xa8aaae), { solid: true });
  box(0.42, 0.4, 0.22, 2.5, 0.2, 30.4, mat(0xf6f6f6));
  cyl(0.19, 0.38, 2.5, 0.19, 29.9, mat(0xf6f6f6));
  box(0.38, 0.06, 0.5, 2.5, 0.42, 30.15, mat(0xeaeaea));
  seats.push({ type: "toilet", label: "USE TOILET", x: 2.5, z: 29.9, dx: 0, dz: 1, yaw: 0, h: 0.48, level: 0, taken: false });
  box(0.6, 0.75, 0.42, 2.6, 0.37, 28.7, mat(0xd0d0d0), { solid: true });
  box(0.55, 0.04, 0.4, 2.6, 0.76, 28.7, mat(0xe0e0e0));
  cyl(0.022, 0.22, 2.6, 0.88, 28.55, mat(0xc0c4c8));
  uses.push({ kind: "wash", label: "WASH HANDS", x: 2.6, z: 28.3, y: 0, level: 0, r: 1.2 });

  /* ── SPAWN (front, near first class, facing rear) ── */
  const START = { x: 0, z: -4.5, yaw: 0 };

  /* ── COLLIDERS ── */
  const colliders = [];
  for (const b of solid) {
    colliders.push({
      minX: b.x - b.hw, maxX: b.x + b.hw,
      minZ: b.z - b.hd, maxZ: b.z + b.hd,
      y0: 0, y1: CH, level: 0,
    });
  }
  // Add fuselage walls as colliders
  [
    { minX: -3.15, maxX: -2.85, minZ: -20, maxZ: 31 },
    { minX:  2.85, maxX:  3.15, minZ: -20, maxZ: 31 },
  ].forEach(c => colliders.push({ ...c, y0: 0, y1: CH, level: 0 }));

  const __world = {
    colliders, seats, uses,
    stairs: [], platforms: [],
    levelHeight: () => 0.12,
    ceilingHeight: CH,
    bounds: { minX: -3.2, maxX: 3.2, minZ: -20.5, maxZ: 31.5 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene,
    x: START.x, z: START.z, yaw: START.yaw, level: 0,
    speedMult: 1.0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  /* Wandering passengers/crew: walk the aisles, turn when blocked */
  const planeNPCs = createPlaneNPCs({
    scene,
    floorY: 0.12,
    colliders,
    bounds: __world.bounds,
    spawn: [
      { minX: -0.45, maxX: 0.45, minZ: -13, maxZ: 27 },
    ],
    count: 8,
    getPlayer: () => ({ x: ctl.pos.x, z: ctl.pos.z }),
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "AIRPLANE",
    title: "BOEING 787",
    subtitle: "LANDED AIRCRAFT",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "airplane",
    update: (dt) => { ctl.update(dt); planeNPCs.update(dt); },
    dispose: () => { planeNPCs.dispose(); ctl.dispose(); },
  };
}

