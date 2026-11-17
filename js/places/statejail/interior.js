/* statejail/interior.js — State Jail · rebuilt from scratch (premium pass)

   ── Layout ─────────────────────────────────────────────────────────────
   Building: 26 × 36 m, two storeys (4.5 m each), full-height atrium ceiling
   at 9 m. Entrance on the SOUTH wall (z=18). Cells on both floors, catwalks
   around a central void, bridge across the middle.

   GROUND FLOOR (y=0)
     z=18       South wall — sally port entrance (4 m gap) + metal detector
     z=8..18    Intake (W, x=-13..-2) · Central corridor (x=-2..2) · Medical (E, x=2..13)
     z=-8..8    Cell block W (x=-13..-8) · Atrium (x=-8..8) · Cell block E (x=8..13)
     z=-18..-8  Mess hall (full width) — serving line, 4 long tables

   UPPER FLOOR (y=4.5)
     Cells on both blocks (same x/z ranges as ground)
     Catwalks:  W  x=-8..-5, z=-8..8   ·  E  x=5..8, z=-8..4
                N  x=-5..5, z=-8..-6  ·  S  x=-5..5, z=6..8
                Bridge  x=-5..5, z=-2..2
     Void:      x=-5..5, z=-6..-2 (N) and z=2..6 (S)
     Stairs:    x=5..8, z=4..8 (rising toward -z)

   CIRCULATION
     • Enter at z=18, metal detector
     • Walk north through corridor or intake/medical
     • Into the atrium — guard desk center, picnic tables
     • Cells on both sides (4 per block, per floor)
     • Stairs on the SE side of the atrium to level 1
     • Upper cells accessed via catwalks

   ── Premium details ───────────────────────────────────────────────────
   Steel-and-concrete palette, batched geometry (one draw call per
   material), recessed ceiling light grid, emergency red lighting on cell
   fronts, CCTV domes, safety stripes, cell numbers, guard desk with 3
   monitors, medical exam bay with cabinets, sally-port metal detector,
   floor drains, wall clocks, fire extinguishers. */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";

const W = 26, D = 36;
const X0 = -W / 2, X1 = W / 2;     // -13 .. 13
const Z0 = -D / 2, Z1 = D / 2;     // -18 .. 18
const WH = 4.5, WH2 = 9.0;
const CELL_X = 5;                   // cell block x-width
const CELL_Z = 4;                   // cell z-depth
const CELL_ZC = [-6, -2, 2, 6];     // cell centres
const CELL_FRONT_W = -8, CELL_FRONT_E = 8;

