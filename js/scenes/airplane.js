/* airplane.js -- Boeing 787 cabin walkthrough in THIRD PERSON, real
   scale, with interactive seats. Every seat becomes a sit point in the
   ThirdPersonControls world so walking within ~1.6 m of any seat
   surfaces the SIT button, tapping it seats the character, and tapping
   again stands up. Row pitch was widened from 1.36 m to 1.75 m so the
   cabin doesn't feel packed, and the row count was reduced to keep the
   cabin within the 47.6 m fuselage. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../core/thirdperson.js";
import { createPlaneNPCs } from "../core/plane-npcs.js";

export async function airplaneScene(params, router) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1420);
  scene.fog = new THREE.Fog(0x0b1420, 45, 130);

  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.06, 200);
  camera.rotation.order = "YXZ";

  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x4a5260, 1.7));
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const ceilL = new THREE.PointLight(0xfff0d8, 0.6, 60, 1);
  ceilL.position.set(0, 3.0, 0);
  scene.add(ceilL);

  const R = 4.9;
  const L = 47.6;
  const FLOOR_Y = -1.7;
  const CEIL_Y = 2.72;
  const FLOOR_W = 8.84;
  const SEAT_H = 0.48; /* airline-realistic seat pan height (was 0.714: legs hung straight) */

  /* Wider row pitch + fewer rows = legroom instead of packing. 20 rows
     at 1.75 m pitch covers ~33 m, well within the 47.6 m fuselage. */
  const ROWS = 20;
  const ROW_PITCH = 1.75;
  const FIRST_ROW_Z = -19.55;
  const LAST_ROW_Z = FIRST_ROW_Z + (ROWS - 1) * ROW_PITCH;
  const COCKPIT_Z = -22.95;
  const REAR_BULKHEAD_Z = 19.55;
  const TAIL_Z = 23.8;

  const SEAT_X = {
    left:   [-3.64, -2.92],
    center: [-0.82,  0.00, 0.82],
    right:  [ 2.92,  3.64],
  };
  const SEAT_BLOCK_L = [-3.99, -2.57];
  const SEAT_BLOCK_C = [-1.17,  1.17];
  const SEAT_BLOCK_R = [ 2.57,  3.99];
  const AISLE_X = [-1.87, 1.87];
  const SEAT_Z0 = FIRST_ROW_Z - 0.77;
  const SEAT_Z1 = LAST_ROW_Z + 0.77;

  function makeCarpet() {
    const S = 128, cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const g = cv.getContext("2d");
    g.fillStyle = "#2a3548"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = "rgba(" + (40 + Math.random() * 40 | 0) + "," + (50 + Math.random() * 40 | 0) + "," + (70 + Math.random() * 40 | 0) + ",0.35)";
      g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, router.renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  function makeAisle() {
    const S = 64, cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const g = cv.getContext("2d");
    g.fillStyle = "#161e28"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = "rgba(30,40,55,0.6)";
      g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const carpetTex = makeCarpet(); carpetTex.repeat.set(5, 20);
  const aisleTex = makeAisle();   aisleTex.repeat.set(1, 34);

  const M = {
    fuselage:     new THREE.MeshLambertMaterial({ color: 0xe8eef4, side: THREE.BackSide }),
    floor:        new THREE.MeshLambertMaterial({ map: carpetTex }),
    aisleCarpet:  new THREE.MeshLambertMaterial({ map: aisleTex }),
    ceiling:      new THREE.MeshLambertMaterial({ color: 0xeef2f6 }),
    bulkhead:     new THREE.MeshLambertMaterial({ color: 0xd8dde3 }),
    seat:         new THREE.MeshLambertMaterial({ color: 0x2a3d5c }),
    seatPad:      new THREE.MeshLambertMaterial({ color: 0x3a5578 }),
    seatBase:     new THREE.MeshLambertMaterial({ color: 0x1f2d42 }),
    armrest:      new THREE.MeshLambertMaterial({ color: 0x8c95a3 }),
    bin:          new THREE.MeshLambertMaterial({ color: 0xd0d6dc }),
    binLatch:     new THREE.MeshLambertMaterial({ color: 0x5a6270 }),
    psu:          new THREE.MeshLambertMaterial({ color: 0xb0b8c2 }),
    psuLight:     new THREE.MeshBasicMaterial({ color: 0xfff4d0 }),
    window:       new THREE.MeshBasicMaterial({ color: 0xc8e4f8 }),
    windowFrame:  new THREE.MeshLambertMaterial({ color: 0x6a7480 }),
    cockpitDoor:  new THREE.MeshLambertMaterial({ color: 0x4a5260 }),
    placard:      new THREE.MeshBasicMaterial({ color: 0x2a3a5a }),
    galley:       new THREE.MeshLambertMaterial({ color: 0xb0b8c2 }),
    galleyTop:    new THREE.MeshLambertMaterial({ color: 0xe0e6ec }),
    restroomDoor: new THREE.MeshLambertMaterial({ color: 0x8890a0 }),
    exitSign:     new THREE.MeshBasicMaterial({ color: 0x50ff80 }),
    tv:           new THREE.MeshBasicMaterial({ color: 0x1a3a5a }),
    lightPanel:   new THREE.MeshBasicMaterial({ color: 0xfff8e8 }),
    aisleStrip:   new THREE.MeshBasicMaterial({ color: 0xffecc0 }),
  };

  const BUCKETS = new Map();
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3(),
        _eu = new THREE.Euler();
  function push(geo, mat) {
    let a = BUCKETS.get(mat);
    if (!a) { a = []; BUCKETS.set(mat, a); }
    a.push(geo);
  }
  function xform(g, x, y, z, rx, ry, rz, sx, sy, sz) {
    if (rx === undefined) rx = 0;
    if (ry === undefined) ry = 0;
    if (rz === undefined) rz = 0;
    if (sx === undefined) sx = 1;
    if (sy === undefined) sy = 1;
    if (sz === undefined) sz = 1;
    _eu.set(rx, ry, rz);
    _q.setFromEuler(_eu);
    _v3.set(x, y, z); _s3.set(sx, sy, sz);
    _m4.compose(_v3, _q, _s3);
    g.applyMatrix4(_m4);
    return g;
  }
  function box(w, h, d, x, y, z, mat, rx, ry, rz) {
    const g = new THREE.BoxGeometry(w, h, d);
    push(xform(g, x, y, z, rx, ry, rz), mat);
  }
  const colliders = [];
  function collider(x0, x1, z0, z1) { colliders.push({ x0: x0, x1: x1, z0: z0, z1: z1 }); }

  /* Interactive seat list — pushed into the ThirdPersonControls world */
 /* Interactive seat list — pushed into the ThirdPersonControls world */
const seats = [];
function addSeatPoint(x, z) {
  seats.push({
    type: "sit",
    label: "SIT",
    x: x,
    z: z - 0.04,  /* slide hips forward on the pan (avatar adds +0.04 along yaw) */
    yaw: Math.PI, /* face -Z, away from the backrest */
    h: FLOOR_Y + SEAT_H + 0.06, /* absolute top of seat cushion */
    level: 0,
    taken: false,
  });
}

  /* Fuselage */
  {
    const g = new THREE.CylinderGeometry(R, R, L, 40, 1, true);
    g.rotateX(Math.PI / 2);
    scene.add(new THREE.Mesh(g, M.fuselage));
  }
  /* Floor */
  {
    const g = new THREE.PlaneGeometry(FLOOR_W, L);
    g.rotateX(-Math.PI / 2);
    g.translate(0, FLOOR_Y, 0);
    scene.add(new THREE.Mesh(g, M.floor));
  }
  for (const ax of AISLE_X) {
    const g = new THREE.PlaneGeometry(1.32, L - 3.4);
    g.rotateX(-Math.PI / 2);
    g.translate(ax, FLOOR_Y + 0.01, 0);
    scene.add(new THREE.Mesh(g, M.aisleCarpet));
  }
  /* Ceiling */
  {
    const g = new THREE.PlaneGeometry(3.57, L);
    g.rotateX(Math.PI / 2);
    g.translate(0, CEIL_Y, 0);
    scene.add(new THREE.Mesh(g, M.ceiling));
  }
  for (let z = -20.4; z <= 20.4; z += 2.72) box(1.53, 0.085, 2.04, 0, CEIL_Y - 0.044, z, M.lightPanel);
  for (const ax of [-2.30, 2.30]) box(0.05, 0.026, L - 3.4, ax, FLOOR_Y + 0.020, 0, M.aisleStrip);

  /* Cockpit bulkhead */
  box(FLOOR_W, 4.42, 0.238, 0, FLOOR_Y + 2.21, COCKPIT_Z, M.bulkhead);
  box(1.445, 3.145, 0.272, 3.23, FLOOR_Y + 1.5725, COCKPIT_Z + 0.10, M.cockpitDoor);
  box(0.714, 0.204, 0.034, 3.23, FLOOR_Y + 2.635, COCKPIT_Z - 0.085, M.placard);
  box(0.085, 0.272, 0.085, 2.686, FLOOR_Y + 1.7, COCKPIT_Z - 0.034, M.armrest);
  collider(-FLOOR_W / 2, FLOOR_W / 2, COCKPIT_Z - 0.17, COCKPIT_Z + 0.17);

  /* Rear bulkhead */
  box(1.87, 4.42, 0.238, -3.485, FLOOR_Y + 2.21, REAR_BULKHEAD_Z, M.bulkhead);
  box(2.04, 4.42, 0.238,  0.00, FLOOR_Y + 2.21, REAR_BULKHEAD_Z, M.bulkhead);
  box(1.87, 4.42, 0.238,  3.485, FLOOR_Y + 2.21, REAR_BULKHEAD_Z, M.bulkhead);
  box(1.53, 1.19, 0.238, -1.785, FLOOR_Y + 3.825, REAR_BULKHEAD_Z, M.bulkhead);
  box(1.53, 1.19, 0.238,  1.785, FLOOR_Y + 3.825, REAR_BULKHEAD_Z, M.bulkhead);
  box(0.408, 0.204, 0.068, -1.785, FLOOR_Y + 3.655, REAR_BULKHEAD_Z - 0.153, M.exitSign);
  box(0.408, 0.204, 0.068,  1.785, FLOOR_Y + 3.655, REAR_BULKHEAD_Z - 0.153, M.exitSign);
  collider(-FLOOR_W / 2, -2.55, REAR_BULKHEAD_Z - 0.17, REAR_BULKHEAD_Z + 0.17);
  collider(-1.02, 1.02, REAR_BULKHEAD_Z - 0.17, REAR_BULKHEAD_Z + 0.17);
  collider(2.55, FLOOR_W / 2, REAR_BULKHEAD_Z - 0.17, REAR_BULKHEAD_Z + 0.17);

  /* Tail wall */
  box(FLOOR_W, 4.42, 0.238, 0, FLOOR_Y + 2.21, TAIL_Z, M.bulkhead);
  box(1.19, 3.315, 0.272, -2.55, FLOOR_Y + 1.6575, TAIL_Z - 0.10, M.restroomDoor);
  box(1.19, 3.315, 0.272,  2.55, FLOOR_Y + 1.6575, TAIL_Z - 0.10, M.restroomDoor);
  box(0.085, 0.272, 0.085, -2.975, FLOOR_Y + 1.7, TAIL_Z - 0.238, M.armrest);
  box(0.085, 0.272, 0.085,  2.975, FLOOR_Y + 1.7, TAIL_Z - 0.238, M.armrest);
  box(0.34, 0.17, 0.068, -2.55, FLOOR_Y + 3.655, TAIL_Z - 0.153, M.exitSign);
  box(0.34, 0.17, 0.068,  2.55, FLOOR_Y + 3.655, TAIL_Z - 0.153, M.exitSign);
  collider(-FLOOR_W / 2, FLOOR_W / 2, TAIL_Z - 0.17, TAIL_Z + 0.17);

  /* Galley */
  box(2.72, 1.53, 2.72, -3.23, FLOOR_Y + 0.765, REAR_BULKHEAD_Z + 1.53, M.galley);
  box(2.89, 0.136, 2.89, -3.23, FLOOR_Y + 1.598, REAR_BULKHEAD_Z + 1.53, M.galleyTop);
  box(2.72, 1.53, 2.72,  3.23, FLOOR_Y + 0.765, REAR_BULKHEAD_Z + 1.53, M.galley);
  box(2.89, 0.136, 2.89,  3.23, FLOOR_Y + 1.598, REAR_BULKHEAD_Z + 1.53, M.galleyTop);
  collider(-4.59, -1.87, REAR_BULKHEAD_Z + 0.17, REAR_BULKHEAD_Z + 2.89);
  collider( 1.87,  4.59, REAR_BULKHEAD_Z + 0.17, REAR_BULKHEAD_Z + 2.89);

  /* Side colliders past the seat blocks */
  collider(-FLOOR_W / 2, -3.74, COCKPIT_Z, FIRST_ROW_Z);
  collider( 3.74,  FLOOR_W / 2, COCKPIT_Z, FIRST_ROW_Z);
  collider(-FLOOR_W / 2, -3.74, LAST_ROW_Z, REAR_BULKHEAD_Z);
  collider( 3.74,  FLOOR_W / 2, LAST_ROW_Z, REAR_BULKHEAD_Z);

  /* Seat-block colliders */
  collider(SEAT_BLOCK_L[0], SEAT_BLOCK_L[1], SEAT_Z0, SEAT_Z1);
  collider(SEAT_BLOCK_C[0], SEAT_BLOCK_C[1], SEAT_Z0, SEAT_Z1);
  collider(SEAT_BLOCK_R[0], SEAT_BLOCK_R[1], SEAT_Z0, SEAT_Z1);

  /* Seats + interactive seat points */
  function addSeat(x, z) {
    const H = SEAT_H, B_H = 1.054, SW = 0.68;
    box(SW - 0.034, H, 0.68, x, FLOOR_Y + H / 2, z, M.seatBase);
    box(SW, 0.119, 0.748, x, FLOOR_Y + H, z - 0.051, M.seat);
    box(SW, B_H, 0.119, x, FLOOR_Y + H + B_H / 2, z + 0.34, M.seat, 0.14, 0, 0);
    box(SW * 0.7, 0.272, 0.153, x, FLOOR_Y + H + B_H + 0.102, z + 0.459, M.seatPad, 0.14, 0, 0);
    box(SW * 0.7, 0.442, 0.0255, x, FLOOR_Y + H + 0.544, z + 0.4165, M.tv, 0.14, 0, 0);
    box(0.068, 0.085, 0.578, x - SW / 2, FLOOR_Y + H + 0.17, z - 0.051, M.armrest);
    box(0.068, 0.085, 0.578, x + SW / 2, FLOOR_Y + H + 0.17, z - 0.051, M.armrest);
    addSeatPoint(x, z);
  }
  for (let row = 0; row < ROWS; row++) {
    const z = FIRST_ROW_Z + row * ROW_PITCH;
    for (const x of SEAT_X.left) addSeat(x, z);
    for (const x of SEAT_X.center) addSeat(x, z);
    for (const x of SEAT_X.right) addSeat(x, z);
  }

  /* Overhead bins span the seat area only */
  const BIN_Z0 = FIRST_ROW_Z - 0.51;
  const BIN_Z1 = LAST_ROW_Z + 0.51;
  const BIN_LEN = BIN_Z1 - BIN_Z0;
  const BIN_CZ = (BIN_Z0 + BIN_Z1) / 2;
  for (const side of [-1, 1]) {
    box(2.13, 1.105, BIN_LEN, side * 2.9325, 2.1675, BIN_CZ, M.bin);
    box(2.13, 0.034, BIN_LEN, side * 2.9325, 1.6065, BIN_CZ, M.binLatch);
    for (let z = BIN_Z0 + 0.85; z < BIN_Z1; z += 2.04) {
      box(0.255, 0.085, 0.085, side * 3.91, 1.7, z, M.binLatch);
    }
  }

  /* PSU rows */
  for (let row = 0; row < ROWS; row++) {
    const z = FIRST_ROW_Z + row * ROW_PITCH;
    box(2.04, 0.102, 1.19, -2.89, 1.564, z, M.psu);
    box(2.04, 0.102, 1.19,  2.89, 1.564, z, M.psu);
    box(0.068, 0.034, 0.068, -3.655, 1.5215, z, M.psuLight);
    box(0.068, 0.034, 0.068, -2.805, 1.5215, z, M.psuLight);
    box(0.068, 0.034, 0.068,  2.805, 1.5215, z, M.psuLight);
    box(0.068, 0.034, 0.068,  3.655, 1.5215, z, M.psuLight);
  }

  /* Windows line up with seats */
  const WIN_Y = 0.17;
  for (let row = 0; row < ROWS; row++) {
    const z = FIRST_ROW_Z + row * ROW_PITCH;
    for (const side of [-1, 1]) {
      const wx = side * 4.335;
      box(0.102, 0.51, 0.408, wx, WIN_Y, z, M.windowFrame);
      box(0.034, 0.374, 0.272, wx + side * 0.017, WIN_Y, z, M.window);
    }
  }

  /* Exit markers */
  for (const r of [2, 8, 14, 18]) {
    if (r >= ROWS) continue;
    const z = FIRST_ROW_Z + r * ROW_PITCH;
    box(0.51, 0.17, 0.051, -4.335, 0.68, z, M.exitSign);
    box(0.51, 0.17, 0.051,  4.335, 0.68, z, M.exitSign);
  }

  /* Merge everything */
  let tris = 0;
  for (const entry of BUCKETS) {
    const mat = entry[0];
    const geos = entry[1];
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    tris += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
  }
  console.log("[airplane] " + BUCKETS.size + " merged meshes - " + (tris | 0) + " triangles - " + seats.length + " interactive seats");

  /* Convert colliders */
  const collidersTp = [];
  for (const c of colliders) {
    collidersTp.push({ minX: c.x0, maxX: c.x1, minZ: c.z0, maxZ: c.z1, level: 0 });
  }

  const halfW = Math.sqrt(Math.max(0, R * R - (FLOOR_Y + 1.62) * (FLOOR_Y + 1.62))) - 0.55;
  /* FIX #19 — add explicit overhead bin colliders so the camera can't clip through the fuselage */
for (const side of [-1, 1]) {
  collidersTp.push({
    minX: side * 1.87, maxX: side * 3.98,
    minZ: BIN_Z0, maxZ: BIN_Z1,
    y0: 1.60, y1: 2.72, level: 0,
  });
}
/* Also clamp camera below the fuselage roof */
const CEIL_LIMIT = CEIL_Y - 0.15;

const world = {
  colliders: collidersTp,
  seats: seats,
  uses: [],
  platforms: [],
  levelHeight: function () { return FLOOR_Y; },
  ceilingHeight: CEIL_LIMIT - FLOOR_Y,
  bounds: {
    minX: -halfW, maxX: halfW,
    minZ: COCKPIT_Z + 0.85,
    maxZ: TAIL_Z - 0.85,
  },
};

  /* Spawn in the left aisle, just past the front row, facing rear */
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene: scene,
    x: -1.87, z: FIRST_ROW_Z - 1.0, yaw: Math.PI, level: 0,
    speedMult: 1.0,
    onUse: function (use) {
      if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE");
    },
  });

  /* Wandering passengers/crew: walk the two aisles, turn when blocked */
  const planeNPCs = createPlaneNPCs({
    scene: scene,
    floorY: FLOOR_Y,
    colliders: collidersTp,
    bounds: world.bounds,
    spawn: [
      { minX: -2.3, maxX: -1.45, minZ: COCKPIT_Z + 1.5, maxZ: REAR_BULKHEAD_Z - 1 },
      { minX:  1.45, maxX:  2.3, minZ: COCKPIT_Z + 1.5, maxZ: REAR_BULKHEAD_Z - 1 },
    ],
    count: 10,
    getPlayer: function () { return { x: ctl.pos.x, z: ctl.pos.z }; },
  });

  ctl.floorY = FLOOR_Y;
  ctl.avatar.position.y = FLOOR_Y;
  ctl.camPitch = 0.12;
  ctl._updateCamera(0, true);

  return {
    three: scene,
    camera: camera,
    controls: { update: function () {} },
    crumb: "AIRPLANE",
    title: "BOEING 787-9",
    subtitle: "CABIN - REAL SCALE",
    hint: "",
    update: function (dt) {
  ctl.update(dt);
  planeNPCs.update(dt);
},
dispose: function () {
  planeNPCs.dispose();
  ctl.dispose();
},
  };
}

