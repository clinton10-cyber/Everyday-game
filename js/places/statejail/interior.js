/* statejail/interior.js — State Jail · redesigned architecture pass */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";

const W = 26, D = 36;
const X0 = -W / 2, X1 = W / 2;
const Z0 = -D / 2, Z1 = D / 2;
const WH = 4.5, WH2 = 9.0;
const CELL_X = 5;
const CELL_Z = 4;
const CELL_ZC = [-6, -2, 2, 6];
const CELL_FRONT_W = -8, CELL_FRONT_E = 8;

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.fog = new THREE.Fog(0x0a0c10, 55, 160);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.06, 300);
  camera.rotation.order = "YXZ";

  /* ── lighting ── */
  scene.add(new THREE.HemisphereLight(0xd0d8e0, 0x181820, 0.85));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const sun = new THREE.DirectionalLight(0xf0f4ff, 0.5);
  sun.position.set(15, 40, 20); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8090a0, 0.3);
  fill.position.set(-15, 20, -20); scene.add(fill);

  // task lights at key areas
  const areaLights = [
    [0, 6.5, 0, 0xffe8d0, 0.55, 18],       // atrium center
    [-10, 6.0, -12, 0xffe0c0, 0.4, 14],    // mess hall
    [0, 6.0, -8, 0xffe0c0, 0.35, 12],      // mess entrance
    [-7, 6.5, 12, 0xe8f0ff, 0.4, 12],      // intake
    [7, 6.5, 12, 0xf0f8ff, 0.4, 12],       // medical
    [0, 3.2, 16, 0xffe8d0, 0.35, 10],      // sally port
    [-6.5, 6.5, 0, 0xffd8c0, 0.28, 10],    // W catwalk glow
    [6.5, 6.5, 0, 0xffd8c0, 0.28, 10],     // E catwalk glow
  ];
  for (const [x, y, z, c, i, d] of areaLights) {
    const p = new THREE.PointLight(c, i, d, 2);
    p.position.set(x, y, z); scene.add(p);
  }
  const emRed = new THREE.PointLight(0xff2830, 0.3, 14, 2);
  emRed.position.set(0, 3.4, 0); scene.add(emRed);

  /* ── materials — warmer industrial palette ── */
  const MAT = {
    wall:     new THREE.MeshLambertMaterial({ color: 0xa8a298 }),
    cellWall: new THREE.MeshLambertMaterial({ color: 0xb4b4ac }),
    concrete: new THREE.MeshLambertMaterial({ color: 0x8a8680 }),
    ceil:     new THREE.MeshLambertMaterial({ color: 0x54565c }),
    steel:    new THREE.MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.35, metalness: 0.85 }),
    steelDk:  new THREE.MeshStandardMaterial({ color: 0x42464c, roughness: 0.55, metalness: 0.7 }),
    bar:      new THREE.MeshStandardMaterial({ color: 0x848a92, roughness: 0.4, metalness: 0.8 }),
    dark:     new THREE.MeshLambertMaterial({ color: 0x2a2c30 }),
    black:    new THREE.MeshLambertMaterial({ color: 0x0e1012 }),
    white:    new THREE.MeshLambertMaterial({ color: 0xdadcd8 }),
    cream:    new THREE.MeshLambertMaterial({ color: 0xc8c4b8 }),
    mattress: new THREE.MeshLambertMaterial({ color: 0x5a6070 }),
    orange:   new THREE.MeshLambertMaterial({ color: 0xd07228 }),
    bench:    new THREE.MeshLambertMaterial({ color: 0x6a6e74 }),
    wood:     new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.75 }),
    glass:    new THREE.MeshStandardMaterial({ color: 0xa0c0d8, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
    glow:     new THREE.MeshBasicMaterial({ color: 0xeef4ff }),
    warn:     new THREE.MeshLambertMaterial({ color: 0xd4a020 }),
    red:      new THREE.MeshLambertMaterial({ color: 0xa02020 }),
    green:    new THREE.MeshBasicMaterial({ color: 0x50e070 }),
    screen:   new THREE.MeshBasicMaterial({ color: 0x4ab8d0 }),
    monitor:  new THREE.MeshBasicMaterial({ color: 0x1a3a5a }),
    emRed:    new THREE.MeshBasicMaterial({ color: 0xff2828 }),
    pipe:     new THREE.MeshStandardMaterial({ color: 0x6a6e78, roughness: 0.5, metalness: 0.6 }),
    floor:    new THREE.MeshLambertMaterial({ color: 0x6a6862 }),
    cellFloor:new THREE.MeshLambertMaterial({ color: 0x7a7a72 }),
    messFloor:new THREE.MeshLambertMaterial({ color: 0x5a5c5e }),
    medFloor: new THREE.MeshLambertMaterial({ color: 0x8a8e90 }),
  };

  /* ── batching ── */
  const BUCKETS = new Map();
  const push = (geo, m) => {
    let a = BUCKETS.get(m);
    if (!a) { a = []; BUCKETS.set(m, a); }
    a.push(geo);
  };
  const B = (w, h, d, x, y, z, m, ry) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    push(g, m);
  };
  const C = (rt, rb, h, seg, x, y, z, m, rx, rz) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    push(g, m);
  };
  const S = (r, x, y, z, m, seg = 10) => {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));
    g.translate(x, y, z);
    push(g, m);
  };

  /* ── registries ── */
  const colliders = [], seats = [], uses = [], doors = [];

  function addColBox(x, z, hw, hd, y0, y1, level) {
    colliders.push({
      minX: x - hw, maxX: x + hw,
      minZ: z - hd, maxZ: z + hd,
      y0: y0 ?? 0, y1: y1 ?? WH2,
      level: level ?? 0,
    });
  }
  function addSeat(type, label, x, z, yaw, h, level) {
    const lv = level ?? 0;
    seats.push({ type, label, x, z, yaw: yaw || 0, h: h + lv * WH, level: lv, taken: false });
  }
  function addUse(kind, label, x, z, r, level, data) {
    const lv = level ?? 0;
    uses.push({ kind, label, x, z, y: lv * WH, r: r || 1.8, level: lv, data: data || null });
  }

  /* ── canvas sign ── */
  function sign3d(text, x, y, z, w, h, ry, bg, fg) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = Math.round(512 * h / w);
    const g = c.getContext("2d");
    g.fillStyle = bg || "#2a2c30"; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 6;
    g.strokeRect(6, 6, c.width - 12, c.height - 12);
    g.fillStyle = fg || "#e8e8e8";
    g.font = "bold " + Math.round(c.height * 0.42) + "px Arial,sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, c.width / 2, c.height / 2 + 2, c.width - 30);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.rotation.y = ry || 0;
    scene.add(m);
  }

  /* ── walls with door gaps ── */
  // Return wall spans after clipping and merging door openings to the wall bounds.
  // This prevents overlapping/out-of-range door loops from creating slivers or holes.
  function wallSpans(start, end, doors_) {
    const openings = (doors_ || [])
      .filter(d => Number.isFinite(d.at) && Number.isFinite(d.w) && d.w > 0)
      .map(d => [Math.max(start, d.at - d.w / 2), Math.min(end, d.at + d.w / 2)])
      .filter(([a, b]) => b - a > 0.02)
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const span of openings) {
      const last = merged[merged.length - 1];
      if (last && span[0] <= last[1] + 0.02) last[1] = Math.max(last[1], span[1]);
      else merged.push(span.slice());
    }
    const spans = [];
    let cursor = start;
    for (const [a, b] of merged) {
      if (a > cursor + 0.02) spans.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (end > cursor + 0.02) spans.push([cursor, end]);
    return spans;
  }
  function wallX(z, xa, xb, doors_, m, h) {
    h = h || WH;
    for (const [a, b] of wallSpans(xa, xb, doors_)) {
      const width = b - a;
      B(width, h, 0.2, (a + b) / 2, h / 2, z, m || MAT.wall);
      addColBox((a + b) / 2, z, width / 2, 0.1, 0, h, 0);
      if (h > WH) addColBox((a + b) / 2, z, width / 2, 0.1, 0, h, 1);
    }
    for (const d of (doors_ || [])) if (h - 2.4 > 0 && d.w > 0)
      B(Math.min(d.w, xb - xa), h - 2.4, 0.2, Math.max(xa, Math.min(xb, d.at)), (h + 2.4) / 2, z, m || MAT.wall);
  }
  function wallZ(x, za, zb, doors_, m, h) {
    h = h || WH;
    for (const [a, b] of wallSpans(za, zb, doors_)) {
      const depth = b - a;
      B(0.2, h, depth, x, h / 2, (a + b) / 2, m || MAT.wall);
      addColBox(x, (a + b) / 2, 0.1, depth / 2, 0, h, 0);
      if (h > WH) addColBox(x, (a + b) / 2, 0.1, depth / 2, 0, h, 1);
    }
    for (const d of (doors_ || [])) if (h - 2.4 > 0 && d.w > 0)
      B(0.2, h - 2.4, Math.min(d.w, zb - za), x, (h + 2.4) / 2, Math.max(za, Math.min(zb, d.at)), m || MAT.wall);
  }
  function slab(x0, z0, x1, z1, m, y) {
    B(x1 - x0, 0.15, z1 - z0, (x0 + x1) / 2, (y ?? 0) + 0.075, (z0 + z1) / 2, m || MAT.concrete);
  }
  function floorTile(x0, z0, x1, z1, m, y) {
    B(x1 - x0, 0.02, z1 - z0, (x0 + x1) / 2, (y ?? 0) + 0.16, (z0 + z1) / 2, m);
  }

  /* ── furniture ── */
  function chair(x, z, yaw, m) {
    yaw = yaw || 0; m = m || MAT.steelDk;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    B(0.58, 0.1, 0.58, x, 0.5, z, m, yaw);
    B(0.58, 0.6, 0.1, x - 0.26 * sn, 0.82, z - 0.26 * cs, m, yaw);
    C(0.04, 0.04, 0.5, 6, x, 0.25, z, MAT.steel);
    C(0.26, 0.06, 0.06, 8, x, 0.03, z, MAT.steel);
    addColBox(x, z, 0.35, 0.35, 0, 1.0);
    addSeat("sit", "SIT", x, z, yaw, 0.54, 0);
  }
  function bench(x, z, w, ry, m) {
    ry = ry || 0; m = m || MAT.bench;
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const pt = (ox, oz) => ({ x: x + ox * cs + oz * sn, z: z - ox * sn + oz * cs });
    const back = pt(0, -0.22);
    const l1 = pt(-w / 2 + 0.06, 0), l2 = pt(w / 2 - 0.06, 0);
    B(w, 0.14, 0.55, x, 0.45, z, m, ry);
    B(w, 0.5, 0.12, back.x, 0.72, back.z, m, ry);
    B(0.12, 0.45, 0.55, l1.x, 0.22, l1.z, MAT.steel);
    B(0.12, 0.45, 0.55, l2.x, 0.22, l2.z, MAT.steel);
    addColBox(x, z, w / 2, 0.3, 0, 1.0);
    for (const ox of [-w * 0.24, w * 0.24]) {
      const q = pt(ox, 0);
      addSeat("sit", "SIT", q.x, q.z, ry, 0.54, 0);
    }
  }
  function picnicTable(x, z) {
    B(2.6, 0.1, 1.0, x, 0.78, z, MAT.wood);
    for (const sx of [-1.1, 1.1]) for (const sz of [-0.35, 0.35])
      B(0.12, 0.78, 0.12, x + sx, 0.39, z + sz, MAT.steel);
    for (const sz of [-0.85, 0.85]) {
      B(2.4, 0.08, 0.32, x, 0.45, z + sz, MAT.bench);
      for (const sx of [-1.0, 1.0]) B(0.1, 0.45, 0.1, x + sx, 0.22, z + sz, MAT.steel);
    }
    addColBox(x, z, 1.3, 0.5, 0, 0.85);
    for (const sz of [-0.85, 0.85]) {
      const yaw = sz < 0 ? 0 : Math.PI;
      for (const sx of [-0.8, 0, 0.8]) addSeat("sit", "SIT", x + sx, z + sz, yaw, 0.51, 0);
    }
  }
  function pillar(x, z, h) {
    h = h || WH2;
    B(0.55, h, 0.55, x, h / 2, z, MAT.concrete);
    B(0.65, 0.12, 0.65, x, 0.06, z, MAT.concrete);
    B(0.65, 0.10, 0.65, x, h - 0.05, z, MAT.concrete);
    addColBox(x, z, 0.32, 0.32, 0, h);
  }

  /* ── cell furniture ── */
  function cellFurnish(xFront, dir, zc, level) {
    const y0 = level * WH;

    // bed
    const bedLen = 1.90, bedWid = 0.95;
    const bx = xFront + dir * (CELL_X - 0.35 - bedLen / 2);
    const bedZ = zc - 0.75;
    B(bedLen, 0.12, bedWid, bx, y0 + 0.55, bedZ, MAT.steel);
    B(bedLen - 0.06, 0.20, bedWid - 0.06, bx, y0 + 0.71, bedZ, MAT.mattress);
    const headX = bx + dir * (bedLen / 2 - 0.28);
    B(0.42, 0.14, 0.48, headX, y0 + 0.90, bedZ, MAT.white);
    const footX = bx - dir * (bedLen / 2 - 0.55);
    B(0.95, 0.06, bedWid - 0.08, footX, y0 + 0.82, bedZ, MAT.orange);
    const halfL = bedLen / 2 - 0.10;
    const halfW = bedWid / 2 - 0.10;
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      B(0.07, 0.55, 0.07, bx + sx * halfL, y0 + 0.28, bedZ + sz * halfW, MAT.steel);
    addSeat("lie", "LIE DOWN", bx, bedZ, 0, 0.83, level);
    addColBox(bx, bedZ, bedLen / 2 + 0.05, bedWid / 2 + 0.05, y0, y0 + 1.05);

    // toilet
    const toiletX = xFront + dir * (CELL_X - 0.65);
    const toiletZ = zc + 1.55;
    C(0.24, 0.24, 0.42, 10, toiletX, y0 + 0.21, toiletZ, MAT.white);
    B(0.50, 0.28, 0.18, toiletX, y0 + 0.42, toiletZ + 0.18, MAT.white);
    addSeat("toilet", "USE TOILET", toiletX, toiletZ, 0, 0.44, level);

    // sink
    B(0.55, 0.10, 0.35, toiletX, y0 + 0.85, toiletZ - 0.55, MAT.white);
    C(0.045, 0.045, 0.28, 6, toiletX, y0 + 1.00, toiletZ - 0.70, MAT.steel);
    addUse("sink", "WASH", toiletX, toiletZ - 0.55, 1.2, level);

    // stool
    const stoolX = xFront + dir * 1.25;
    const stoolZ = zc - 1.30;
    B(0.38, 0.06, 0.38, stoolX, y0 + 0.45, stoolZ, MAT.wood);
    C(0.04, 0.04, 0.40, 6, stoolX, y0 + 0.22, stoolZ, MAT.steel);
    const stoolYaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    addSeat("sit", "SIT", stoolX, stoolZ, stoolYaw, 0.50, level);
  }

  /* ═══════════════════════════════════════════════════════════════════
     FLOORS + CEILING + PERIMETER
     ═══════════════════════════════════════════════════════════════════ */
  slab(X0, Z0, X1, Z1, MAT.concrete, 0);
  B(W, 0.15, D, 0, WH2 + 0.075, 0, MAT.ceil);

  // floor zoning
  floorTile(X0, -8, X0 + CELL_X, 8, MAT.cellFloor, 0);   // W cell block
  floorTile(X1 - CELL_X, -8, X1, 8, MAT.cellFloor, 0);   // E cell block
  floorTile(X0, Z0, X1, -8, MAT.messFloor, 0);           // mess hall
  floorTile(X0, 8, -2, Z1, MAT.floor, 0);                // intake / booking
  floorTile(-2, 8, 2, Z1, MAT.floor, 0);                 // south access corridor
  floorTile(2, 8, X1, Z1, MAT.medFloor, 0);              // medical

  // perimeter
  B(W, WH2, 0.3, 0, WH2 / 2, Z0, MAT.wall);
  addColBox(0, Z0, W / 2, 0.15, 0, WH2, 0);
  addColBox(0, Z0, W / 2, 0.15, 0, WH2, 1);
  B(0.3, WH2, D, X0, WH2 / 2, 0, MAT.wall);
  addColBox(X0, 0, 0.15, D / 2, 0, WH2, 0);
  addColBox(X0, 0, 0.15, D / 2, 0, WH2, 1);
  B(0.3, WH2, D, X1, WH2 / 2, 0, MAT.wall);
  addColBox(X1, 0, 0.15, D / 2, 0, WH2, 0);
  addColBox(X1, 0, 0.15, D / 2, 0, WH2, 1);

  // SOUTH wall with 4m sally port gap
  wallX(Z1, X0, -2, [], MAT.wall, WH2);
  wallX(Z1, 2, X1, [], MAT.wall, WH2);
  // sally port door frame
  B(4, 2.4, 0.3, 0, 1.2, Z1, MAT.dark);
  addColBox(-1.5, Z1, 0.5, 0.15, 0, WH2, 0);
  addColBox(1.5, Z1, 0.5, 0.15, 0, WH2, 0);
  B(4.2, WH2 - 2.55, 0.3, 0, 2.55 + (WH2 - 2.55) / 2, Z1, MAT.wall);
  // metal detector
  B(0.18, 2.4, 0.18, -1.1, 1.2, 16.5, MAT.steel);
  B(0.18, 2.4, 0.18, 1.1, 1.2, 16.5, MAT.steel);
  B(2.4, 0.18, 0.18, 0, 2.4, 16.5, MAT.steel);
  B(0.14, 0.24, 0.06, -1.1, 2.42, 16.42, MAT.emRed);
  B(0.14, 0.24, 0.06, 1.1, 2.42, 16.42, MAT.emRed);
  addColBox(-1.1, 16.5, 0.12, 0.12, 0, 2.5);
  addColBox(1.1, 16.5, 0.12, 0.12, 0, 2.5);
  // floor safety stripe
  B(4, 0.02, 0.3, 0, 0.16, 16.5, MAT.warn);
  B(4, 0.02, 0.3, 0, 0.16, 17.0, MAT.warn);

  /* ═══════════════════════════════════════════════════════════════════
     INTERIOR WALLS — GROUND
     ═══════════════════════════════════════════════════════════════════ */

  /* z=8 boundary: atrium ←→ intake / corridor / medical (FIXED: no gaps) */
  wallX(8, -8, -2, [{ at: -5, w: 2.0 }], MAT.wall);    // intake door
  wallX(8, -2, 2, [{ at: 0, w: 2.4 }], MAT.wall);      // corridor door
  wallX(8, 2, 8, [{ at: 5, w: 2.0 }], MAT.wall);       // medical door

  /* z=-8 boundary: atrium ←→ mess hall */
  wallX(-8, -8, -2, [{ at: -5, w: 2.4 }], MAT.wall);   // W mess door
  wallX(-8, -2, 2, [{ at: 0, w: 2.4 }], MAT.wall);     // centre mess door
  wallX(-8, 2, 8, [{ at: 5, w: 2.4 }], MAT.wall);      // E mess door

  /* corridor walls — FIXED to close z=15..18 gap */
  wallZ(-2, 8, 17.8, [{ at: 11, w: 2.0 }], MAT.wall);
  wallZ(2, 8, 17.8, [{ at: 11, w: 2.0 }], MAT.wall);

  /* ═══════════════════════════════════════════════════════════════════
     CELL BLOCKS — full-height z-walls + bars + swing doors
     ═══════════════════════════════════════════════════════════════════ */
  function buildCellBlock(side) {
    const xFront = side < 0 ? CELL_FRONT_W : CELL_FRONT_E;
    const xBack  = side < 0 ? X0 : X1;
    const dir = side;

    // interior cell dividers
    const zwalls = [-8, -4, 0, 4, 8];
    for (const zw of zwalls) {
      B(CELL_X, WH2, 0.16, (xFront + xBack) / 2, WH2 / 2, zw, MAT.cellWall);
      addColBox((xFront + xBack) / 2, zw, CELL_X / 2, 0.08, 0, WH2, 0);
      addColBox((xFront + xBack) / 2, zw, CELL_X / 2, 0.08, 0, WH2, 1);
    }

    for (const zc of CELL_ZC) {
      // cell front bars per floor
      for (const yb of [0, WH]) {
        // top & bottom rails
        B(0.12, 0.12, CELL_Z, xFront, yb + 0.35, zc, MAT.bar);
        B(0.12, 0.12, CELL_Z, xFront, yb + WH - 0.35, zc, MAT.bar);
        // vertical bars — skip door gap (zc-0.55..zc+0.55)
        const nB = 10;
        for (let i = 0; i < nB; i++) {
          const bz = zc - CELL_Z / 2 + 0.15 + i * (CELL_Z - 0.3) / (nB - 1);
          if (Math.abs(bz - zc) < 0.58) continue;
          B(0.07, WH - 0.7, 0.07, xFront, yb + (WH - 0.7) / 2 + 0.35, bz, MAT.bar);
        }
        // door posts
        B(0.18, WH - 0.4, 0.18, xFront, yb + (WH - 0.4) / 2 + 0.2, zc - 0.55, MAT.steel);
        B(0.18, WH - 0.4, 0.18, xFront, yb + (WH - 0.4) / 2 + 0.2, zc + 0.55, MAT.steel);

        // colliders: block the gap with a fixed panel if not the animated door slot
        // (the animated door handles zc-0.55..zc+0.55; block the rest)
        addColBox(xFront, zc - CELL_Z / 2 + 1.05, 0.06, CELL_Z / 2 - 1.05,
                  yb, yb + WH - 0.7, yb > 0 ? 1 : 0);
        addColBox(xFront, zc + 1.05, 0.06, 1.05,
                  yb, yb + WH - 0.7, yb > 0 ? 1 : 0);
      }
      cellFurnish(xFront, dir, zc, 0);
      cellFurnish(xFront, dir, zc, 1);

      // per-level swinging door
      for (const level of [0, 1]) {
        const yb = level * WH;
        const grp = new THREE.Group();
        grp.position.set(xFront, yb, zc - 0.55); // hinge
        const dm = (m, sc, ps) => {
          const k = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
          k.scale.set(...sc); k.position.set(...ps); return k;
        };
        // door frame: full height
        grp.add(dm(MAT.steel, [0.1, 0.12, 1.05], [0, 0.35, 0.55]));
        grp.add(dm(MAT.steel, [0.1, 0.12, 1.05], [0, WH - 0.35, 0.55]));
        // vertical bars (fill 0.35..WH-0.35, spanning 0.08..1.02 in z)
        for (let i = 0; i < 6; i++)
          grp.add(dm(MAT.bar, [0.07, WH - 0.82, 0.07], [0, (WH - 0.7) / 2 + 0.35, 0.08 + i * 0.188]));
        // green/red status light at top
        const lightMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.16, 0.16),
          new THREE.MeshBasicMaterial({ color: 0x50e070 })
        );
        grp.add(lightMesh);
        lightMesh.position.set(0.05, WH - 0.55, 0.55);
        scene.add(grp);

        const openAngle = side < 0 ? Math.PI / 2 : -Math.PI / 2; // into atrium
        const col = {
          minX: xFront - 0.10, maxX: xFront + 0.10,
          minZ: zc - 0.55, maxZ: zc + 0.55,
          y0: yb, y1: yb + WH,
          level,
        };
        colliders.push(col);
        doors.push({
          level, xFront, zCenter: zc,
          group: grp, light: lightMesh,
          yBase: yb, openAngle,
          angle: 0, target: 0,
          locked: false, lockedAt: 0,
          col, colOn: true,
        });
      }

      // cell number plaque (level 0 + 1)
      for (const yb of [0, WH]) {
        B(0.55, 0.30, 0.04, xFront, yb + 3.55, zc, MAT.dark);
        B(0.38, 0.18, 0.02, xFront, yb + 3.55, zc + 0.03, MAT.glow);
      }
    }
  }
  buildCellBlock(-1);
  buildCellBlock(1);

  /* ═══════════════════════════════════════════════════════════════════
     STAIRS — in the S void, x=-2..2, z=2..6, ascending north (FIXED)
     ═══════════════════════════════════════════════════════════════════ */
  {
    const NST = 14;
    const dz = 4 / NST;
    const stepH = WH / NST;
    for (let i = 0; i < NST; i++) {
      const z = 6 - i * dz - dz / 2;
      const y = stepH * (i + 0.5);
      B(4, stepH, dz * 0.96, 0, y, z, MAT.concrete);
      B(3.9, 0.03, 0.07, 0, y + stepH / 2 + 0.01, z - dz * 0.44, MAT.warn);
    }
    // side rails
    for (const sx of [-2.05, 2.05]) {
      const ang = Math.atan2(WH, 4);
      const len = Math.hypot(4, WH);
      const rail = new THREE.CylinderGeometry(0.04, 0.04, len, 8);
      // cylinder along Y → rotate to align with (0, WH, 4) direction
      rail.rotateX(Math.PI / 2 - ang);
      rail.translate(sx, WH / 2 + 0.85, 4);
      push(rail, MAT.steel);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const z = 6 - t * 4;
        const y = t * WH + 0.5;
        C(0.04, 0.04, 1.0, 6, sx, y + 0.3, z, MAT.steel);
      }
    }
    // balusters along the sides
    for (const sx of [-2.02, 2.02]) {
      for (let i = 0; i < NST; i++) {
        const z = 6 - i * dz - dz / 2;
        const y = stepH * (i + 0.5);
        B(0.10, y, dz * 0.98, sx, y / 2, z, MAT.concrete);
      }
    }
    addColBox(-2.1, 4, 0.09, 2.05, 0, WH2, 0);
    addColBox(2.1, 4, 0.09, 2.05, 0, WH2, 0);
  }

  /* ═══════════════════════════════════════════════════════════════════
     ATRIUM — pillars, guard desk, tables, details
     ═══════════════════════════════════════════════════════════════════ */
  {
    // structural pillars at bridge corners
    pillar(-5, -2); pillar(5, -2); pillar(-5, 2); pillar(5, 2);

    // main guard desk
    B(3.2, 1.0, 1.2, 0, 0.5, 0, MAT.steel);
    B(3.4, 0.1, 1.35, 0, 1.02, 0, MAT.steelDk);
    addColBox(0, 0, 1.7, 0.65, 0, 1.1);
    for (let i = 0; i < 3; i++) {
      B(0.55, 0.4, 0.05, -0.8 + i * 0.8, 1.5, -0.2, MAT.monitor);
      B(0.06, 0.06, 0.2, -0.8 + i * 0.8, 1.5, 0.05, MAT.dark);
    }
    B(0.24, 0.16, 0.14, 1.0, 1.12, 0.2, MAT.dark);
    chair(0, 0.9, Math.PI, MAT.steelDk);
    B(1.6, 0.9, 0.5, -2.6, 0.45, 0.1, MAT.steelDk);
    B(1.6, 0.9, 0.5,  2.6, 0.45, 0.1, MAT.steelDk);

    // picnic tables at corners
    picnicTable(-3.8, 3.8);
    picnicTable( 3.8, 3.8);
    picnicTable(-3.8, -3.8);
    picnicTable( 3.8, -3.8);

    // benches along cell fronts
    for (const zc of [-6, -2, 2, 6]) {
      bench(CELL_FRONT_W + 1.4, zc, 2.6, Math.PI / 2);
      bench(CELL_FRONT_E - 1.4, zc, 2.6, -Math.PI / 2);
    }

    // floor safety markings around desk & pillars
    B(5, 0.02, 0.15, 0, 0.17, 1.2, MAT.warn);
    B(5, 0.02, 0.15, 0, 0.17, -1.2, MAT.warn);
    for (const px of [-5, 5]) for (const pz of [-2, 2])
      B(1.2, 0.02, 0.15, px, 0.17, pz + 0.8, MAT.warn);

    // wall-mounted emergency lights
    for (const zc of CELL_ZC) {
      for (const xf of [CELL_FRONT_W, CELL_FRONT_E]) {
        B(0.16, 0.5, 0.2, xf, 3.0, zc, MAT.steel);
        B(0.12, 0.42, 0.06, xf + (xf < 0 ? 0.12 : -0.12), 3.0, zc, MAT.emRed);
      }
    }

    // CCTV domes
    for (const [cx, cz] of [[-7.5, -7.5], [7.5, -7.5], [-7.5, 7.5], [7.5, 7.5]]) {
      C(0.15, 0.15, 0.18, 10, cx, WH2 - 0.2, cz, MAT.dark);
      S(0.1, cx, WH2 - 0.32, cz, MAT.black);
    }

    sign3d("CELL BLOCK A", CELL_FRONT_W + 0.3, WH2 - 0.6, 0, 2.0, 0.4, Math.PI / 2, "#2a2c30", "#d8d8d8");
    sign3d("CELL BLOCK B", CELL_FRONT_E - 0.3, WH2 - 0.6, 0, 2.0, 0.4, -Math.PI / 2, "#2a2c30", "#d8d8d8");
    sign3d("MESS HALL →", 0, 2.8, -7.85, 2.4, 0.4, 0, "#2a2c30", "#d8d8d8");
    sign3d("STAIRS", 0, 2.8, 6.5, 1.6, 0.35, 0, "#2a2c30", "#d8d8d8");
  }

  /* ═══════════════════════════════════════════════════════════════════
     MESS HALL
     ═══════════════════════════════════════════════════════════════════ */
  {
    B(12, 1.0, 1.0, 0, 0.5, -16.7, MAT.steel);
    B(12.2, 0.1, 1.15, 0, 1.02, -16.7, MAT.steelDk);
    B(11.8, 0.06, 0.9, 0, 1.08, -16.7, MAT.white);
    B(12, 0.04, 0.04, 0, 1.7, -16.3, MAT.glass);
    B(12, 0.5, 0.03, 0, 1.45, -16.3, MAT.glass);
    addColBox(0, -16.7, 6, 0.55, 0, 1.15);
    addUse("cook", "SERVE FOOD", 0, -15.5, 2.2);
    for (let i = 0; i < 5; i++)
      C(0.28, 0.28, 0.32, 10, -3.6 + i * 1.8, 1.24, -16.7, MAT.steel);

    const tableZs = [-14.2, -11.8, -9.6];
    for (const tz of tableZs) {
      for (const tx of [-8.0, 0, 8.0]) {
        B(3.6, 0.1, 1.0, tx, 0.78, tz, MAT.wood);
        for (const ox of [-1.5, 1.5]) for (const oz of [-0.35, 0.35])
          B(0.12, 0.78, 0.12, tx + ox, 0.39, tz + oz, MAT.steel);
        addColBox(tx, tz, 1.8, 0.5, 0, 0.85);
        bench(tx, tz - 0.85, 3.4, 0);
        bench(tx, tz + 0.85, 3.4, Math.PI);
        B(0.5, 0.04, 0.36, tx - 0.6, 0.84, tz, MAT.red);
        C(0.1, 0.1, 0.12, 8, tx - 0.85, 0.9, tz, MAT.white);
      }
    }

    bench(-11.5, -13, 3.2, Math.PI / 2);
    bench( 11.5, -13, 3.2, -Math.PI / 2);
    B(1.8, 1.2, 0.06, -11.8, 2.0, -9.2, MAT.dark);
    B(1.6, 1.0, 0.02, -11.8, 2.0, -9.18, MAT.screen);
    B(1.8, 1.2, 0.06,  11.8, 2.0, -9.2, MAT.dark);
    B(1.6, 1.0, 0.02,  11.8, 2.0, -9.18, MAT.screen);

    B(W, 0.14, 0.06, 0, 1.3, Z0 + 0.16, MAT.warn);
    B(0.06, 0.14, 8, X0 + 0.16, 1.3, -13, MAT.warn);
    B(0.06, 0.14, 8, X1 - 0.16, 1.3, -13, MAT.warn);

    B(2.0, 2.6, 0.15, -8, 1.3, Z0 + 0.16, MAT.dark);
    B(2.2, 0.14, 0.2, -8, 2.7, Z0 + 0.16, MAT.steel);
    B(1.4, 0.9, 0.05, -8, 2.0, Z0 + 0.24, MAT.screen);

    C(0.28, 0.28, 0.7, 10, -6.5, 0.35, -15.5, MAT.dark);
    C(0.28, 0.28, 0.7, 10,  6.5, 0.35, -15.5, MAT.dark);

    sign3d("MESS HALL", 0, 3.2, -8.15, 3.2, 0.5, Math.PI, "#2a2c30", "#d8d8d8");
  }

  /* ═══════════════════════════════════════════════════════════════════
     INTAKE (W) — enclosed room
     ═══════════════════════════════════════════════════════════════════ */
  {
    B(3.0, 1.0, 1.1, -8, 0.5, 12.5, MAT.steel);
    B(3.2, 0.1, 1.25, -8, 1.02, 12.5, MAT.steelDk);
    B(2.0, 0.85, 0.06, -8, 0.5, 13.1, MAT.dark);
    B(0.5, 0.4, 0.05, -8.8, 1.45, 12.4, MAT.monitor);
    B(0.6, 0.3, 0.05, -7.4, 1.45, 12.4, MAT.monitor);
    addColBox(-8, 12.5, 1.6, 0.6, 0, 1.15);
    addUse("booking", "BOOKING DESK", -8, 14.0, 2.0);
    chair(-8, 11.4, Math.PI, MAT.steelDk);
    chair(-6.5, 11.6, Math.PI * 0.85, MAT.steelDk);

    B(0.9, 1.4, 0.5, -11.5, 0.7, 10.5, MAT.steelDk);
    B(0.9, 1.4, 0.5, -11.5, 0.7, 11.2, MAT.steelDk);
    addColBox(-11.5, 10.85, 0.5, 0.7, 0, 1.5);

    B(0.6, 2.4, 0.08, -12.85, 1.6, 12.5, MAT.cream);
    for (let i = 0; i < 8; i++)
      B(0.4, 0.03, 0.06, -12.85, 0.5 + i * 0.28, 12.5, MAT.dark);

    bench(-10, 16, 3.0, 0);
    bench(-10, 14.2, 2.4, 0);
    for (const vz of [9.5, 11.5, 13.5, 15.5]) bench(-3.5, vz, 2.4, -Math.PI / 2);

    C(0.04, 0.04, 2.0, 6, -12.5, 1.0, 9, MAT.steel);
    for (const [hx, hz] of [[-12.3, 9], [-12.7, 9]]) S(0.06, hx, 1.9, hz, MAT.steel);
    B(1.6, 1.8, 0.5, -12.2, 0.9, 14.5, MAT.steelDk);
    B(0.02, 1.6, 0.45, -12.2, 0.9, 14.5, MAT.dark);
    addColBox(-12.2, 14.5, 0.85, 0.3, 0, 1.9);

    C(0.1, 0.1, 0.5, 8, -3.5, 1.2, 17.8, MAT.red);
    B(0.14, 0.1, 0.14, -3.5, 1.5, 17.8, MAT.dark);
    B(0.8, 0.9, 0.4, -5.5, 0.45, 17.2, MAT.dark);

    sign3d("INTAKE · BOOKING", -8, 3.2, 8.15, 3.4, 0.5, 0, "#2a2c30", "#d8d8d8");
    sign3d("AUTHORIZED PERSONNEL ONLY", -8, 2.8, 17.85, 3.4, 0.4, Math.PI, "#8a1a1a", "#f8f0e0");
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEDICAL (E) — enclosed room
     ═══════════════════════════════════════════════════════════════════ */
  {
    B(1.0, 0.5, 2.2, 8, 0.25, 12, MAT.white);
    B(0.95, 0.08, 2.1, 8, 0.55, 12, MAT.cream);
    for (const [ox, oz] of [[-0.4, -0.9], [0.4, -0.9], [-0.4, 0.9], [0.4, 0.9]])
      B(0.06, 0.4, 0.06, 8 + ox, 0.2, 12 + oz, MAT.steel);
    addSeat("lie", "LIE ON EXAM BED", 8, 12, 0, 0.6, 0);
    addColBox(8, 12, 0.55, 1.15, 0, 0.7);
    addUse("exam", "MEDICAL EXAM", 8, 13.7, 1.8);

    B(1.4, 1.8, 0.5, 12, 0.9, 9, MAT.white);
    for (let i = 0; i < 4; i++)
      B(1.3, 0.02, 0.02, 12, 0.3 + i * 0.45, 9.27, MAT.steel);
    B(0.3, 0.5, 0.05, 12, 1.4, 9.27, MAT.glass);
    addColBox(12, 9, 0.75, 0.3, 0, 1.85);
    B(1.2, 1.5, 0.45, 12, 0.75, 11.5, MAT.white);
    addColBox(12, 11.5, 0.65, 0.28, 0, 1.6);

    B(0.6, 0.1, 1.4, 3, 0.9, 9.5, MAT.white);
    B(0.5, 0.55, 1.2, 3, 0.6, 9.5, MAT.steel);
    C(0.04, 0.04, 0.3, 6, 3, 1.1, 9.5, MAT.steel);
    addColBox(3, 9.5, 0.35, 0.75, 0, 1.1);

    chair(5.5, 11.5, -Math.PI / 2, MAT.steelDk);
    chair(6.5, 14.0, Math.PI, MAT.steelDk);
    B(0.4, 0.06, 0.4, 9.5, 0.45, 14.2, MAT.wood);
    C(0.04, 0.04, 0.4, 6, 9.5, 0.22, 14.2, MAT.steel);

    B(0.06, 2.0, 0.06, 6.2, 1.5, 10.5, MAT.steel);
    B(0.06, 2.0, 0.06, 9.8, 1.5, 10.5, MAT.steel);
    B(3.6, 0.05, 0.05, 8, 2.5, 10.5, MAT.steel);
    B(3.4, 1.6, 0.03, 8, 1.5, 10.5, MAT.cream);

    B(1.0, 1.4, 0.06, 10, 2.2, 8.15, MAT.warn);
    B(0.8, 1.2, 0.02, 10, 2.2, 8.13, MAT.dark);
    B(0.7, 0.9, 0.4, 4.5, 0.45, 16.5, MAT.white);
    C(0.08, 0.08, 0.15, 8, 4.3, 0.15, 16.3, MAT.steel);
    C(0.08, 0.08, 0.15, 8, 4.7, 0.15, 16.7, MAT.steel);

    sign3d("MEDICAL", 8, 3.2, 8.15, 2.4, 0.5, 0, "#2a2c30", "#d8d8d8");
    sign3d("AUTHORIZED PERSONNEL ONLY", 8, 2.8, 17.85, 3.4, 0.4, Math.PI, "#8a1a1a", "#f8f0e0");
  }

  /* ═══════════════════════════════════════════════════════════════════
     SALLY PORT — warning signage (already built above)
     ═══════════════════════════════════════════════════════════════════ */
  {
    sign3d("AUTHORIZED PERSONNEL ONLY", 0, 3.2, 17.85, 4.0, 0.5, Math.PI, "#8a1a1a", "#f8f0e0");
    sign3d("ALL PERSONS SUBJECT TO SEARCH", 0, 2.6, 15.5, 4.0, 0.4, 0, "#8a1a1a", "#f8f0e0");
    B(4, 0.02, 0.3, 0, 0.16, 16.5, MAT.warn);
  }

  /* ═══════════════════════════════════════════════════════════════════
     UPPER FLOOR — catwalks, bridge, void, railings (FIXED)
     ═══════════════════════════════════════════════════════════════════ */
  {
    // Slabs — W & E full-length, N/S short, bridge centre
    slab(-8, -8, -5, 8, MAT.concrete, WH);       // W catwalk (full)
    slab(5, -8, 8, 8, MAT.concrete, WH);          // E catwalk (full)
    slab(-5, -8, 5, -6, MAT.concrete, WH);        // N catwalk
    slab(-5, 6, 5, 8, MAT.concrete, WH);          // S catwalk
    slab(-5, -2, 5, 2, MAT.concrete, WH);         // Bridge
    // Cells floor
    slab(X0, -8, CELL_FRONT_W, 8, MAT.concrete, WH);
    slab(CELL_FRONT_E, -8, X1, 8, MAT.concrete, WH);
    // N & S void opening (leave open — no slab at z=-6..-2 and z=2..6 except bridge/stairs)
    // Stairs occupy x=-2..2, z=2..6 — no slab there (they ARE the stair mesh)

    // Catwalk edge trim (steel)
    B(3, 0.12, 0.12, -6.5, WH - 0.06, 8, MAT.steel);
    B(3, 0.12, 0.12, 6.5, WH - 0.06, 8, MAT.steel);
    B(3, 0.12, 0.12, -6.5, WH - 0.06, -8, MAT.steel);
    B(3, 0.12, 0.12, 6.5, WH - 0.06, -8, MAT.steel);
    B(0.12, 0.12, 16, -5, WH - 0.06, 0, MAT.steel);
    B(0.12, 0.12, 16, 5, WH - 0.06, 0, MAT.steel);
    B(10, 0.12, 0.12, 0, WH - 0.06, -6, MAT.steel);
    B(10, 0.12, 0.12, 0, WH - 0.06, 6, MAT.steel);
    B(10, 0.12, 0.12, 0, WH - 0.06, -2, MAT.steel);
    B(10, 0.12, 0.12, 0, WH - 0.06, 2, MAT.steel);

    /* ── FIXED railing helper ── */
    function railing(x1, z1, x2, z2, level) {
      const lv = level ?? 1;
      const y0 = lv * WH;
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.1) return;
      const n = Math.max(2, Math.round(len / 1.2));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        C(0.04, 0.04, 1.05, 6,
          x1 + (x2 - x1) * t, y0 + 0.525, z1 + (z2 - z1) * t, MAT.steel);
      }
      const dx = (x2 - x1) / len, dz = (z2 - z1) / len;
      const rail = new THREE.CylinderGeometry(0.05, 0.05, len, 8);
      rail.rotateZ(Math.PI / 2);
      rail.rotateY(Math.atan2(-dz, dx));
      rail.translate((x1 + x2) / 2, y0 + 1.02, (z1 + z2) / 2);
      push(rail, MAT.steel);
      // collider — aligned box
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const hw = Math.abs(x2 - x1) / 2 + 0.08;
      const hd = Math.abs(z2 - z1) / 2 + 0.08;
      colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, y0, y1: y0 + 1.15, level: lv });
    }
    // N void perimeter (x=-5..5, z=-6..-2)
    railing(-5, -6, 5, -6);      // north edge (N catwalk)
    railing(-5, -2, 5, -2);      // south edge (bridge)
    railing(-5, -6, -5, -2);     // west edge (W catwalk)
    railing(5, -6, 5, -2);       // east edge (E catwalk)
    // S void perimeter — split around stairs
    railing(-5, 2, -2, 2);       // bridge edge (west of stairs)
    railing(2, 2, 5, 2);         // bridge edge (east of stairs)
    railing(-5, 6, -2, 6);       // S catwalk edge (west of stairs)
    railing(2, 6, 5, 6);         // S catwalk edge (east of stairs)
    railing(-5, 2, -5, 6);       // west edge (W catwalk)
    railing(5, 2, 5, 6);         // east edge (E catwalk)
    // Stair railings are already part of the stair mesh

    // Corner posts at railing intersections
    for (const [px, pz] of [[-5, -6], [5, -6], [-5, -2], [5, -2], [-5, 2], [5, 2], [-5, 6], [5, 6], [-2, 2], [2, 2], [-2, 6], [2, 6]])
      C(0.1, 0.1, 1.3, 8, px, WH + 0.65, pz, MAT.steel);

    // Guard tower on N catwalk
    B(2.4, 2.0, 1.6, 0, WH + 1.0, -7, MAT.steelDk);
    B(2.2, 1.6, 0.02, 0, WH + 1.0, -6.2, MAT.glass);
    B(2.6, 0.15, 1.8, 0, WH + 2.05, -7, MAT.steel);
    addColBox(0, -7, 1.3, 0.9, WH, WH + 2.2, 1);
    B(1.8, 0.7, 0.5, 0, WH + 0.35, -7.3, MAT.dark);
    for (let i = 0; i < 2; i++)
      B(0.55, 0.4, 0.05, -0.5 + i, WH + 1.0, -7.35, MAT.monitor);

    // Observation post on S catwalk
    B(1.8, 1.6, 1.2, 0, WH + 0.8, 7, MAT.steelDk);
    B(1.6, 1.2, 0.02, 0, WH + 0.8, 6.4, MAT.glass);
    B(2.0, 0.12, 1.4, 0, WH + 1.65, 7, MAT.steel);
    addColBox(0, 7, 1.0, 0.7, WH, WH + 1.8, 1);

    // Catwalk benches
    B(2.2, 0.12, 0.5, -2.5, WH + 0.45, -7.2, MAT.bench);
    B(2.2, 0.12, 0.5,  2.5, WH + 0.45, -7.2, MAT.bench);
    B(2.0, 0.12, 0.5, -2.8, WH + 0.45, 7.1, MAT.bench);
    B(2.0, 0.12, 0.5,  2.8, WH + 0.45, 7.1, MAT.bench);
    B(0.5, 0.12, 2.4, -6.5, WH + 0.45, 0, MAT.bench);
    B(0.5, 0.12, 2.0,  6.5, WH + 0.45, 0, MAT.bench);

    // Storage crates
    B(0.8, 0.7, 0.6, -6.6, WH + 0.35, 5.5, MAT.dark);
    B(0.8, 0.7, 0.6, -6.6, WH + 0.35, -5.5, MAT.dark);
    B(0.7, 0.6, 0.55, 6.5, WH + 0.3, -5.5, MAT.dark);
  }

  /* ═══════════════════════════════════════════════════════════════════
     CEILING — pipes, hanging lights, light grid
     ═══════════════════════════════════════════════════════════════════ */
  {
    // ceiling light panels (flush)
    const lightXs = [-9.5, -3.2, 3.2, 9.5];
    const lightZs = [-15, -9, -3, 3, 9, 15];
    for (const px of lightXs) for (const pz of lightZs)
      B(1.6, 0.08, 0.9, px, WH2 - 0.04, pz, MAT.glow);
    for (const pz of lightZs) {
      B(1.2, 0.08, 0.7, -10.5, WH2 - 0.04, pz, MAT.glow);
      B(1.2, 0.08, 0.7, 10.5, WH2 - 0.04, pz, MAT.glow);
    }
    for (const zc of CELL_ZC) {
      B(0.3, 0.1, 0.3, CELL_FRONT_W + 0.5, WH - 0.05, zc, MAT.emRed);
      B(0.3, 0.1, 0.3, CELL_FRONT_E - 0.5, WH - 0.05, zc, MAT.emRed);
    }

    // industrial pipework running along building
    for (const z of [-14, -10, -4, 0, 4, 10, 14]) {
      const g = new THREE.CylinderGeometry(0.12, 0.12, W, 8);
      g.rotateZ(Math.PI / 2);
      g.translate(0, WH2 - 0.6, z);
      push(g, MAT.pipe);
    }
    for (const x of [-10, -6, 0, 6, 10]) {
      const g = new THREE.CylinderGeometry(0.10, 0.10, D, 8);
      g.rotateX(Math.PI / 2);
      g.translate(x, WH2 - 0.9, 0);
      push(g, MAT.pipe);
    }

    // hanging industrial lights over atrium
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      C(0.02, 0.02, 0.9, 4, x, WH2 - 0.5, z, MAT.steel);
      C(0.42, 0.32, 0.18, 8, x, WH2 - 1.05, z, MAT.steelDk);
      C(0.36, 0.36, 0.05, 8, x, WH2 - 1.14, z, MAT.glow);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     MERGE
     ═══════════════════════════════════════════════════════════════════ */
  for (const [m, geos] of BUCKETS) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    scene.add(new THREE.Mesh(merged, m));
  }

  /* ═══════════════════════════════════════════════════════════════════
     WORLD CONFIG
     ═══════════════════════════════════════════════════════════════════ */
  const world = {
    colliders, seats, uses,
    stairs: [{
      minX: -2, maxX: 2, minZ: 2, maxZ: 6,
      axis: "z", y0: WH, y1: 0, level: 0, toLevel: 1,
    }],
    platforms: [
      { level: 1, minX: X0, maxX: CELL_FRONT_W, minZ: -8, maxZ: 8, h: WH },
      { level: 1, minX: CELL_FRONT_E, maxX: X1, minZ: -8, maxZ: 8, h: WH },
      { level: 1, minX: -8, maxX: -5, minZ: -8, maxZ: 8, h: WH },     // W catwalk
      { level: 1, minX: 5, maxX: 8, minZ: -8, maxZ: 8, h: WH },       // E catwalk
      { level: 1, minX: -5, maxX: 5, minZ: -8, maxZ: -6, h: WH },     // N catwalk
      { level: 1, minX: -5, maxX: 5, minZ: 6, maxZ: 8, h: WH },       // S catwalk
      { level: 1, minX: -5, maxX: 5, minZ: -2, maxZ: 2, h: WH },      // bridge
    ],
    levelHeight: () => WH,
    ceilingHeight: (level) => level === 1 ? WH : WH2,
    bounds: { minX: X0 + 0.9, maxX: X1 - 0.9, minZ: Z0 + 0.9, maxZ: Z1 - 0.9 },
  };

  /* ═══════════════════════════════════════════════════════════════════
     DOOR LOGIC — swing animation
     ═══════════════════════════════════════════════════════════════════ */
  let doorClock = 0;
  let ctl;
  const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (_) {} };

  function updateDoors(dt) {
    if (!ctl || !ctl.pos) return;
    doorClock += dt;
    const px = ctl.pos.x, pz = ctl.pos.z, plv = ctl.level || 0;
    const P = window.__ph3d_prison;
    const jailed = !!(P && (P.inJail || (P.timeLeft || 0) > 0));

    for (const d of doors) {
      const same = plv === d.level;
      const dx = px - d.xFront;
      const dz = pz - d.zCenter;
      const dist2 = dx * dx + dz * dz;
      const near = same && dist2 < 5.0;

      // lock logic
      if (!d.locked && near && jailed) {
        d.locked = true; d.lockedAt = doorClock;
        toast("CELL DOOR LOCKED");
      } else if (d.locked && !jailed && doorClock - d.lockedAt > 2.5) {
        d.locked = false;
        toast("Guard unlocked the cell door");
      }

      // target angle
      d.target = (near && !d.locked) ? d.openAngle : 0;

      // smooth lerp
      const speed = 4.0;
      if (Math.abs(d.target - d.angle) < 0.01) {
        d.angle = d.target;
      } else {
        d.angle += (d.target - d.angle) * Math.min(1, dt * speed);
      }
      d.group.rotation.y = d.angle;
      d.light.material.color.setHex(d.locked ? 0xe03a30 : 0x50e070);

      // collider on/off (block while angle < 30°)
      const shouldBlock = Math.abs(d.angle) < Math.PI / 6;
      if (shouldBlock && !d.colOn) { colliders.push(d.col); d.colOn = true; }
      else if (!shouldBlock && d.colOn) {
        const i = colliders.indexOf(d.col);
        if (i >= 0) colliders.splice(i, 1);
        d.colOn = false;
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     START POSITION
     ═══════════════════════════════════════════════════════════════════ */
  const START = { x: 0, z: 15.5, yaw: 0 };

  const P0 = window.__ph3d_prison;
  if (P0 && P0.inJail) {
    const westCell = Math.random() < 0.5;
    const zc = CELL_ZC[Math.floor(Math.random() * CELL_ZC.length)];
    const xFront = westCell ? CELL_FRONT_W : CELL_FRONT_E;
    const dir = westCell ? -1 : 1;
    START.x = xFront + dir * 2.0;
    START.z = zc;
    START.yaw = westCell ? -Math.PI / 2 : Math.PI / 2;
    const target = doors.find(d =>
      d.level === 0 &&
      Math.abs(d.xFront - xFront) < 0.1 &&
      Math.abs(d.zCenter - zc) < 0.1
    );
    if (target) {
      target.locked = true;
      target.lockedAt = -10;
      target.colOn = false;
      const i = colliders.indexOf(target.col);
      if (i >= 0) colliders.splice(i, 1);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     CONTROLS
     ═══════════════════════════════════════════════════════════════════ */
  addUse("exit", "EXIT JAIL", 0, 17.2, 1.9);

  ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (u) => {
      if (!u) return;
      if (u.kind === "exit") {
        const P = window.__ph3d_prison;
        if (P && (P.inJail || (P.timeLeft || 0) > 0)) {
          toast("You must serve your sentence or pay bail.");
          return;
        }
        if (router && router.go) router.go("city");
        return;
      }
      toast(u.label || "USE");
    },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "STATE JAIL",
    title: "CELL BLOCK · 2 FLOORS",
    subtitle: "",
    hint: "E: INTERACT · ENTER AT SALLY PORT · STAIRS FROM ATRIUM CENTRE",
    isInterior: true,
    sceneId: "statejail",
    update: (dt) => {
      let r = Math.min(dt, 0.25);
      while (r > 1e-6) {
        const t = Math.min(r, 1 / 60);
        ctl.update(t);
        updateDoors(t);
        r -= t;
      }
    },
    dispose: () => ctl.dispose(),
  };
}