export async function buildInterior(router) {
  /* ── scene ── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.fog = new THREE.Fog(0x0a0c10, 55, 160);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.06, 300);
  camera.rotation.order = "YXZ";

  /* ── lights ── */
  scene.add(new THREE.HemisphereLight(0xc8d4e0, 0x1a1a20, 0.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(15, 40, 20); scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8090a0, 0.35);
  fill.position.set(-15, 20, -20); scene.add(fill);
  /* emergency glow above cell blocks */
  const emRed = new THREE.PointLight(0xff3040, 0.35, 14, 2);
  emRed.position.set(0, 3.5, 0); scene.add(emRed);

  /* ── materials ── */
  const MAT = {
    wall:     new THREE.MeshLambertMaterial({ color: 0xa8aaa8 }),
    cellWall: new THREE.MeshLambertMaterial({ color: 0xb8bab8 }),
    concrete: new THREE.MeshLambertMaterial({ color: 0x9a9ca0 }),
    ceil:     new THREE.MeshLambertMaterial({ color: 0xc0c2c0 }),
    steel:    new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.35, metalness: 0.85 }),
    steelDk:  new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.5, metalness: 0.7 }),
    bar:      new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.4, metalness: 0.75 }),
    dark:     new THREE.MeshLambertMaterial({ color: 0x2a2c30 }),
    black:    new THREE.MeshLambertMaterial({ color: 0x101214 }),
    white:    new THREE.MeshLambertMaterial({ color: 0xd8dade }),
    cream:    new THREE.MeshLambertMaterial({ color: 0xc8c4b8 }),
    orange:   new THREE.MeshLambertMaterial({ color: 0xc86a20 }),
    bench:    new THREE.MeshLambertMaterial({ color: 0x70747a }),
    wood:     new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.7 }),
    glass:    new THREE.MeshStandardMaterial({ color: 0xcfe4ee, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    glow:     new THREE.MeshBasicMaterial({ color: 0xeaf2ff }),
    warn:     new THREE.MeshLambertMaterial({ color: 0xd8b020 }),
    red:      new THREE.MeshLambertMaterial({ color: 0x8a1a1a }),
    green:    new THREE.MeshBasicMaterial({ color: 0x40d060 }),
    screen:   new THREE.MeshBasicMaterial({ color: 0x5ac0d8 }),
    monitor:  new THREE.MeshBasicMaterial({ color: 0x1e3a5a }),
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

  /* ── interactive registries ── */
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

  /* ── canvas sign helper (in-scene so it gets a scene.add) ── */
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

  /* ── wall helpers with door gaps ── */
  function wallX(z, xa, xb, doors, m, h) {
    h = h || WH;
    const ds = (doors || []).map(d => [d.at - d.w / 2, d.at + d.w / 2]).sort((a, b) => a[0] - b[0]);
    const segs = []; let cur = xa;
    for (const [s, e] of ds) { if (s > cur + 0.02) segs.push([cur, s]); cur = e; }
    if (xb > cur + 0.02) segs.push([cur, xb]);
    for (const [s, e] of segs) {
      const w = e - s;
      B(w, h, 0.2, (s + e) / 2, h / 2, z, m || MAT.wall);
      addColBox((s + e) / 2, z, w / 2, 0.1, 0, WH2);
    }
    for (const d of (doors || [])) if (h - 2.4 > 0)
      B(d.w, h - 2.4, 0.2, d.at, (h + 2.4) / 2, z, m || MAT.wall);
  }
  function wallZ(x, za, zb, doors, m, h) {
    h = h || WH;
    const ds = (doors || []).map(d => [d.at - d.w / 2, d.at + d.w / 2]).sort((a, b) => a[0] - b[0]);
    const segs = []; let cur = za;
    for (const [s, e] of ds) { if (s > cur + 0.02) segs.push([cur, s]); cur = e; }
    if (zb > cur + 0.02) segs.push([cur, zb]);
    for (const [s, e] of segs) {
      const d = e - s;
      B(0.2, h, d, x, h / 2, (s + e) / 2, m || MAT.wall);
      addColBox(x, (s + e) / 2, 0.1, d / 2, 0, WH2);
    }
    for (const d of (doors || [])) if (h - 2.4 > 0)
      B(0.2, h - 2.4, d.w, x, (h + 2.4) / 2, d.at, m || MAT.wall);
  }
  function slab(x0, z0, x1, z1, m, y) {
    B(x1 - x0, 0.15, z1 - z0, (x0 + x1) / 2, (y ?? 0) + 0.075, (z0 + z1) / 2, m || MAT.concrete);
  }

  /* ── furniture helpers ── */
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
  function cellFurnish(xFront, dir, zc, level) {
    const y0 = level * WH;
    const bx = xFront + dir * 1.1;
    /* bunk bed */
    B(1.0, 0.12, 1.9, bx, y0 + 0.55, zc + 0.55, MAT.steel);
    B(0.95, 0.22, 1.85, bx, y0 + 0.72, zc + 0.55, new THREE.MeshLambertMaterial({ color: 0x5a6070 }));
    B(0.5, 0.14, 0.3, bx, y0 + 0.9, zc - 0.1, MAT.white);
    B(0.95, 0.06, 1.1, bx, y0 + 0.82, zc + 0.95, MAT.orange);
    for (const p of [[-0.45, -0.85], [0.45, -0.85], [-0.45, 0.35], [0.45, 0.35]])
      B(0.07, 0.55, 0.07, bx + p[0], y0 + 0.28, zc + 0.55 + p[1], MAT.steel);
    addSeat("lie", "LIE DOWN", bx, zc + 0.55, 0, 0.83, level);
    addColBox(bx, zc + 0.55, 0.55, 1.0, y0, y0 + 1.0);
    /* toilet */
    C(0.24, 0.24, 0.42, 10, xFront + dir * 1.1, y0 + 0.21, zc + 1.15, MAT.white);
    B(0.5, 0.28, 0.18, xFront + dir * 1.2, y0 + 0.42, zc + 1.35, MAT.white);
    addSeat("toilet", "USE TOILET", xFront + dir * 1.1, zc + 1.15, 0, 0.44, level);
    /* sink */
    B(0.55, 0.1, 0.35, xFront + dir * 1.15, y0 + 0.85, zc + 0.35, MAT.white);
    C(0.045, 0.045, 0.28, 6, xFront + dir * 1.15, y0 + 1.0, zc + 0.2, MAT.steel);
    addUse("sink", "WASH", xFront + dir * 1.15, zc + 0.35, 1.2, level);
    /* stool */
    B(0.38, 0.06, 0.38, xFront + dir * 1.15, y0 + 0.45, zc - 0.9, MAT.wood);
    C(0.04, 0.04, 0.4, 6, xFront + dir * 1.15, y0 + 0.22, zc - 0.9, MAT.steel);
    addSeat("sit", "SIT", xFront + dir * 1.15, zc - 0.9, 0, 0.5, level);
  }

  /* ═══════════════════════════════════════════════════════════════════
     GROUND FLOOR SLABS + PERIMETER WALLS
     ═══════════════════════════════════════════════════════════════════ */
  slab(X0, Z0, X1, Z1, MAT.concrete, 0);
  B(W, 0.15, D, 0, WH2 + 0.075, 0, MAT.ceil);   // ceiling

  /* outer walls — full double height, all block both floors */
  B(W, WH2, 0.3, 0, WH2 / 2, Z0, MAT.wall);
  addColBox(0, Z0, W / 2, 0.15, 0, WH2, 0); addColBox(0, Z0, W / 2, 0.15, 0, WH2, 1);
  B(0.3, WH2, D, X0, WH2 / 2, 0, MAT.wall);
  addColBox(X0, 0, 0.15, D / 2, 0, WH2, 0); addColBox(X0, 0, 0.15, D / 2, 0, WH2, 1);
  B(0.3, WH2, D, X1, WH2 / 2, 0, MAT.wall);
  addColBox(X1, 0, 0.15, D / 2, 0, WH2, 0); addColBox(X1, 0, 0.15, D / 2, 0, WH2, 1);
  /* south wall with 4 m sally-port gap */
  wallX(Z1, X0, -2, [], MAT.wall);
  wallX(Z1, 2, X1, [], MAT.wall);
  B(4, 2.4, 0.3, 0, 1.2, Z1, MAT.dark);                 // rollup door (visual)
  B(4, 0.3, 0.3, 0, 2.7, Z1, MAT.steel);
  B(4.2, WH2 - 3.0, 0.3, 0, 3.0 + (WH2 - 3.0) / 2, Z1, MAT.wall);
  addColBox(0, Z1, W / 2, 0.15, 0, WH2, 0); addColBox(0, Z1, W / 2, 0.15, 0, WH2, 1);
  addColBox(0, Z1, 2, 0.15, 0, WH2, 0); addColBox(0, Z1, 2, 0.15, 0, WH2, 1);

  /* interior walls — ground only, both floors tall on some */
  /* z=8 boundary */
  wallX(8, X0, X0 + CELL_X, [], MAT.wall);       // cell block W ↔ intake
  wallX(8, X1 - CELL_X, X1, [], MAT.wall);       // cell block E ↔ medical
  /* z=-8 boundary */
  wallX(-8, X0, X0 + CELL_X, [], MAT.wall);      // cell block W ↔ mess
  wallX(-8, X1 - CELL_X, X1, [], MAT.wall);      // cell block E ↔ mess
  /* x=-2 / x=2 corridor walls (intake/medical separators) */
  wallZ(-2, 8, 15, [{ at: 11, w: 2 }], MAT.wall);
  wallZ(2, 8, 15, [{ at: 11, w: 2 }], MAT.wall);

  /* ═══════════════════════════════════════════════════════════════════
     CELL BLOCKS — 4 cells per block per floor
     ═══════════════════════════════════════════════════════════════════ */
  function buildCellBlock(side) {
    /* side = -1 (W) or +1 (E) */
    const xFront = side < 0 ? CELL_FRONT_W : CELL_FRONT_E;
    const xBack  = side < 0 ? X0 : X1;
    const dir    = -side;    // into-cell direction (W: +1, E: -1)

    /* cell side walls (between cells + outer boundary) */
    const zwalls = [-8, -4, 0, 4, 8];
    for (const zw of zwalls) {
      B(CELL_X, WH2, 0.16, (xFront + xBack) / 2, WH2 / 2, zw, MAT.cellWall);
      addColBox((xFront + xBack) / 2, zw, CELL_X / 2, 0.08, 0, WH2, 0);
      addColBox((xFront + xBack) / 2, zw, CELL_X / 2, 0.08, 0, WH2, 1);
    }

    for (const zc of CELL_ZC) {
      /* horizontal bar rails (two layers, one per storey) */
      for (const yb of [0, WH]) {
        B(0.12, 0.12, CELL_Z, xFront, yb + 0.35, zc, MAT.bar);
        B(0.12, 0.12, CELL_Z, xFront, yb + WH - 0.35, zc, MAT.bar);
        /* vertical bars: 10 per cell, gap where door opens */
        const nB = 10;
        for (let i = 0; i < nB; i++) {
          const bz = zc - CELL_Z / 2 + 0.15 + i * (CELL_Z - 0.3) / (nB - 1);
          if (Math.abs(bz - zc) < 0.55) continue;   // door gap
          B(0.07, WH - 0.7, 0.07, xFront, yb + (WH - 0.7) / 2 + 0.35, bz, MAT.bar);
        }
        /* door frame posts */
        B(0.18, WH - 0.4, 0.18, xFront, yb + (WH - 0.4) / 2 + 0.2, zc - 0.55, MAT.steel);
        B(0.18, WH - 0.4, 0.18, xFront, yb + (WH - 0.4) / 2 + 0.2, zc + 0.55, MAT.steel);
        /* collider for the barred front, skipping the door gap */
        addColBox(xFront, zc - CELL_Z / 2 + 1.05, 0.06, CELL_Z / 2 - 1.05, yb, yb + WH - 0.7, yb > 0 ? 1 : 0);
        addColBox(xFront, zc + CELL_Z / 2 - 0.55, 0.06, 0.55, yb, yb + WH - 0.7, yb > 0 ? 1 : 0);
      }
      /* interior furniture both floors */
      cellFurnish(xFront, dir, zc, 0);
      cellFurnish(xFront, dir, zc, 1);

      /* sliding door panels (one per storey) */
      for (const level of [0, 1]) {
        const yb = level * WH;
        const panel = new THREE.Group();
        const dm = (m, sc, ps) => {
          const k = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
          k.scale.set(...sc); k.position.set(...ps); return k;
        };
        panel.add(dm(MAT.steel, [0.1, 0.12, 1.0], [0, 0.3, 0]));
        panel.add(dm(MAT.steel, [0.1, 0.12, 1.0], [0, WH - 0.7, 0]));
        for (let i = 0; i < 5; i++)
          panel.add(dm(MAT.bar, [0.07, WH - 0.9, 0.07], [0, (WH - 0.7) / 2 + 0.3, -0.4 + i * 0.2]));
        const lightMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x40d060 }));
        lightMesh.scale.set(0.16, 0.16, 0.16);
        panel.position.set(xFront, yb + 1.1, zc);
        scene.add(panel);
        scene.add(lightMesh);
        lightMesh.position.set(xFront, yb + 2.35, zc + 0.65);
        const doorCol = {
          minX: xFront - 0.06, maxX: xFront + 0.06,
          minZ: zc - 0.55, maxZ: zc + 0.55,
          y0: yb, y1: yb + 2.3, level,
        };
        colliders.push(doorCol);
        doors.push({
          level, xFront, zCenter: zc,
          panel, light: lightMesh,
          yBase: yb, t: 0, locked: false,
          col: doorCol, colOn: true,
        });
      }

      /* cell number plaque */
      for (const yb of [0, WH]) {
        B(0.5, 0.26, 0.03, xFront, yb + 3.55, zc, MAT.dark);
        B(0.34, 0.16, 0.02, xFront, yb + 3.55, zc + 0.02, MAT.glow);
      }
    }
  }
  buildCellBlock(-1);
  buildCellBlock(1);

  /* ═══════════════════════════════════════════════════════════════════
     STAIRS — SE of atrium, x=5..8 z=4..8, rising north
     ═══════════════════════════════════════════════════════════════════ */
  {
    const NST = 14;
    const dz = 4 / NST;
    const stepH = WH / NST;
    for (let i = 0; i < NST; i++) {
      const z = 8 - i * dz - dz / 2;
      const y = stepH * (i + 0.5);
      B(3, stepH, dz * 0.96, 6.5, y, z, MAT.concrete);
      B(2.95, 0.03, 0.07, 6.5, y + stepH / 2 + 0.01, z - dz * 0.44, MAT.warn);
    }
    /* solid stringer wall (west side of stairs, blocks both floors) */
    for (let i = 0; i < NST; i++) {
      const z = 8 - i * dz - dz / 2;
      const sh = stepH * (i + 1);
      B(0.18, sh, dz * 0.98, 5, sh / 2, z, MAT.concrete);
    }
    addColBox(5, 6, 0.09, 2.05, 0, WH2, 0);
    addColBox(5, 6, 0.09, 2.05, 0, WH2, 1);
    /* handrail */
    const ang = Math.atan2(WH, 4);
    const len = Math.hypot(4, WH);
    const rail = new THREE.CylinderGeometry(0.04, 0.04, len, 8);
    rail.rotateX(Math.PI / 2 - ang);
    rail.translate(5.1, WH / 2 + 0.85, 6);
    push(rail, MAT.steel);
  }

  /* ═══════════════════════════════════════════════════════════════════
     ATRIUM — guard desk, picnic tables, drains
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* guard desk at centre */
    B(3.2, 1.0, 1.2, 0, 0.5, 0, MAT.steel);
    B(3.4, 0.1, 1.35, 0, 1.02, 0, MAT.steelDk);
    addColBox(0, 0, 1.7, 0.65, 0, 1.1);
    /* CCTV monitors on the desk */
    for (let i = 0; i < 3; i++) {
      B(0.55, 0.4, 0.05, -0.8 + i * 0.8, 1.5, -0.2, MAT.monitor);
      B(0.06, 0.06, 0.2, -0.8 + i * 0.8, 1.5, 0.05, MAT.dark);
    }
    /* radio */
    B(0.24, 0.16, 0.14, 1.0, 1.12, 0.2, MAT.dark);
    chair(0, -1.4, 0, MAT.steelDk);

    /* picnic tables scattered */
    picnicTable(-3.5, 4);
    picnicTable(3.5, 4);
    picnicTable(-3.5, -4);
    picnicTable(3.5, -4);

    /* central floor drain */
    B(1.2, 0.02, 1.2, 0, 0.02, -2.5, MAT.dark);
    for (let i = 0; i < 5; i++) B(1.0, 0.03, 0.1, 0, 0.03, -2.9 + i * 0.2, MAT.dark);

    /* wall-mounted emergency lights (red) above cell fronts */
    for (const zc of CELL_ZC) {
      for (const xf of [CELL_FRONT_W, CELL_FRONT_E]) {
        B(0.16, 0.5, 0.2, xf, 3.0, zc, MAT.steel);
        B(0.12, 0.42, 0.06, xf + (xf < 0 ? 0.12 : -0.12), 3.0, zc,
          new THREE.MeshBasicMaterial({ color: 0xff3030 }));
      }
    }

    /* CCTV domes at four corners of the atrium ceiling */
    for (const [cx, cz] of [[-7.5, -7.5], [7.5, -7.5], [-7.5, 7.5], [7.5, 7.5]]) {
      C(0.15, 0.15, 0.18, 10, cx, WH2 - 0.2, cz, MAT.dark);
      S(0.1, cx, WH2 - 0.32, cz, MAT.black);
    }

    /* signage */
    sign3d("CELL BLOCK A", CELL_FRONT_W + 0.3, WH2 - 0.6, 0, 2.0, 0.4, Math.PI / 2, "#2a2c30", "#d8d8d8");
    sign3d("CELL BLOCK B", CELL_FRONT_E - 0.3, WH2 - 0.6, 0, 2.0, 0.4, -Math.PI / 2, "#2a2c30", "#d8d8d8");
  }

  /* ═══════════════════════════════════════════════════════════════════
     MESS HALL — z=-18..-8
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* serving counter along north wall */
    B(12, 1.0, 1.0, 0, 0.5, -16.7, MAT.steel);
    B(12.2, 0.1, 1.15, 0, 1.02, -16.7, MAT.steelDk);
    B(11.8, 0.06, 0.9, 0, 1.08, -16.7, MAT.white);
    /* sneeze guard */
    B(12, 0.04, 0.04, 0, 1.7, -16.3, MAT.glass);
    B(12, 0.5, 0.03, 0, 1.45, -16.3, MAT.glass);
    addColBox(0, -16.7, 6, 0.55, 0, 1.15);
    addUse("cook", "SERVE FOOD", 0, -15.5, 2.2);

    /* pots on the counter */
    for (let i = 0; i < 5; i++)
      C(0.28, 0.28, 0.32, 10, -3.6 + i * 1.8, 1.24, -16.7, MAT.steel);

    /* 4 long tables */
    const tableZs = [-14, -11.5, -9.5];
    for (const tz of tableZs) {
      for (const tx of [-7, -2.3, 2.3, 7]) {
        B(3.6, 0.1, 1.0, tx, 0.78, tz, MAT.wood);
        for (const ox of [-1.5, 1.5]) for (const oz of [-0.35, 0.35])
          B(0.12, 0.78, 0.12, tx + ox, 0.39, tz + oz, MAT.steel);
        addColBox(tx, tz, 1.8, 0.5, 0, 0.85);
        bench(tx, tz - 0.85, 3.4, 0);
        bench(tx, tz + 0.85, 3.4, Math.PI);
        /* tray */
        B(0.5, 0.04, 0.36, tx - 0.6, 0.84, tz, MAT.red);
        C(0.1, 0.1, 0.12, 8, tx - 0.85, 0.9, tz, MAT.white);
      }
    }

    /* wall safety stripes */
    B(W, 0.14, 0.06, 0, 1.3, Z0 + 0.16, MAT.warn);
    B(0.06, 0.14, 8, X0 + 0.16, 1.3, -13, MAT.warn);
    B(0.06, 0.14, 8, X1 - 0.16, 1.3, -13, MAT.warn);

    /* emergency exit (visual) */
    B(2.0, 2.6, 0.15, -8, 1.3, Z0 + 0.16, MAT.dark);
    B(2.2, 0.14, 0.2, -8, 2.7, Z0 + 0.16, MAT.steel);
    B(1.4, 0.9, 0.05, -8, 2.0, Z0 + 0.24, MAT.screen);

    /* signage */
    sign3d("MESS HALL", 0, 3.2, -8.1, 3.2, 0.5, 0, "#2a2c30", "#d8d8d8");
  }

  /* ═══════════════════════════════════════════════════════════════════
     INTAKE — x=-13..-2, z=8..18
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* booking desk */
    B(3.0, 1.0, 1.1, -8, 0.5, 12.5, MAT.steel);
    B(3.2, 0.1, 1.25, -8, 1.02, 12.5, MAT.steelDk);
    B(2.0, 0.85, 0.06, -8, 0.5, 13.1, MAT.dark);
    B(0.5, 0.4, 0.05, -8.8, 1.45, 12.4, MAT.monitor);
    B(0.6, 0.3, 0.05, -7.4, 1.45, 12.4, MAT.monitor);
    addColBox(-8, 12.5, 1.6, 0.6, 0, 1.15);
    addUse("booking", "BOOKING DESK", -8, 14.0, 2.0);
    chair(-8, 11.4, Math.PI, MAT.steelDk);

    /* mugshot height chart on wall */
    B(0.6, 2.4, 0.08, -12.85, 1.6, 12.5, MAT.cream);
    for (let i = 0; i < 8; i++)
      B(0.4, 0.03, 0.06, -12.85, 0.5 + i * 0.28, 12.5, MAT.dark);

    /* holding bench */
    bench(-10, 16, 3.0, 0);

    /* coat rack */
    C(0.04, 0.04, 2.0, 6, -12.5, 1.0, 9, MAT.steel);
    for (const [hx, hz] of [[-12.3, 9], [-12.7, 9]]) {
      S(0.06, hx, 1.9, hz, MAT.steel);
    }

    /* fire extinguisher */
    C(0.1, 0.1, 0.5, 8, -3.5, 1.2, 17.8, MAT.red);
    B(0.14, 0.1, 0.14, -3.5, 1.5, 17.8, MAT.dark);

    /* signage */
    sign3d("INTAKE · BOOKING", -8, 3.2, 8.1, 3.4, 0.5, Math.PI, "#2a2c30", "#d8d8d8");
  }

  /* ═══════════════════════════════════════════════════════════════════
     MEDICAL — x=2..13, z=8..18
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* exam bed */
    B(1.0, 0.5, 2.2, 8, 0.25, 12, MAT.white);
    B(0.95, 0.08, 2.1, 8, 0.55, 12, MAT.cream);
    for (const [ox, oz] of [[-0.4, -0.9], [0.4, -0.9], [-0.4, 0.9], [0.4, 0.9]])
      B(0.06, 0.4, 0.06, 8 + ox, 0.2, 12 + oz, MAT.steel);
    addSeat("lie", "LIE ON EXAM BED", 8, 12, 0, 0.6, 0);
    addColBox(8, 12, 0.55, 1.15, 0, 0.7);
    addUse("exam", "MEDICAL EXAM", 8, 13.7, 1.8);

    /* medical cabinet */
    B(1.4, 1.8, 0.5, 12, 0.9, 9, MAT.white);
    for (let i = 0; i < 4; i++)
      B(1.3, 0.02, 0.02, 12, 0.3 + i * 0.45, 9.27, MAT.steel);
    B(0.3, 0.5, 0.05, 12, 1.4, 9.27, MAT.glass);
    addColBox(12, 9, 0.75, 0.3, 0, 1.85);

    /* sink */
    B(0.6, 0.1, 1.4, 3, 0.9, 9.5, MAT.white);
    B(0.5, 0.55, 1.2, 3, 0.6, 9.5, MAT.steel);
    C(0.04, 0.04, 0.3, 6, 3, 1.1, 9.5, MAT.steel);
    addColBox(3, 9.5, 0.35, 0.75, 0, 1.1);

    /* doctor's chair */
    chair(5.5, 11.5, -Math.PI / 2, MAT.steelDk);

    /* biohazard poster */
    B(1.0, 1.4, 0.06, 10, 2.2, 8.15, MAT.warn);
    B(0.8, 1.2, 0.02, 10, 2.2, 8.13, MAT.dark);

    /* signage */
    sign3d("MEDICAL", 8, 3.2, 8.1, 2.4, 0.5, Math.PI, "#2a2c30", "#d8d8d8");
  }

  /* ═══════════════════════════════════════════════════════════════════
     SALLY PORT — entrance zone (z=15..18)
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* metal detector arch at x=0 */
    B(0.22, 2.4, 0.22, -0.85, 1.2, 16.5, MAT.steel);
    B(0.22, 2.4, 0.22, 0.85, 1.2, 16.5, MAT.steel);
    B(1.92, 0.22, 0.22, 0, 2.35, 16.5, MAT.steel);
    S(0.1, 0, 2.52, 16.5, MAT.green);
    addColBox(-0.85, 16.5, 0.15, 0.15, 0, 2.5);
    addColBox(0.85, 16.5, 0.15, 0.15, 0, 2.5);

    /* guard booth (east side of entrance) */
    B(2.4, 2.4, 2.0, 4.5, 1.2, 16.5, MAT.steelDk);
    B(2.2, 1.8, 0.02, 4.5, 1.4, 15.5, MAT.glass);
    B(2.4, 0.15, 2.2, 4.5, 2.45, 16.5, MAT.steel);
    addColBox(4.5, 16.5, 1.2, 1.0, 0, 2.5);

    /* warning signs */
    sign3d("AUTHORIZED PERSONNEL ONLY", 0, 3.2, 17.7, 4.0, 0.5, Math.PI, "#8a1a1a", "#f8f0e0");
    sign3d("ALL PERSONS SUBJECT TO SEARCH", -6, 2.6, 15.85, 4.0, 0.4, Math.PI, "#8a1a1a", "#f8f0e0");

    /* warning stripe on floor */
    B(4, 0.02, 0.3, 0, 0.16, 16.5, MAT.warn);
  }

  /* ═══════════════════════════════════════════════════════════════════
     UPPER FLOOR — catwalks, bridge, upper cells (already built above)
     ═══════════════════════════════════════════════════════════════════ */
  {
    /* slabs for walkable platforms */
    /* W catwalk */
    slab(-8, -8, -5, 8, MAT.concrete, WH);
    /* E catwalk (stops at stairs top) */
    slab(5, -8, 8, 4, MAT.concrete, WH);
    /* N catwalk */
    slab(-5, -8, 5, -6, MAT.concrete, WH);
    /* S catwalk */
    slab(-5, 6, 5, 8, MAT.concrete, WH);
    /* Bridge */
    slab(-5, -2, 5, 2, MAT.concrete, WH);
    /* Upper cell floors (walkable through cell doors) */
    slab(X0, -8, CELL_FRONT_W, 8, MAT.concrete, WH);
    slab(CELL_FRONT_E, -8, X1, 8, MAT.concrete, WH);

    /* slab edge trims (steel) */
    B(3, 0.12, 0.12, -6.5, WH - 0.06, 8, MAT.steel);
    B(3, 0.12, 0.12, -6.5, WH - 0.06, -8, MAT.steel);
    B(3, 0.12, 0.12, 6.5, WH - 0.06, -8, MAT.steel);
    B(0.12, 0.12, 16, -5, WH - 0.06, 0, MAT.steel);
    B(0.12, 0.12, 6, 5, WH - 0.06, -5, MAT.steel);

    /* railings along all void edges (level 1 only) */
    function railing(x1, z1, x2, z2) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(3, Math.round(len / 1.2));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
        C(0.04, 0.04, 1.0, 6, px, WH + 0.5, pz, MAT.steel);
      }
      const dx = (x2 - x1) / len, dz = (z2 - z1) / len;
      const ang = Math.atan2(dx, dz);
      const rail = new THREE.CylinderGeometry(0.05, 0.05, len, 8);
      rail.rotateZ(Math.PI / 2);
      rail.rotateY(ang);
      rail.translate((x1 + x2) / 2, WH + 1.02, (z1 + z2) / 2);
      push(rail, MAT.steel);
      /* collider strip */
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const hw = Math.abs(x2 - x1) / 2 + 0.05, hd = Math.abs(z2 - z1) / 2 + 0.05;
      colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, y0: WH, y1: WH + 1.2, level: 1 });
    }
    /* W catwalk inner edge */
    railing(-5, -8, -5, 8);
    /* E catwalk inner edge */
    railing(5, -8, 5, 4);
    /* N catwalk inner edge */
    railing(-5, -6, 5, -6);
    /* S catwalk inner edge */
    railing(-5, 6, 5, 6);
    /* Bridge edges */
    railing(-5, -2, 5, -2);
    railing(-5, 2, 5, 2);

    /* corner posts */
    for (const [px, pz] of [[-5, 8], [-5, -8], [5, -8], [5, -6], [5, 6], [-5, 6], [-5, -2], [5, -2], [-5, 2], [5, 2]])
      C(0.1, 0.1, 1.3, 8, px, WH + 0.65, pz, MAT.steel);

    /* guard tower on N catwalk */
    B(2.4, 2.0, 1.6, 0, WH + 1.0, -7, MAT.steelDk);
    B(2.2, 1.6, 0.02, 0, WH + 1.0, -6.2, MAT.glass);
    B(2.6, 0.15, 1.8, 0, WH + 2.05, -7, MAT.steel);
    addColBox(0, -7, 1.3, 0.9, WH, WH + 2.2, 1);
    /* desk + monitors inside */
    B(1.8, 0.7, 0.5, 0, WH + 0.35, -7.3, MAT.dark);
    for (let i = 0; i < 2; i++)
      B(0.55, 0.4, 0.05, -0.5 + i, WH + 1.0, -7.35, MAT.monitor);

    /* cell numbers for upper cells */
    for (const zc of CELL_ZC) {
      for (const xf of [CELL_FRONT_W, CELL_FRONT_E]) {
        B(0.5, 0.26, 0.03, xf, WH + 3.55, zc, MAT.dark);
        B(0.34, 0.16, 0.02, xf, WH + 3.55, zc + 0.02, MAT.glow);
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     CEILING LIGHT GRID
     ═══════════════════════════════════════════════════════════════════ */
  {
    const panels = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) {
      const px = X0 + 3 + i * 5;
      const pz = Z0 + 3 + j * 6;
      panels.push([px, pz]);
    }
    for (const [px, pz] of panels) {
      B(1.6, 0.08, 0.9, px, WH2 - 0.04, pz, MAT.glow);
    }
    /* red emergency light grid near cell blocks */
    for (const zc of CELL_ZC) {
      B(0.3, 0.1, 0.3, CELL_FRONT_W + 0.5, WH - 0.05, zc, new THREE.MeshBasicMaterial({ color: 0xff3030 }));
      B(0.3, 0.1, 0.3, CELL_FRONT_E - 0.5, WH - 0.05, zc, new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     MERGE BATCHES
     ═══════════════════════════════════════════════════════════════════ */
  for (const [m, geos] of BUCKETS) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, m);
    scene.add(mesh);
  }

  /* ═══════════════════════════════════════════════════════════════════
     WORLD CONFIG
     ═══════════════════════════════════════════════════════════════════ */
  const world = {
    colliders, seats, uses,
    stairs: [{
      minX: 5, maxX: 8, minZ: 4, maxZ: 8,
      axis: "z", y0: WH, y1: 0, level: 0, toLevel: 1,
    }],
    platforms: [
      { level: 1, minX: X0, maxX: CELL_FRONT_W, minZ: -8, maxZ: 8, h: WH },  // upper cells W
      { level: 1, minX: CELL_FRONT_E, maxX: X1, minZ: -8, maxZ: 8, h: WH },  // upper cells E
      { level: 1, minX: -8, maxX: -5, minZ: -8, maxZ: 8, h: WH },           // W catwalk
      { level: 1, minX: 5, maxX: 8, minZ: -8, maxZ: 4, h: WH },             // E catwalk
      { level: 1, minX: -5, maxX: 5, minZ: -8, maxZ: -6, h: WH },           // N catwalk
      { level: 1, minX: -5, maxX: 5, minZ: 6, maxZ: 8, h: WH },             // S catwalk
      { level: 1, minX: -5, maxX: 5, minZ: -2, maxZ: 2, h: WH },            // bridge
    ],
    levelHeight: () => 0,
    ceilingHeight: (level) => level === 1 ? WH : WH2,
    bounds: { minX: X0 + 0.9, maxX: X1 - 0.9, minZ: Z0 + 0.9, maxZ: Z1 - 0.9 },
  };

  /* ═══════════════════════════════════════════════════════════════════
     DOOR LOGIC
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
      const inside = same && Math.abs(dx) < 3.0 && Math.abs(dz) < 1.5;
      const near = same && dist2 < 4.0;
      if (!d.locked && inside && jailed) {
        d.locked = true;
        d.lockedAt = doorClock;
        toast("CELL DOOR LOCKED");
      } else if (d.locked && !jailed && doorClock - d.lockedAt > 2.5) {
        d.locked = false;
        toast("Guard unlocked the cell door");
      }
      const target = (!d.locked && near) ? 1 : 0;
      d.t += Math.max(-1, Math.min(1, target - d.t)) * Math.min(1, dt * 3.5);
      if (Math.abs(target - d.t) < 0.02) d.t = target;
      /* panel slides UP as it opens (y animates from yBase+1.1 to yBase+3.3) */
      d.panel.position.y = d.yBase + 1.1 + d.t * 2.2;
      d.light.material.color.setHex(d.locked ? 0xe03a30 : 0x40d060);
      const shouldBlock = d.t < 0.5;
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
  const START = { x: 0, z: 16, yaw: 0 };

  /* story link: sentenced player spawns inside a random cell */
  const P0 = window.__ph3d_prison;
  if (P0 && P0.inJail) {
    const westCell = Math.random() < 0.5;
    const zc = CELL_ZC[Math.floor(Math.random() * CELL_ZC.length)];
    const xFront = westCell ? CELL_FRONT_W : CELL_FRONT_E;
    START.x = xFront + (westCell ? 2.0 : -2.0);
    START.z = zc;
    START.yaw = westCell ? -Math.PI / 2 : Math.PI / 2;
    /* lock the corresponding cell door */
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

  /* ═══════════════════════════════════════════════════════════════════
     RETURN
     ═══════════════════════════════════════════════════════════════════ */
  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "STATE JAIL",
    title: "CELL BLOCK · 2 FLOORS",
    subtitle: "",
    hint: "E: INTERACT · ENTER AT SALLY PORT · STAIRS EAST OF ATRIUM",
    isInterior: true,
    sceneId: "statejail",
    update: (dt) => {
      /* sub-step so a lag spike cannot tunnel through thin bars */
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
