/* ════════════════════════════════════════════════════════════════
   govhouse/interior.js — State Secretariat (Government House)
   ────────────────────────────────────────────────────────────────
   Full rebuild of the standalone "State Secretariat · Grand Atrium"
   prototype, converted from first-person WASD to the game's
   ThirdPersonControls:

     • The character is visible (the game's avatar, dressed by the
       wardrobe).
     • Camera is third person; it pulls in against walls and clamps
       under the room ceilings automatically.
     • Every chair, sofa, and sun-lounger is a real seat.
     • Every desk is a "WORK" prompt.
     • The reflecting pool is walkable-around but not walkable-into.
     • The grand gate opens onto the outdoor terrace + pool.

   Original layout preserved:
     • 66 × 54 m building, 12 m central atrium with gold skylight
     • 4-column colonnade + balcony ring at 6.6 m
     • Circular reflecting pool with fountain (radius 7)
     • 20 ground-floor rooms around the atrium (offices, conference
       rooms, lounges, library, banquet halls, entrance hall)
     • Outdoor terrace with rectangular swimming pool, palms, sun
       loungers, hedge perimeter
   ════════════════════════════════════════════════════════════════ */

import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { addStreetLamp } from "../../core/scene-lamps.js";
import { addNightGlow } from "../../core/night-glow.js";

