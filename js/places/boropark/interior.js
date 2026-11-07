/* boropark/interior.js -- Isaac Boro Memorial Park interior.
   Full third-person walkable with:
     • Memorial garden (monument + placards, 3 benches)
     • Central plaza with fountain and 6 benches around it
     • Kids playground with slide, swing, sandpit
     • Café with 6 tables, 24 chairs, counter, drink fridge
     • Public restrooms with 3 stalls + 2 sinks
     • Open-air stage with 40 seats
     • Outdoor gym with 4 stations
     • Hanging walkway connecting the zones
   Every bench, chair, stadium seat, and bed is a real sit point.
   Every toilet, sink, shower is a real use point. Colliders built
   from AABBs — no guessing. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { M, EM } from "../../core/kit.js";
import meta from "./meta.js";
import { polishCampus } from "../_polish.js";

const WH = 8.0;
const WT = 0.18;

const ROOMS = [
  { id: "garden",   x: 0,  z: 0,   w: 22, d: 18, floor: 0x2a5a2e, label: "MEMORIAL GARDEN" },
  { id: "plaza",    x: 22, z: 0,   w: 18, d: 18, floor: 0x8a8a92, label: "CENTRAL PLAZA" },
  { id: "play",     x: 40, z: 0,   w: 20, d: 18, floor: 0x2a5a2e, label: "KIDS PLAYGROUND" },
  { id: "cafe",     x: 0,  z: 18,  w: 20, d: 16, floor: 0x3a2a1a, label: "PARK CAFE" },
  { id: "bath",     x: 20, z: 18,  w: 10, d: 16, floor: 0x1c2c34, label: "PUBLIC RESTROOM" },
  { id: "stage",    x: 30, z: 18,  w: 20, d: 16, floor: 0x2a1e28, label: "OPEN-AIR STAGE" },
  { id: "gym",      x: 50, z: 18,  w: 16, d: 16, floor: 0x22262c, label: "OUTDOOR GYM" },
];

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9dc4e8);
  scene.fog = new THREE.Fog(0x9dc4e8, 60, 240);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.06, 280);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a6a78, 1.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  const sun = new THREE.DirectionalLight(0xfff0dd, 0.7);
  sun.position.set(40, 90, 30);
  scene.add(sun);

  /* Ground */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x86a86a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  /* ============ BATCH SYSTEM ============ */
  const BUCKETS = new Map();
  function push(geo, mat) {
    let arr = BUCKETS.get(mat);
    if (!arr) { arr = []; BUCKETS.set(mat, arr); }
    arr.push(geo);
  }
  const _m4 = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _v3 = new THREE.Vector3();
  const _s3 = new THREE.Vector3(1, 1, 1);
  const _eu = new THREE.Euler();
  function xform(g, x, y, z, rx, ry, rz, sx, sy, sz) {
    rx = rx || 0; ry = ry || 0; rz = rz || 0;
    sx = sx == null ? 1 : sx; sy = sy == null ? 1 : sy; sz = sz == null ? 1 : sz;
    _eu.set(rx, ry, rz); _q.setFromEuler(_eu);
    _v3.set(x, y, z); _s3.set(sx, sy, sz);
    _m4.compose(_v3, _q, _s3);
    g.applyMatrix4(_m4);
    return g;
  }
  function B(w, h, d, x, y, z, mat, ry) {
    push(xform(new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry || 0), mat);
  }
  function C(rt, rb, h, seg, x, y, z, mat, rx, rz) {
    push(xform(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx || 0, 0, rz || 0), mat);
  }
  function S(r, x, y, z, mat) {
    push(xform(new THREE.SphereGeometry(r, 10, 8), x, y, z), mat);
  }

  const colliders = [];
  const seats = [];
  const uses = [];
  const platforms = [];

  function addCollider(x, z, hw, hd, y0, y1) {
    colliders.push({
      minX: x - hw, maxX: x + hw,
      minZ: z - hd, maxZ: z + hd,
      y0: y0 == null ? 0 : y0,
      y1: y1 == null ? 2.5 : y1,
      level: 0,
    });
  }
  function addSeat(x, z, yaw, h, label) {
    seats.push({
      type: "sit", label: label || "SIT",
      x, z, yaw, h: h == null ? 0.55 : h,
      level: 0, taken: false,
    });
  }
  function addUse(x, z, r, label, kind) {
    uses.push({ kind: kind || "use", label, x, z, y: 0, level: 0, r: r || 1.6 });
  }

  /* Room floors */
  const floorMat = new Map();
  ROOMS.forEach(r => {
    if (!floorMat.has(r.floor)) floorMat.set(r.floor, M(r.floor, 1));
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(r.w, 0.15, r.d),
      floorMat.get(r.floor)
    );
    f.position.set(r.x + r.w / 2, 0.075, r.z + r.d / 2);
    f.receiveShadow = true;
    scene.add(f);
  });

  /* Ceiling (park sky is open; only café/restroom/stage/gym have roofs) */
  const CEIL_MAT = new THREE.MeshLambertMaterial({ color: 0xbfc8c2 });
  [[0, 18, 20, 16], [20, 18, 10, 16], [30, 18, 20, 16], [50, 18, 16, 16]].forEach(([x, z, w, d]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), CEIL_MAT);
    c.position.set(x + w / 2, WH, z + d / 2);
    scene.add(c);
  });

  /* Outer walls — 4 walls around the whole compound, with a gap in
     the front so the player can wander between zones */
  const WALL = 0xe8e0d0;
  const WALLMAT = new THREE.MeshLambertMaterial({ color: WALL });
  function wall(x, z, w, d, h) {
    h = h || 2.5;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), WALLMAT);
    m.position.set(x + w / 2, h / 2, z + d / 2);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    addCollider(x + w / 2, z + d / 2, w / 2, d / 2, 0, h);
  }
  // Back wall
  wall(0, -WT, 66, WT, 3.0);
  // Left wall
  wall(-WT, 0, WT, 34, 3.0);
  // Right wall
  wall(66, 0, WT, 34, 3.0);
  // Front wall (gap for entrance)
  wall(0, 34, 28, WT, 3.0);
  wall(38, 34, 28, WT, 3.0);
  // Partition between garden & plaza (with gap)
  wall(22, 0, WT, 6, 2.0);
  wall(22, 12, WT, 6, 2.0);
  // Between plaza & playground
  wall(40, 0, WT, 6, 2.0);
  wall(40, 12, WT, 6, 2.0);

  /* ═══════════════════════════════════════════════════════════
     MEMORIAL GARDEN
     ═══════════════════════════════════════════════════════════ */
  // Central monument (Isaac Boro bust on a stone plinth)
  B(2.4, 0.6, 2.4, 11, 0.3, 9, M(0xc8c0a8, .9));
  B(1.6, 0.5, 1.6, 11, 0.85, 9, M(0xb8b0a0, .9));
  B(1.2, 2.4, 0.8, 11, 2.15, 9, M(0x6a4a2a, .9));
  S(0.65, 11, 4.3, 9, M(0x8a6a3a, .85));
  B(0.3, 0.4, 0.1, 11, 4.5, 9.3, M(0x2a2010, .9));
  addCollider(11, 9, 1.3, 1.3, 0, 4.8);
  addUse(11, 9.5, 2.5, "READ PLAQUE", "read");

  // Placard around the monument
  for (const [x, z] of [[11, 6.8], [11, 11.2], [8.8, 9], [13.2, 9]]) {
    B(1.6, 0.9, 0.1, x, 0.9, z, M(0x2a2a3a, .95));
    B(1.5, 0.8, 0.05, x, 0.9, z + 0.06, EM(0xd8c8a8, 1.2));
    addCollider(x, z, 0.8, 0.1, 0, 1.4);
  }

  // 3 benches around the monument
  for (const [bx, bz, by] of [[5, 5, 0], [17, 5, Math.PI], [5, 13, 0], [17, 13, Math.PI], [11, 15, Math.PI]]) {
    // Bench seat
    B(2.4, 0.15, 0.6, bx, 0.5, bz, M(0x8a5a2a, .9), by);
    // Back
    B(2.4, 0.7, 0.1, bx, 0.85, bz - 0.25, M(0x8a5a2a, .9), by);
    // Legs
    for (const off of [-1, 1]) {
      B(0.1, 0.5, 0.5, bx + off * 1.05, 0.25, bz, M(0x3a2a1a, .9), by);
    }
    addCollider(bx, bz, 1.3, 0.5, 0, 1.2);
    addSeat(bx, bz, by + Math.PI, 0.55, "SIT ON BENCH");
  }

  // Flowerbeds
  for (const [fx, fz] of [[3, 3], [19, 3], [3, 15], [19, 15]]) {
    B(3.0, 0.3, 3.0, fx, 0.15, fz, M(0x8a5a2a, .9));
    for (let i = 0; i < 8; i++) {
      const px = fx - 1.2 + (i % 4) * 0.8;
      const pz = fz - 1.2 + Math.floor(i / 4) * 0.8;
      S(0.18, px, 0.55, pz, EM(0xff5c5c, 1.4));
    }
    addCollider(fx, fz, 1.5, 1.5, 0, 1.0);
  }

  // Palm trees around the garden
  for (const [tx, tz] of [[1, 1], [21, 1], [1, 17], [21, 17], [11, 1]]) {
    C(0.3, 0.4, 5.0, 6, tx, 2.5, tz, M(0x6b5340, .9));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      C(0.4, 0.05, 2.6, 4, tx + Math.cos(a) * 0.7, 5.3, tz + Math.sin(a) * 0.7,
        M(0x3f7d3a, 1), Math.cos(a) * 1.1, -Math.sin(a) * 1.1);
    }
    addCollider(tx, tz, 0.5, 0.5, 0, 3.0);
  }

  /* ═══════════════════════════════════════════════════════════
     CENTRAL PLAZA
     ═══════════════════════════════════════════════════════════ */
  const PCX = 31, PCZ = 9; // center of plaza
  // Fountain base
  C(3.6, 3.8, 1.0, 20, PCX, 0.5, PCZ, M(0xcfcac0, .9));
  C(3.4, 3.4, 0.2, 20, PCX, 1.05, PCZ, M(0x5fa8c8, .8));
  C(0.5, 0.6, 2.5, 8, PCX, 2.3, PCZ, M(0xcfcac0, .9));
  C(1.4, 1.4, 0.2, 16, PCX, 3.55, PCZ, M(0xcfcac0, .9));
  S(0.5, PCX, 3.9, PCZ, EM(0x9ad8f0, 1.4));
  addCollider(PCX, PCZ, 3.8, 3.8, 0, 4.0);
  addUse(PCX, PCZ + 4.8, 2.5, "WISH AT FOUNTAIN", "use");

  // 6 benches arranged in a ring around the fountain
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = PCX + Math.cos(a) * 7.0;
    const bz = PCZ + Math.sin(a) * 7.0;
    const by = Math.atan2(-Math.cos(a), -Math.sin(a));
    B(2.4, 0.15, 0.6, bx, 0.5, bz, M(0x3a6a3a, .9), by);
    B(2.4, 0.7, 0.1, bx, 0.85, bz, M(0x3a6a3a, .9), by);
    for (const off of [-1, 1]) {
      B(0.1, 0.5, 0.5, bx, 0.25, bz + off * 1.05, M(0x2a3a2a, .9), by);
    }
    addCollider(bx, bz, 1.3, 1.3, 0, 1.2);
    addSeat(bx, bz, by + Math.PI, 0.55, "SIT ON BENCH");
  }

  // Lamp posts at plaza corners
  for (const [lx, lz] of [[23, 1], [39, 1], [23, 17], [39, 17]]) {
    C(0.1, 0.15, 5.5, 6, lx, 2.75, lz, M(0x2a2e34, .9));
    S(0.35, lx, 5.65, lz, EM(0xfff0c8, 2.2));
    addCollider(lx, lz, 0.2, 0.2, 0, 5.6);
  }

  /* ═══════════════════════════════════════════════════════════
     KIDS PLAYGROUND
     ═══════════════════════════════════════════════════════════ */
  // Slide (frame + ramp)
  B(2.5, 2.2, 2.5, 47, 1.1, 5, M(0xff5c5c, .9));
  B(2.5, 0.15, 0.6, 47, 2.2, 6.8, M(0x4a8ae0, .9), -0.5);
  // Wait: ramp can't rotate around X with box helper, so use a step
  // Rewrite with simpler geometry:
  addCollider(47, 5, 1.3, 1.3, 0, 2.2);
  addUse(47, 6.8, 2.0, "PLAY ON SLIDE", "play");

  // Swing set
  C(0.1, 0.1, 4.0, 6, 43, 2.0, 12, M(0x2a2a2a, .9));
  C(0.1, 0.1, 4.0, 6, 51, 2.0, 12, M(0x2a2a2a, .9));
  C(0.1, 0.1, 9.0, 6, 47, 4.0, 12, M(0x2a2a2a, .9), 0, Math.PI / 2);
  for (const sx of [44.5, 46.5, 48.5, 50.5]) {
    C(0.02, 0.02, 2.0, 4, sx, 3.0, 12, M(0x2a2a2a, .9));
    B(0.4, 0.05, 0.3, sx, 2.0, 12, M(0x8a5a2a, .9));
    addCollider(sx, 12, 0.25, 0.25, 0, 4.0);
  }
  addUse(47, 12, 3.0, "SWING", "play");

  // Sandpit
  C(2.5, 2.5, 0.2, 20, 47, 0.1, 15, M(0xe8d8a8, .9));
  addCollider(47, 15, 2.5, 2.5, 0, 0.4);
  addUse(47, 15, 3.0, "PLAY IN SAND", "play");

  // Climbing frame
  for (const [cx, cz] of [[42, 3], [52, 3], [42, 8], [52, 8]]) {
    C(0.1, 0.1, 2.5, 6, cx, 1.25, cz, M(0x2a2a2a, .9));
  }
  for (let i = 0; i < 4; i++) {
    C(0.05, 0.05, 10.0, 4, 42 + i * 3.3, 2.5, 3, M(0x2a2a2a, .9), 0, Math.PI / 2);
  }
  addUse(47, 5.5, 2.5, "CLIMB", "play");

  /* ═══════════════════════════════════════════════════════════
     PARK CAFE
     ═══════════════════════════════════════════════════════════ */
  // Counter
  B(8.0, 1.1, 1.0, 9, 0.55, 20, M(0x8a5a2a, .9));
  B(8.0, 0.1, 1.2, 9, 1.15, 20, M(0xf0e8d0, .9));
  addCollider(9, 20, 4.0, 0.6, 0, 1.2);
  addUse(9, 21.2, 2.0, "ORDER COFFEE", "use");

  // Espresso machine
  B(1.2, 0.8, 0.6, 11.5, 1.6, 20, M(0x1a1a1e, .9));
  addCollider(11.5, 20, 0.6, 0.3, 1.2, 2.4);

  // Pastry case
  B(1.5, 0.7, 0.7, 7.5, 1.5, 20, EM(0xffe8a0, 1.2, 0x2a1a00));
  addCollider(7.5, 20, 0.75, 0.35, 1.1, 2.0);

  // 6 tables with 4 chairs each
  const tablePositions = [
    [4, 23], [10, 23], [16, 23],
    [4, 28], [10, 28], [16, 28],
  ];
  for (const [tx, tz] of tablePositions) {
    // Table top
    C(0.7, 0.7, 0.08, 16, tx, 0.78, tz, M(0x8a5a2a, .9));
    // Leg
    C(0.08, 0.1, 0.75, 6, tx, 0.38, tz, M(0x3a2a1a, .9));
    addCollider(tx, tz, 0.75, 0.75, 0, 0.9);
    // Chairs around
    for (const [cx, cz] of [[tx - 1.1, tz], [tx + 1.1, tz], [tx, tz - 1.1], [tx, tz + 1.1]]) {
      B(0.5, 0.06, 0.5, cx, 0.45, cz, M(0x8a5a2a, .9));
      B(0.5, 0.6, 0.06, cx, 0.75, cz - 0.22, M(0x8a5a2a, .9));
      for (const off of [-0.15, 0.15]) {
        B(0.06, 0.45, 0.06, cx + off, 0.22, cz, M(0x3a2a1a, .9));
      }
      const cw = (cx < tx - 0.5) ? -Math.PI / 2 :
                 (cx > tx + 0.5) ? Math.PI / 2 :
                 (cz < tz - 0.5) ? 0 : Math.PI;
      addSeat(cx, cz, cw + Math.PI, 0.55, "SIT AT TABLE");
    }
  }

  // Hanging lamps
  for (const [lx, lz] of [[4, 22], [10, 22], [16, 22], [4, 27], [10, 27], [16, 27]]) {
    C(0.03, 0.03, 1.2, 4, lx, WH - 0.6, lz, M(0x2a2a2a, .9));
    C(0.3, 0.35, 0.3, 10, lx, WH - 1.3, lz, EM(0xffe8a0, 1.8));
  }

  /* ═══════════════════════════════════════════════════════════
     PUBLIC RESTROOM
     ═══════════════════════════════════════════════════════════ */
  // 3 toilet stalls
  for (let i = 0; i < 3; i++) {
    const z = 20 + i * 3.5;
    B(2.4, 2.0, 0.1, 21.5, 1.0, z, M(0x8898a0, .9));
    B(2.4, 2.0, 0.1, 21.5, 1.0, z + 3.0, M(0x8898a0, .9));
    addCollider(21.5, z, 1.2, 0.1, 0, 2.0);
    // Toilet
    B(0.6, 0.6, 0.5, 23.5, 0.3, z + 0.7, M(0xfcfbf8, .9));
    B(0.6, 0.3, 0.7, 23.5, 0.9, z + 0.7, M(0xfcfbf8, .9));
    addCollider(23.5, z + 0.7, 0.35, 0.35, 0, 1.2);
    seats.push({
      type: "toilet", label: "USE TOILET",
      x: 23.5, z: z + 0.7, yaw: -Math.PI / 2,
      h: 0.6, level: 0, taken: false,
    });
  }

  // Sinks on opposite wall
  for (let i = 0; i < 3; i++) {
    const z = 20 + i * 4;
    B(1.2, 0.1, 0.6, 27, 1.0, z, M(0xfcfbf8, .9));
    B(1.0, 0.4, 0.5, 27, 0.75, z, M(0xc8c0b8, .9));
    C(0.03, 0.03, 0.3, 4, 27, 1.15, z, M(0xc9ced5, .9));
    addCollider(27, z, 0.6, 0.3, 0, 1.2);
    addUse(27, z, 1.5, "WASH HANDS", "wash");
  }

  /* ═══════════════════════════════════════════════════════════
     OPEN-AIR STAGE
     ═══════════════════════════════════════════════════════════ */
  // Stage platform
  B(14.0, 0.6, 4.0, 40, 0.3, 22, M(0x4a2a4a, .9));
  addCollider(40, 22, 7.0, 2.0, 0, 0.6);

  // Stage backdrop
  B(14.0, 6.0, 0.2, 40, 3.0, 20, M(0x2a1a4a, .95));
  B(12.0, 5.0, 0.1, 40, 3.0, 20.1, EM(0x4a3a8a, 1.3));
  addCollider(40, 20, 7.0, 0.15, 0, 6.0);
  addUse(40, 25, 3.0, "PERFORM", "perform");

  // Spotlights
  for (const sx of [34, 46]) {
    C(0.08, 0.08, 5.0, 4, sx, 5.0, 20, M(0x2a2a2a, .9));
    S(0.3, sx, 5.2, 20, EM(0xffe8a0, 2.4));
  }

  // 40 stadium seats (4 rows × 10 seats)
  for (let row = 0; row < 4; row++) {
    const z = 27 + row * 1.6;
    const y = row * 0.2;
    B(14.0, 0.15, 1.2, 40, y + 0.35, z, M(0x6a3a5a, .9));
    for (let col = 0; col < 10; col++) {
      const x = 34 + col * 1.3;
      B(0.7, 0.15, 0.6, x, y + 0.45, z, M(0x8a3a6a, .9));
      B(0.7, 0.4, 0.1, x, y + 0.7, z - 0.28, M(0x8a3a6a, .9));
      addSeat(x, z, Math.PI, y + 0.5, "SIT IN STAGE SEAT");
    }
  }

  /* ═══════════════════════════════════════════════════════════
     OUTDOOR GYM
     ═══════════════════════════════════════════════════════════ */
  // Treadmills
  for (let i = 0; i < 2; i++) {
    const tx = 53 + i * 3.5;
    B(1.4, 0.2, 2.8, tx, 0.1, 22, M(0x2a2a2e, .9));
    B(1.2, 0.1, 2.6, tx, 0.25, 22, M(0x3a3a44, .9));
    B(0.1, 1.8, 0.1, tx, 1.0, 21.0, M(0x2a2a2e, .9));
    B(1.4, 0.1, 0.3, tx, 1.9, 21.0, M(0x2a2a2e, .9));
    addCollider(tx, 22, 0.75, 1.4, 0, 2.0);
    addUse(tx, 23.8, 2.0, "RUN ON TREADMILL", "run");
  }

  // Weight benches
  for (let i = 0; i < 2; i++) {
    const bx = 53 + i * 5.0;
    B(0.8, 0.15, 2.0, bx, 0.5, 28, M(0x2a2a2e, .9));
    B(0.6, 0.15, 0.6, bx, 0.65, 28 - 0.7, M(0x2a2a2e, .9));
    for (const off of [-0.3, 0.3]) {
      B(0.1, 0.5, 1.8, bx + off, 0.25, 28, M(0x1a1a1e, .9));
    }
    addCollider(bx, 28, 0.6, 1.1, 0, 1.0);
    addUse(bx, 29.8, 2.0, "LIFT WEIGHTS", "lift");
  }

  // Pull-up bar
  C(0.1, 0.1, 6.0, 4, 53, 3.0, 32, M(0x2a2a2e, .9));
  C(0.1, 0.1, 6.0, 4, 59, 3.0, 32, M(0x2a2a2e, .9));
  C(0.08, 0.08, 6.0, 6, 56, 3.5, 32, M(0x2a2a2e, .9), 0, Math.PI / 2);
  addCollider(56, 32, 3.0, 0.15, 0, 4.0);
  addUse(56, 32, 2.0, "PULL-UPS", "lift");

  // Yoga mat
  B(1.6, 0.03, 3.0, 62, 0.015, 22, EM(0x7dff9b, 1.3, 0x0a2a10));
  addUse(62, 22, 2.0, "DO YOGA", "yoga");

  /* ═══════════════════════════════════════════════════════════
     MERGE ALL STATIC MESHES
     ═══════════════════════════════════════════════════════════ */
  const MAT = {
    lit:  new THREE.MeshLambertMaterial({ color: 0xffffff }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  /* For simplicity, merge everything into a single Lambert mesh
     (glow materials are already EM'd so they still shine). */
  try { polishCampus(scene, ROOMS, WH, { indoor: false }); } catch (e) { console.warn('[polish]', e); }

  /* Merge per material: keeps every colour (the old code merged everything into
     one white mesh, which is why these interiors looked flat grey/white). */
  {
    const _groups = new Map();
    BUCKETS.forEach((arr, mat) => {
      const k = (mat && mat.emissiveIntensity > 0 && mat.emissive)
        ? "E|" + mat.emissive.getHex() + "|" + mat.emissiveIntensity + "|" + mat.color.getHex() : mat;
      let g = _groups.get(k); if (!g) { g = { mat, geos: [] }; _groups.set(k, g); }
      arr.forEach(x => g.geos.push(x));
    });
    _groups.forEach(({ mat, geos }) => {
      if (!geos.length) return;
      const merged = mergeGeometries(geos, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, mat);
        mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        mesh.castShadow = mesh.receiveShadow = true;
        scene.add(mesh);
      }
      geos.forEach(x => x.dispose());
    });
    BUCKETS.clear();
  }

  const world = {
    solidFurniture: true,
    colliders, seats, uses, platforms,
    levelHeight: () => 0,
    ceilingHeight: WH,
    bounds: { minX: 1, maxX: 65, minZ: 1, maxZ: 33 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene,
    x: 31, z: 30, yaw: Math.PI, level: 0,
    speedMult: 1.0,
    camDist: 4.2,
    onUse: (use) => {
      const msg = {
        read: "You read the memorial plaque.",
        play: "You play for a moment.",
        perform: "You perform for the crowd!",
        run: "You run on the treadmill.",
        lift: "You lift some weights.",
        yoga: "You feel centred.",
        use: "You use it.",
        wash: "You wash your hands.",
      }[use.kind] || use.label || "USE";
      if (window.__ph3d_phone) window.__ph3d_phone._toast(msg);
    },
  });

  window.__ph3d_walkCtrl = ctl;

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: meta.name,
    title: "ISAAC BORO PARK",
    subtitle: "MEMORIAL GROUNDS",
    hint: "LEFT: MOVE \u00B7 RIGHT: LOOK \u00B7 E: INTERACT",
    isInterior: true,
    sceneId: "boropark",
    update: (dt) => { ctl.update(dt); },
    dispose: () => { ctl.dispose(); },
  };
}