export async function buildInterior(router) {
  /* ══════════════════════════════════════════════════════════
     1 · SCENE, CAMERA, BACKGROUND
     ══════════════════════════════════════════════════════════ */
  const scene = new THREE.Scene();

  /* Sky (procedural gradient, same as prototype) */
  {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, "#050914"); grad.addColorStop(0.35, "#101c34");
    grad.addColorStop(0.52, "#22304e"); grad.addColorStop(0.64, "#3d4666");
    grad.addColorStop(0.72, "#7a5c4a"); grad.addColorStop(0.79, "#c08050");
    grad.addColorStop(0.84, "#e0a060"); grad.addColorStop(0.90, "#5a4550");
    grad.addColorStop(1.00, "#12101a");
    g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }
  scene.fog = new THREE.Fog(0x1e2a44, 120, 330);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 420);
  camera.rotation.order = "YXZ";

  /* ══════════════════════════════════════════════════════════
     2 · PROCEDURAL TEXTURES
     ══════════════════════════════════════════════════════════ */
  function makeMarble() {
    const S = 256, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    x.fillStyle = "#d3ccbd"; x.fillRect(0, 0, S, S);
    x.fillStyle = "#bcb4a2"; x.fillRect(0, 0, S / 2, S / 2); x.fillRect(S / 2, S / 2, S / 2, S / 2);
    for (let i = 0; i < 55; i++) {
      x.strokeStyle = `rgba(${150 + Math.random() * 45 | 0},${144 + Math.random() * 45 | 0},${126 + Math.random() * 45 | 0},.22)`;
      x.lineWidth = Math.random() * 2.6 + .4;
      x.beginPath();
      let px = Math.random() * S, py = Math.random() * S;
      x.moveTo(px, py);
      for (let j = 0; j < 5; j++) { px += (Math.random() - .5) * 100; py += (Math.random() - .5) * 100; x.lineTo(px, py); }
      x.stroke();
    }
    x.strokeStyle = "rgba(105,98,86,.45)"; x.lineWidth = 2;
    x.strokeRect(1, 1, S - 2, S - 2);
    x.beginPath(); x.moveTo(S / 2, 0); x.lineTo(S / 2, S); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function makeWater() {
    const S = 128, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    x.fillStyle = "#0b2b3c"; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = `rgba(${110 + Math.random() * 90 | 0},${190 + Math.random() * 65 | 0},255,${.06 + Math.random() * .16})`;
      x.lineWidth = Math.random() * 2 + .5;
      x.beginPath();
      x.arc(Math.random() * S, Math.random() * S, Math.random() * 22 + 4,
            Math.random() * 6.28, Math.random() * 6.28);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function makeGlow() {
    const S = 64, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0,    "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,238,205,.55)");
    g.addColorStop(0.55, "rgba(255,214,150,.15)");
    g.addColorStop(1,    "rgba(255,190,110,0)");
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const marbleTex = makeMarble();
  const waterTex  = makeWater();
  const glowTex   = makeGlow();

  /* ══════════════════════════════════════════════════════════
     3 · COLLECTIONS
     ══════════════════════════════════════════════════════════ */
  const B = [], E = [], CY = [], GL = [];
  const SOLID = [], SEATS = [], USES = [];

  const box = (x, y, z, w, h, d, c, rx, ry, rz) =>
    B.push({ x, y, z, w, h, d, c, rx: rx || 0, ry: ry || 0, rz: rz || 0 });
  const ebox = (x, y, z, w, h, d, c) =>
    E.push({ x, y, z, w, h, d, c });
  const cyl = (x, y, z, r, h, c) =>
    CY.push({ x, y, z, r, h, c });
  const glow = (x, y, z, s, c) =>
    GL.push({ x, y, z, s, c });

  /* Walls are both lit AND collidable. y0/y1 come from the
     world-space box; ThirdPersonControls uses them for camera
     raycasting. */
  function solid(x, y, z, w, h, d, c) {
    B.push({ x, y, z, w, h, d, c, rx: 0, ry: 0, rz: 0 });
    SOLID.push({
      x0: x - w / 2, x1: x + w / 2,
      z0: z - d / 2, z1: z + d / 2,
      y0: y - h / 2, y1: y + h / 2,
    });
  }

  /* ══════════════════════════════════════════════════════════
     4 · PALETTE + DIMENSIONS
     ══════════════════════════════════════════════════════════ */
  const C = {
    stone: 0xd8d1c1, stoneLight: 0xefe9dc, stoneDark: 0xa79f8d,
    wall: 0xe2dbca, wallWarm: 0xcfc3ab, gold: 0xc9a04a, goldDark: 0x87672c,
    wood: 0x5b3e27, woodDark: 0x382516,
    fabric: 0x2d3b55, fabricDeep: 0x1c2636, crimson: 0x6d2228,
    metal: 0x9aa0a8, green: 0x2f5b38, greenDark: 0x1c3a23,
    dark: 0x141419, white: 0xf5f1e6, carpetRed: 0x5e1f24,
  };
  const AT = 19, BX = 33, BZ = 27, WH = 12, RH = 4.6, BALY = 6.6, T = 0.5;
  const TY = -0.22;
  const TS = 0.3;
  const PR = 7.0;

  /* ══════════════════════════════════════════════════════════
     5 · WALL BUILDER WITH DOORS
     ══════════════════════════════════════════════════════════ */
  function wallWithDoors(axis, pos, a0, a1, h, t, color, doors) {
    doors = (doors || []).slice().sort((p, q) => p.p - q.p);
    let cur = a0;
    const put = (s, e, y0, y1, collide) => {
      if (e - s <= 0.01) return;
      const mid = (s + e) / 2, len = e - s, hh = y1 - y0, cy = (y0 + y1) / 2;
      if (axis === "x") {
        if (collide) solid(mid, cy, pos, len, hh, t, color);
        else box(mid, cy, pos, len, hh, t, color);
      } else {
        if (collide) solid(pos, cy, mid, t, hh, len, color);
        else box(pos, cy, mid, t, hh, len, color);
      }
    };
    for (const d of doors) {
      const s = d.p - d.w / 2, e = d.p + d.w / 2;
      put(cur, s, 0, h, true);
      put(s, e, d.h, h, false);
      cur = e;
    }
    put(cur, a1, 0, h, true);
  }
  function doorFrame(axis, pos, p, w, h) {
    if (axis === "x") {
      box(p - w / 2 - 0.12, h / 2, pos, 0.22, h, T + 0.12, C.gold);
      box(p + w / 2 + 0.12, h / 2, pos, 0.22, h, T + 0.12, C.gold);
      box(p, h + 0.14, pos, w + 0.6, 0.26, T + 0.12, C.gold);
    } else {
      box(pos, h / 2, p - w / 2 - 0.12, T + 0.12, h, 0.22, C.gold);
      box(pos, h / 2, p + w / 2 + 0.12, T + 0.12, h, 0.22, C.gold);
      box(pos, h + 0.14, p, T + 0.12, 0.26, w + 0.6, C.gold);
    }
  }

  /* ══════════════════════════════════════════════════════════
     6 · FLOOR
     ══════════════════════════════════════════════════════════ */
  marbleTex.repeat.set(16, 13);
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(66, 54, 18, 16),
    new THREE.MeshPhongMaterial({ map: marbleTex, shininess: 65, specular: 0x4a4a4a })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  scene.add(floorMesh);

  /* ══════════════════════════════════════════════════════════
     7 · OUTER SHELL
     ══════════════════════════════════════════════════════════ */
  solid(0, WH / 2, -BZ, 67, WH, T, C.stone);
  solid(-19, WH / 2, BZ, 28, WH, T, C.stone);
  solid( 19, WH / 2, BZ, 28, WH, T, C.stone);
  box(0, 9.5, BZ, 10, 5, T, C.stone);
  solid( BX, WH / 2, 0, T, WH, 55, C.stone);
  solid(-BX, WH / 2, 0, T, WH, 55, C.stone);

  /* ══════════════════════════════════════════════════════════
     8 · ATRIUM WALLS
     ══════════════════════════════════════════════════════════ */
  const WEST_DOORS = [{ p: -14.25, w: 2.6, h: 3.6 }, { p: -4.75, w: 2.6, h: 3.6 },
                      { p:  4.75, w: 2.6, h: 3.6 }, { p: 14.25, w: 2.6, h: 3.6 }];
  const NORTH_DOORS = WEST_DOORS;

  wallWithDoors("z", -AT, -BZ, BZ, WH, T, C.wall, WEST_DOORS);
  wallWithDoors("z",  AT, -BZ, BZ, WH, T, C.wall, WEST_DOORS);
  wallWithDoors("x", -AT, -AT, AT, WH, T, C.wall, NORTH_DOORS);

    wallWithDoors("x", AT,   5, 19, WH, T, C.wall,
    [{ p:  8.5, w: 2.4, h: 3.6 }, { p: 15.5, w: 2.4, h: 3.6 }]);

  WEST_DOORS.forEach(d => { doorFrame("z", -AT, d.p, d.w, d.h); doorFrame("z", AT, d.p, d.w, d.h); });
  NORTH_DOORS.forEach(d => { doorFrame("x", -AT, d.p, d.w, d.h); });
  [-15.5, -8.5, 8.5, 15.5].forEach(p => doorFrame("x", AT, p, 2.4, 3.6));

  /* ══════════════════════════════════════════════════════════
     9 · ROOM PARTITION WALLS
     ══════════════════════════════════════════════════════════ */
  wallWithDoors("x", -19, -BX, -AT, RH, 0.35, C.wall, [{ p: -26, w: 2.2, h: 3.2 }]);
  wallWithDoors("x", -9.5, -BX, -AT, RH, 0.35, C.wall, []);
  wallWithDoors("x",  0,   -BX, -AT, RH, 0.35, C.wall, []);
  wallWithDoors("x",  9.5, -BX, -AT, RH, 0.35, C.wall, []);
  wallWithDoors("x",  AT,  -BX, -AT, RH, 0.35, C.wall, [{ p: -26, w: 2.2, h: 3.2 }]);

  wallWithDoors("x", -19, AT, BX, RH, 0.35, C.wall, [{ p: 26, w: 2.2, h: 3.2 }]);
  wallWithDoors("x", -9.5, AT, BX, RH, 0.35, C.wall, []);
  wallWithDoors("x",  0,   AT, BX, RH, 0.35, C.wall, []);
  wallWithDoors("x",  9.5, AT, BX, RH, 0.35, C.wall, []);
  wallWithDoors("x",  AT,  AT, BX, RH, 0.35, C.wall, [{ p: 26, w: 2.2, h: 3.2 }]);

  [-9.5, 0, 9.5].forEach(x => solid(x, RH / 2, -23, 0.35, RH, 8, C.wall));
  [-12, 12].forEach(x => solid(x, RH / 2, 23, 0.35, RH, 8, C.wall));
  solid(-5, 6, 23, T, 12, 8, C.wall);
  solid( 5, 6, 23, T, 12, 8, C.wall);

  /* ══════════════════════════════════════════════════════════
     10 · CEILINGS
     ══════════════════════════════════════════════════════════ */
  box(0, RH + 0.25, -23, 66, 0.5, 8, C.stoneLight);
  box(-19, RH + 0.25, 23, 28, 0.5, 8, C.stoneLight);
  box( 19, RH + 0.25, 23, 28, 0.5, 8, C.stoneLight);
  box(-26, RH + 0.25, 0, 14, 0.5, 38, C.stoneLight);
  box( 26, RH + 0.25, 0, 14, 0.5, 38, C.stoneLight);
  box(0, 12.25, 23, 10, 0.5, 8, C.stoneLight);

  box(0, 12.55, 0, 38.6, 0.6, 38.6, C.stoneLight);
  ebox(0, 12.05, 0, 24, 0.22, 24, 0xfff0cc);
  for (let i = -2; i <= 2; i++) {
    box(i * 6, 11.78, 0, 0.55, 0.55, 24.4, C.gold);
    box(0, 11.78, i * 6, 24.4, 0.55, 0.55, C.gold);
  }
  box(0, 11.92,  12.3, 25.2, 0.55, 0.55, C.goldDark);
  box(0, 11.92, -12.3, 25.2, 0.55, 0.55, C.goldDark);
  box( 12.3, 11.92, 0, 0.55, 0.55, 25.2, C.goldDark);
  box(-12.3, 11.92, 0, 0.55, 0.55, 25.2, C.goldDark);

  /* ══════════════════════════════════════════════════════════
     11 · BALCONY RING + COLONNADE
     ══════════════════════════════════════════════════════════ */
  box(-17, BALY - 0.25, 0, 4, 0.5, 38, C.stoneLight);
  box( 17, BALY - 0.25, 0, 4, 0.5, 38, C.stoneLight);
  box(0, BALY - 0.25, -17, 30, 0.5, 4, C.stoneLight);
  box(0, BALY - 0.25,  17, 30, 0.5, 4, C.stoneLight);

  function railing(axis, pos, a0, a1) {
    const len = Math.abs(a1 - a0), mid = (a0 + a1) / 2;
    if (axis === "z") {
      box(pos, BALY + 0.48, mid, 0.16, 0.96, len, C.stoneDark);
      box(pos, BALY + 1.02, mid, 0.36, 0.14, len, C.gold);
    } else {
      box(mid, BALY + 0.48, pos, len, 0.96, 0.16, C.stoneDark);
      box(mid, BALY + 1.02, pos, len, 0.14, 0.36, C.gold);
    }
  }
  railing("z", -15, -19, 19); railing("z", 15, -19, 19);
  railing("x", -15, -15, 15); railing("x", 15, -15, 15);

  const colPos = [];
  for (let z = -15; z <= 15; z += 5) { colPos.push([-15, z]); colPos.push([15, z]); }
  for (let x = -10; x <= 10; x += 5) { colPos.push([x, -15]); colPos.push([x, 15]); }
  colPos.forEach(([x, z]) => {
    cyl(x, 0.25, z, 0.86, 0.5, C.stoneLight);
    cyl(x, 3.22, z, 0.62, 5.45, C.stone);
    cyl(x, 6.15, z, 0.86, 0.4, C.stoneLight);
    cyl(x, 1.05, z, 0.68, 0.14, C.gold);
    cyl(x, 5.35, z, 0.68, 0.14, C.gold);
    cyl(x, 0.52, z, 0.95, 0.1, C.goldDark);
    /* Collide the base of every column so the player can't walk through */
    SOLID.push({ x0: x - 0.95, x1: x + 0.95, z0: z - 0.95, z1: z + 0.95, y0: 0, y1: 6.6 });
  });

  /* ══════════════════════════════════════════════════════════
     12 · REFLECTING POOL + FOUNTAIN
     ══════════════════════════════════════════════════════════ */
  cyl(0, 0.4, 0, PR, 0.8, 0x0b2434);

  const waterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(PR - 0.06, 48),
    new THREE.MeshPhongMaterial({
      map: waterTex, color: 0x8fdcff, transparent: true, opacity: 0.82,
      shininess: 120, specular: 0xffffff, depthWrite: false,
    })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 0.78;
  scene.add(waterMesh);
  waterTex.repeat.set(3, 3);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(PR, 0.22, 6, 40),
    new THREE.MeshLambertMaterial({ color: C.stoneLight })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.8;
  scene.add(rim);

  cyl(0, 0.35, 0, 2.2, 0.7, C.stoneLight);
  cyl(0, 1.35, 0, 0.45, 1.4, C.stone);
  cyl(0, 2.15, 0, 1.7, 0.28, C.stoneLight);
  cyl(0, 2.85, 0, 0.28, 1.2, C.stone);
  cyl(0, 3.55, 0, 1.0, 0.24, C.stoneLight);
  cyl(0, 4.05, 0, 0.16, 0.8, C.gold);
  cyl(0, 4.5, 0, 0.35, 0.35, C.gold);

  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    ebox(Math.cos(a) * 5.6, 0.16, Math.sin(a) * 5.6, 0.34, 0.2, 0.34, 0x9fe8ff);
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    ebox(Math.cos(a) * 1.3, 2.4, Math.sin(a) * 1.3, 0.1, 0.9, 0.1, 0xcdf2ff);
  }

  /* Circular pool collider — the ThirdPersonControls uses box
     colliders, so we approximate the circle with 16 thin boxes. */
  const NRING = 16, RRING = PR + 0.55;
  for (let i = 0; i < NRING; i++) {
    const a = (i / NRING) * Math.PI * 2;
    const bx = Math.cos(a) * RRING;
    const bz = Math.sin(a) * RRING;
    const seg = (Math.PI * 2 * RRING) / NRING;
    SOLID.push({
      x0: bx - seg, x1: bx + seg,
      z0: bz - seg, z1: bz + seg,
      y0: 0, y1: 0.8,
    });
  }

  /* ══════════════════════════════════════════════════════════
     13 · CHANDELIERS + PENDANTS
     ══════════════════════════════════════════════════════════ */
  function chandelier(x, y, z) {
    cyl(x, y + 1.9, z, 0.045, 3.8, C.goldDark);
    cyl(x, y, z, 0.55, 0.35, C.gold);
    cyl(x, y + 0.2, z, 0.34, 0.2, C.goldDark);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const r = 1.45;
      box(x + Math.cos(a) * r, y - 0.05, z + Math.sin(a) * r, 0.1, 0.9, 0.1, C.goldDark, 0, -a, 0);
      ebox(x + Math.cos(a) * r, y + 0.32, z + Math.sin(a) * r, 0.3, 0.42, 0.3, 0xffe0a8);
      ebox(x + Math.cos(a) * r * 1.02, y - 0.55, z + Math.sin(a) * r * 1.02, 0.16, 0.4, 0.16, 0xfff2d8);
    }
    ebox(x, y + 0.55, z, 0.55, 0.55, 0.55, 0xfff6e0);
    glow(x, 0.07, z, 16, 0xffc880);
  }
  chandelier(-9, 9.4, -9); chandelier(9, 9.4, -9);
  chandelier(-9, 9.4, 9);  chandelier(9, 9.4, 9);

  for (let z = -15; z <= 15; z += 7.5) {
    [-17, 17].forEach(x => {
      box(x, 5.55, z, 0.05, 0.6, 0.05, C.goldDark);
      ebox(x, 5.1, z, 0.42, 0.42, 0.42, 0xffe4b0);
      glow(x, 0.07, z, 7, 0xffc880);
    });
  }
  for (let x = -15; x <= 15; x += 7.5) {
    [-17, 17].forEach(z => {
      box(x, 5.55, z, 0.05, 0.6, 0.05, C.goldDark);
      ebox(x, 5.1, z, 0.42, 0.42, 0.42, 0xffe4b0);
      glow(x, 0.07, z, 7, 0xffc880);
    });
  }

  /* ══════════════════════════════════════════════════════════
     14 · ROOM DEFINITIONS
     ══════════════════════════════════════════════════════════ */
  const rooms = [];
  const WZ = [-27, -19, -9.5, 0, 9.5, 19, 27];
  for (let i = 0; i < 6; i++) rooms.push({ x0: -33, z0: WZ[i], x1: -19, z1: WZ[i + 1], side: "W" });
  for (let i = 0; i < 6; i++) rooms.push({ x0:  19, z0: WZ[i], x1:  33, z1: WZ[i + 1], side: "E" });
  const NX = [-19, -9.5, 0, 9.5, 19];
  for (let i = 0; i < 4; i++) rooms.push({ x0: NX[i], z0: -27, x1: NX[i + 1], z1: -19, side: "N" });
  const SX = [-19, -12, -5, 5, 12, 19];
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue;
    rooms.push({ x0: SX[i], z0: 19, x1: SX[i + 1], z1: 27, side: "S" });
  }

  /* ══════════════════════════════════════════════════════════
     15 · FURNITURE PRIMITIVES
     ══════════════════════════════════════════════════════════ */
  function desk(x, z, w, d) {
    box(x, 0.75, z, w, 0.1, d, C.wood);
    box(x - w / 2 + 0.09, 0.37, z, 0.14, 0.75, d, C.woodDark);
    box(x + w / 2 - 0.09, 0.37, z, 0.14, 0.75, d, C.woodDark);
    box(x, 0.68, z, w * 0.55, 0.06, d * 0.8, C.goldDark);
    /* WORK use point in front of the desk */
    USES.push({ kind: "work", label: "WORK", x, z: z + d / 2 + 0.7, y: 0, level: 0, r: 1.4 });
  }
  function chair(x, z, ry) {
    box(x, 0.46, z, 0.56, 0.1, 0.56, C.fabricDeep, 0, ry || 0, 0);
    box(x, 0.78, z, 0.56, 0.58, 0.09, C.fabricDeep, 0, ry || 0, 0);
    box(x, 0.23, z, 0.11, 0.46, 0.11, C.metal);
    box(x, 0.03, z, 0.52, 0.05, 0.52, C.metal);
    SEATS.push({ type: "sit", label: "SIT", x, z, yaw: ry || 0, h: 0.48, level: 0, taken: false });
  }
  function shelf(x, z, w, d, h, ry) {
    box(x, h / 2, z, w, h, d, C.woodDark, 0, ry || 0, 0);
    for (let i = 1; i < 4; i++)
      box(x, i * h / 4, z + (ry ? 0 : 0.02), w * 1.01, 0.06, d * 1.02, C.wood, 0, ry || 0, 0);
    for (let i = 0; i < 9; i++) {
      box(x + (Math.random() - 0.5) * w * 0.8, 0.55 + Math.floor(Math.random() * 3) * h / 4,
          z, 0.09, 0.5 + Math.random() * 0.2, d * 0.7,
          [0x8a3a3a, 0x2f5a3a, 0x3a3f6a, 0x8a7238][i % 4]);
    }
    USES.push({ kind: "read", label: "READ", x, z: z + 1.4, y: 0, level: 0, r: 1.2 });
  }
  function sofa(x, z, w, ry) {
    box(x, 0.32, z, w, 0.34, 1.0, C.crimson, 0, ry || 0, 0);
    box(x, 0.72, z - 0.42, w, 0.62, 0.28, C.crimson, 0, ry || 0, 0);
    box(x - w / 2 + 0.14, 0.6, z, 0.28, 0.6, 1.0, C.crimson, 0, ry || 0, 0);
    box(x + w / 2 - 0.14, 0.6, z, 0.28, 0.6, 1.0, C.crimson, 0, ry || 0, 0);
    /* Three seats across the sofa */
    const n = Math.max(2, Math.round(w / 0.8));
    for (let i = 0; i < n; i++) {
      const fx = x - w / 2 + (i + 0.5) * (w / n);
      SEATS.push({ type: "sit", label: "SIT", x: fx, z, yaw: ry || 0, h: 0.5, level: 0, taken: false });
    }
  }
  function plant(x, z) {
    cyl(x, 0.24, z, 0.34, 0.48, C.stoneDark);
    cyl(x, 0.5, z, 0.28, 0.1, C.woodDark);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      box(x + Math.cos(a) * 0.34, 1.05 + Math.random() * 0.3, z + Math.sin(a) * 0.34,
          0.55, 0.06, 0.16, C.green, 0.3, -a, 0.5);
    }
    box(x, 1.15, z, 0.5, 0.5, 0.5, C.greenDark);
  }
  function table(x, z, w, d, h) {
    h = h || 0.74;
    box(x, h, z, w, 0.09, d, C.wood);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      box(x + sx * (w / 2 - 0.14), h / 2, z + sz * (d / 2 - 0.14), 0.11, h, 0.11, C.woodDark);
    });
  }

  /* ══════════════════════════════════════════════════════════
     16 · FURNISH ROOMS
     ══════════════════════════════════════════════════════════ */
  function furnishRoom(r, idx) {
    const { x0, z0, x1, z1, side } = r;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = x1 - x0, d = z1 - z0;
    const type = idx % 5;

    const carpetCol = [C.fabric, C.crimson, C.fabricDeep, C.fabric, C.crimson][type];
    box(cx, 0.025, cz, w * 0.66, 0.05, d * 0.66, carpetCol);

    ebox(cx, RH - 0.09, cz, Math.min(w * 0.44, 3.4), 0.12, Math.min(d * 0.44, 3.4), 0xfff2d8);
    glow(cx, 0.09, cz, Math.max(w, d) * 0.55, 0xffc880);

    const winC = 0x3d5c84;
    if (side === "W") ebox(-32.62, 2.5, cz, 0.16, 2.6, Math.min(d * 0.62, 4.6), winC);
    if (side === "E") ebox( 32.62, 2.5, cz, 0.16, 2.6, Math.min(d * 0.62, 4.6), winC);
    if (side === "N") ebox(cx, 2.5, -26.62, Math.min(w * 0.62, 4.6), 2.6, 0.16, winC);
    if (side === "S") ebox(cx, 2.5,  26.62, Math.min(w * 0.62, 4.6), 2.6, 0.16, winC);

    if (type === 0) {
      desk(cx, cz, 2.6, 1.15);
      chair(cx, cz + 1.0);
      shelf(cx - w * 0.28, cz - d * 0.30, 2.0, 0.5, 2.4);
      box(cx + w * 0.26, 0.55, cz - d * 0.30, 1.3, 1.1, 0.55, C.woodDark);
      plant(cx + w * 0.30, cz + d * 0.28);
    } else if (type === 1) {
      table(cx, cz, w * 0.62, d * 0.42, 0.76);
      for (let i = 0; i < 3; i++) {
        chair(cx - w * 0.22 + i * (w * 0.22), cz - d * 0.30);
        chair(cx - w * 0.22 + i * (w * 0.22), cz + d * 0.30, Math.PI);
      }
      ebox(cx, 2.6, cz - d * 0.42, 2.2, 1.3, 0.12, 0x7fb0ff);
      box(cx, 1.85, cz - d * 0.42, 2.4, 0.2, 0.2, C.dark);
    } else if (type === 2) {
      sofa(cx - w * 0.22, cz - d * 0.18, w * 0.44, 0);
      sofa(cx + w * 0.22, cz + d * 0.18, w * 0.44, Math.PI);
      table(cx, cz, 1.4, 0.9, 0.42);
      plant(cx - w * 0.32, cz + d * 0.30);
      plant(cx + w * 0.32, cz - d * 0.30);
    } else if (type === 3) {
      shelf(cx, cz - d * 0.34, w * 0.7, 0.55, 3.0);
      shelf(cx - w * 0.30, cz, 0.55, d * 0.5, 3.0, 0);
      table(cx + w * 0.12, cz + d * 0.10, 2.0, 1.0, 0.74);
      chair(cx + w * 0.12, cz + d * 0.10 + 0.9);
      chair(cx + w * 0.12, cz + d * 0.10 - 0.9, Math.PI);
    } else {
      table(cx, cz, w * 0.72, d * 0.40, 0.78);
      for (let i = 0; i < 4; i++) {
        chair(cx - w * 0.27 + i * (w * 0.18), cz - d * 0.30);
        chair(cx - w * 0.27 + i * (w * 0.18), cz + d * 0.30, Math.PI);
      }
      cyl(cx, RH - 0.7, cz, 0.05, 0.9, C.goldDark);
      ebox(cx, RH - 1.3, cz, 0.5, 0.5, 0.5, 0xffe8bc);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        ebox(cx + Math.cos(a) * 0.9, RH - 1.25, cz + Math.sin(a) * 0.9, 0.18, 0.26, 0.18, 0xfff0cc);
      }
    }

    /* Room label — a floating text we DON'T add. The HUD's crumb
       shows the title. */
  }
  rooms.forEach((r, i) => furnishRoom(r, i));

  /* ══════════════════════════════════════════════════════════
     17 · ATRIUM DECOR
     ══════════════════════════════════════════════════════════ */
  box(0, 0.02, 17, 3.4, 0.04, 20, C.carpetRed);
  box(-0.9, 0.045, 17, 0.16, 0.02, 20, C.gold);
  box( 0.9, 0.045, 17, 0.16, 0.02, 20, C.gold);

  [[-11, -11], [11, -11], [-11, 11], [11, 11], [0, -12.5], [0, 12.5]].forEach(([x, z]) => {
    cyl(x, 0.42, z, 0.7, 0.84, C.stoneLight);
    cyl(x, 0.86, z, 0.6, 0.12, C.stoneDark);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      box(x + Math.cos(a) * 0.75, 1.35, z + Math.sin(a) * 0.75,
          1.0, 0.08, 0.34, C.green, 0.35, -a, 0.55);
    }
    box(x, 1.5, z, 0.85, 0.85, 0.85, C.greenDark);
    SOLID.push({ x0: x - 0.85, x1: x + 0.85, z0: z - 0.85, z1: z + 0.85, y0: 0, y1: 1.5 });
  });

  [-10, 0, 10].forEach(z => {
    [-17, 17].forEach(x => {
      box(x, 0.42, z, 1.0, 0.14, 2.4, C.wood);
      box(x - 0.35, 0.2, z, 0.14, 0.42, 2.2, C.woodDark);
      box(x + 0.35, 0.2, z, 0.14, 0.42, 2.2, C.woodDark);
      SEATS.push({ type: "sit", label: "SIT", x, z, yaw: 0, h: 0.52, level: 0, taken: false });
      SOLID.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 1.2, z1: z + 1.2, y0: 0, y1: 0.5 });
    });
  });
  [-10, 0, 10].forEach(x => {
    [-17, 17].forEach(z => {
      box(x, 0.42, z, 2.4, 0.14, 1.0, C.wood);
      box(x, 0.2, z - 0.35, 2.2, 0.42, 0.14, C.woodDark);
      box(x, 0.2, z + 0.35, 2.2, 0.42, 0.14, C.woodDark);
      SEATS.push({ type: "sit", label: "SIT", x, z, yaw: 0, h: 0.52, level: 0, taken: false });
      SOLID.push({ x0: x - 1.2, x1: x + 1.2, z0: z - 0.6, z1: z + 0.6, y0: 0, y1: 0.5 });
    });
  });

  [-6.6, 6.6].forEach(x => {
    cyl(x, 0.9, 26.2, 0.9, 1.8, C.stoneLight);
    cyl(x, 1.85, 26.2, 1.1, 0.2, C.gold);
    cyl(x, 0.15, 26.2, 1.0, 0.3, C.stoneDark);
    SOLID.push({ x0: x - 1.0, x1: x + 1.0, z0: 26.2 - 1.0, z1: 26.2 + 1.0, y0: 0, y1: 1.8 });
  });

  /* ══════════════════════════════════════════════════════════
     18 · TERRACE · GARDEN · OUTDOOR POOL
     ══════════════════════════════════════════════════════════ */
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ color: 0x1a2620 })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = TY - 0.35;
  scene.add(groundMesh);

  box(0, TY - TS / 2, 30.5, 80, TS, 7, C.stoneDark);
  box(0, TY - TS / 2, 48, 80, TS, 8, C.stoneDark);
  box(-25.5, TY - TS / 2, 39, 29, TS, 10, C.stoneDark);
  box( 25.5, TY - TS / 2, 39, 29, TS, 10, C.stoneDark);

  box(0, TY - 1.3, 39, 22, 1.3, 10, 0x0b2c3c);
  const outWater = new THREE.Mesh(
    new THREE.PlaneGeometry(21.6, 9.6),
    new THREE.MeshPhongMaterial({
      map: waterTex, color: 0x7fd0f0, transparent: true, opacity: 0.8,
      shininess: 130, specular: 0xffffff, depthWrite: false,
    })
  );
  outWater.rotation.x = -Math.PI / 2;
  outWater.position.set(0, TY - 0.28, 39);
  scene.add(outWater);

  box(0, TY + 0.02, 33.6, 22.8, 0.12, 0.7, C.stoneLight);
  box(0, TY + 0.02, 44.4, 22.8, 0.12, 0.7, C.stoneLight);
  box(-11.2, TY + 0.02, 39, 0.7, 0.12, 10, C.stoneLight);
  box( 11.2, TY + 0.02, 39, 0.7, 0.12, 10, C.stoneLight);

  for (let i = 0; i < 6; i++) {
    ebox(-9 + i * 3.6, TY - 0.9, 39, 0.5, 0.25, 0.5, 0x7fe0ff);
    glow(-9 + i * 3.6, TY - 0.25, 39, 8, 0x60d0ff);
  }

  function palm(x, z, h) {
    for (let i = 0; i < 5; i++) {
      cyl(x + Math.sin(i * 0.7) * 0.16, TY + (i + 0.5) * h / 5, z + Math.cos(i * 0.7) * 0.16,
          0.26 - i * 0.028, h / 5, 0x5b4326);
    }
    const topY = TY + h;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.4;
      box(x + Math.cos(a) * 1.5, topY + 0.25, z + Math.sin(a) * 1.5,
          3.3, 0.09, 0.75, i % 2 ? C.green : C.greenDark, 0, -a, -0.34);
    }
    box(x, topY + 0.1, z, 0.5, 0.5, 0.5, 0x3a2a18);
    SOLID.push({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4, y0: 0, y1: h });
  }
  [[-16, 31], [16, 31], [-16, 47], [16, 47], [-24, 39], [24, 39]].forEach(([x, z]) =>
    palm(x, z, 7.5 + Math.random() * 1.6));

  for (let i = 0; i < 6; i++) {
    const x = -18 + i * 7.2, z = 30.5;
    cyl(x, TY + 1.6, z, 0.11, 3.2, 0x2a2a2e);
    cyl(x, TY + 3.3, z, 0.32, 0.36, C.goldDark);
    ebox(x, TY + 3.3, z, 0.48, 0.48, 0.48, 0xffe0a0);
    glow(x, TY + 0.06, z, 9, 0xffc070);
  }
  for (let i = 0; i < 4; i++) {
    const x = -14 + i * 9.3, z = 47.5;
    cyl(x, TY + 1.6, z, 0.11, 3.2, 0x2a2a2e);
    cyl(x, TY + 3.3, z, 0.32, 0.36, C.goldDark);
    ebox(x, TY + 3.3, z, 0.48, 0.48, 0.48, 0xffe0a0);
    glow(x, TY + 0.06, z, 9, 0xffc070);
  }

  [-14, -9.5, 9.5, 14].forEach(x => {
    box(x, TY + 0.28, 47, 1.1, 0.16, 2.6, C.white);
    box(x, TY + 0.62, 48.1, 1.1, 0.5, 0.14, C.white, -0.4, 0, 0);
    box(x, TY + 0.1, 46.2, 0.9, 0.2, 0.16, C.metal);
    box(x, TY + 0.1, 47.8, 0.9, 0.2, 0.16, C.metal);
    SEATS.push({ type: "lie", label: "LIE DOWN", x, z: 47.4, yaw: 0, h: TY + 0.42, level: 0, taken: false });
    SOLID.push({ x0: x - 0.55, x1: x + 0.55, z0: 46.4, z1: 48.6, y0: TY, y1: TY + 0.6 });
  });

  for (let i = 0; i < 22; i++) {
    const x = -40 + i * 3.8;
    box(x, TY + 0.55, 52, 3.4, 1.1, 1.0, i % 2 ? C.green : C.greenDark);
  }
  box(-40.4, TY + 0.55, 39.5, 1.0, 1.1, 26, C.greenDark);
  box( 40.4, TY + 0.55, 39.5, 1.0, 1.1, 26, C.greenDark);

  [-1, 1].forEach(s => {
    for (let i = 0; i < 3; i++) {
      const x = s * (12 + i * 7);
      cyl(x, TY + 0.9, 28.4, 0.09, 1.8, 0x2a2a2e);
      ebox(x, TY + 1.9, 28.4, 0.36, 0.36, 0.36, 0xffe0a0);
      glow(x, TY + 0.06, 28.4, 6, 0xffc070);
    }
  });

  /* Outdoor pool edge (rectangle collider, not walkable) */
  SOLID.push({ x0: -11.6, x1: 11.6, z0: 33.4, z1: 44.6, y0: 0, y1: 0.6 });
  SOLID.push({ x0: -41, x1: -39.6, z0: 26, z1: 53, y0: 0, y1: 1.2 });
  SOLID.push({ x0: 39.6, x1: 41, z0: 26, z1: 53, y0: 0, y1: 1.2 });
  SOLID.push({ x0: -41, x1: 41, z0: 51.4, z1: 53, y0: 0, y1: 1.2 });

  /* ══════════════════════════════════════════════════════════
     19 · BUILD INSTANCED MESHES
     ══════════════════════════════════════════════════════════ */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false);
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  quadGeo.rotateX(-Math.PI / 2);

  function buildInstanced(data, geo, mat, hasColor) {
    if (!data.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, data.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < data.length; i++) {
      const o = data[i];
      if (geo === cylGeo) {
        v.set(o.x, o.y, o.z);
        s.set(o.r * 2, o.h, o.r * 2);
        q.identity();
      } else if (geo === quadGeo) {
        v.set(o.x, o.y, o.z);
        s.set(o.s, 1, o.s);
        q.identity();
      } else {
        e.set(o.rx, o.ry, o.rz);
        q.setFromEuler(e);
        v.set(o.x, o.y, o.z);
        s.set(o.w, o.h, o.d);
      }
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
      if (hasColor) mesh.setColorAt(i, col.setHex(o.c));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  const litMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const emiMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, color: 0xffffff, fog: true,
  });

  buildInstanced(B,  boxGeo, litMat, true);
  buildInstanced(E,  boxGeo, emiMat, true);
  buildInstanced(CY, cylGeo, litMat, true);
  buildInstanced(GL, quadGeo, glowMat, true);

  /* ══════════════════════════════════════════════════════════
     20 · LIGHTS
     ══════════════════════════════════════════════════════════ */
  scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x3b3026, 1.15));
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.0);
  sun.position.set(46, 62, -34);
  scene.add(sun);
  const atriumLamp = new THREE.PointLight(0xffb268, 9, 62, 1.3);
  atriumLamp.position.set(0, 7.6, 0);
  scene.add(atriumLamp);
  const fill = new THREE.PointLight(0x88b8ff, 4.5, 70, 1.4);
  fill.position.set(0, 4, 30);
  scene.add(fill);

  /* ══════════════════════════════════════════════════════════
     21 · WORLD + CONTROLS
     ══════════════════════════════════════════════════════════ */
  /* ThirdPersonControls reads colliders as { minX,maxX,minZ,maxZ,level,y0,y1 }.
     The solids above were written as { x0,x1,z0,z1 } with no level, so the
     controller skipped every one of them — that is why you could walk through
     the walls, columns, desks and pool. Convert them here.
     Low blockers (≤ 1.8 m tall, resting on the floor) drop y0 so they BLOCK
     instead of turning into step-up platforms. */
  SOLID.forEach((c) => {
    c.minX = c.x0; c.maxX = c.x1; c.minZ = c.z0; c.maxZ = c.z1;
    c.level = 0;
    if ((c.y1 - c.y0) <= 1.8 && c.y0 <= 0.3) delete c.y0;
  });

  const world = {
    colliders: SOLID,
    seats: SEATS,
    uses: USES,
    platforms: [],
    levelHeight: () => 0,
    ceilingHeight: WH,
    bounds: { minX: -46, maxX: 46, minZ: -32, maxZ: 53 },
  };

  // Location-specific perimeter and access-road lamps; StreetLights switches them on at dusk.
  const govhouseLampSpots = [];
  for (const [lx,lz] of [[-38, -24],[-18,-24],[0,-24],[18,-24],[38,-24],[-38,0],[38,0],[-38,28],[-18,28],[0,28],[18,28],[38,28]]) {
    govhouseLampSpots.push(addStreetLamp(scene, lx, 0, lz, Math.PI));
  }
  addNightGlow(scene, govhouseLampSpots, { poolRadius: 16 });

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene,
    x: 0, z: 23, yaw: 0, level: 0,
    speedMult: 1.15,
    camDist: 4.2,
    onUse: (use) => {
      if (use.kind === "work") {
        if (window.__ph3d_phone) window.__ph3d_phone._toast("You work at the desk");
      } else if (use.kind === "read") {
        if (window.__ph3d_phone) window.__ph3d_phone._toast("You read the files");
      } else if (window.__ph3d_phone) {
        window.__ph3d_phone._toast(use.label || "USE");
      }
    },
  });

  window.__ph3d_walkCtrl = ctl;

  /* ══════════════════════════════════════════════════════════
     22 · RETURN
     ══════════════════════════════════════════════════════════ */
  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "GOVERNMENT HOUSE",
    title: "STATE SECRETARIAT",
    subtitle: "GRAND ATRIUM · EAST WING",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "govhouse",
    update: (dt) => {
      ctl.update(dt);
      waterTex.offset.x = (waterTex.offset.x + dt * 0.016) % 1;
      waterTex.offset.y = (waterTex.offset.y + dt * 0.011) % 1;
      const t = performance.now() * 0.001;
      atriumLamp.intensity = 9 + Math.sin(t * 1.7) * 0.45 + Math.sin(t * 4.1) * 0.2;
    },
    dispose: () => {
      ctl.dispose();
    },
  };
}
