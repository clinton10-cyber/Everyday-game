/* prison/interior.js — State Prison walkable interior.
   Rooms: Main Corridor, Guard Station, Cell Block A (8 cells each side),
          Common Area, Visitation Room, Warden's Office, Exercise Yard (indoors).
   Uses ThirdPersonControls pattern matching statejail/church. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {

  /* ── SCENE ── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.fog = new THREE.Fog(0x0a0c10, 50, 140);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.06, 260);
  camera.rotation.order = "YXZ";

  /* ── LIGHTING ── */
  scene.add(new THREE.HemisphereLight(0xc8d8f0, 0x2a2a30, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(18, 40, 15); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -35; sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 30;  sun.shadow.camera.bottom = -30;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa0b8d0, 0.4);
  fill.position.set(-18, 20, -15); scene.add(fill);

  // Corridor fluorescent strip lights
  [-14, -6, 2, 10, 18].forEach(z => {
    const pl = new THREE.PointLight(0xd8e8ff, 1.2, 18, 2);
    pl.position.set(0, 5.5, z); scene.add(pl);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.06, 2.5),
      new THREE.MeshBasicMaterial({ color: 0xe8f0ff })
    );
    strip.position.set(0, 5.9, z); scene.add(strip);
  });
  // Common area light
  const comLight = new THREE.PointLight(0xd0d8e8, 1.0, 22, 2);
  comLight.position.set(-16, 5, 10); scene.add(comLight);
  // Visitation room light
  const visLight = new THREE.PointLight(0xc8d0e0, 0.8, 16, 2);
  visLight.position.set(14, 4.5, 10); scene.add(visLight);
  // Warden office
  const wardLight = new THREE.PointLight(0xffe8c8, 0.9, 12, 2);
  wardLight.position.set(14, 4.5, -14); scene.add(wardLight);

  /* ── HELPERS ── */
  const BOXG = new THREE.BoxGeometry(1, 1, 1);
  const CYLG = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const SPHG = new THREE.SphereGeometry(0.5, 8, 6);
  const MC = new Map();

  function mat(c, o) {
    if (o && o.map) return new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
    const k = c + "|" + JSON.stringify(o || 0);
    let m = MC.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); MC.set(k, m); }
    return m;
  }
  const glow = c => new THREE.MeshBasicMaterial({ color: c });
  const barM = mat(0x6a6e74);

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
  function cyl(r, h, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(CYLG, typeof m === "number" ? mat(m) : m);
    s.scale.set(r * 2, h, r * 2); s.position.set(x, y, z);
    s.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    s.castShadow = true; world.add(s);
    if (o.solid) solid.push({ x, z, hw: r, hd: r });
    return s;
  }

  /* ── DIMENSIONS ──
     Layout (z = south ↑ north):
       Main Corridor:   x=-4..4,   z=-22..22   (8×44)
       Cell Block A (west):  x=-16..-4, z=-22..18  (12 wide × 40 deep, 8 cells per side)
       Cell Block B (east):  x=4..16,   z=-22..18  (12 wide × 40 deep)
       Guard Station:   x=-4..4,   z=18..22   (8×4, north end of corridor)
       Common Area:     x=-24..-16, z=4..22   (8×18, west side)
       Warden's Office: x=16..24,  z=-22..-6  (8×16, east side)
       Visitation Room: x=16..24,  z=-6..14   (8×20, east side) 
  */
  const H   = 6.0;
  const W_T = 0.22;

  /* ─── FLOORS ─── */
  // Concrete floor texture
  function concTex() {
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
    const g = cv.getContext("2d");
    g.fillStyle = "#888c90"; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 200; i++) {
      g.fillStyle = `rgba(${Math.random()>0.5?160:100},${Math.random()>0.5?165:105},${Math.random()>0.5?170:110},.25)`;
      g.fillRect(Math.random()*128, Math.random()*128, 3, 3);
    }
    g.strokeStyle = "#70747a"; g.lineWidth = 2;
    g.strokeRect(1, 1, 126, 126);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function tileTex() {
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 64;
    const g = cv.getContext("2d");
    g.fillStyle = "#b8bcc0"; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "#9a9ea2"; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const concM = mat(0xffffff, { map: concTex() });
  const tileM = mat(0xffffff, { map: tileTex() });

  box(8, 0.18, 44, 0, 0.09, 0, concM);        // Corridor
  box(12, 0.18, 40, -10, 0.09, -2, concM);    // Cell Block A
  box(12, 0.18, 40, 10, 0.09, -2, concM);     // Cell Block B
  box(8, 0.18, 4, 0, 0.09, 20, mat(0x3a3e44));// Guard Station
  box(8, 0.18, 18, -20, 0.09, 13, mat(0x6a6860));  // Common Area
  box(8, 0.18, 16, 20, 0.09, -14, mat(0x4a3820));  // Warden Office
  box(8, 0.18, 20, 20, 0.09, 4, tileM);            // Visitation Room

  /* ─── OUTER WALLS ─── */
  const concreteWall = mat(0x8a8e94);
  const innerWall    = mat(0x9a9c9a);

  // North wall (z=22)
  box(8, H, W_T, 0, H/2, 22, concreteWall, { solid: true });
  // South wall (z=-22)
  box(32, H, W_T, 0, H/2, -22, concreteWall, { solid: true });
  // West outer (x=-28)
  box(W_T, H, 44, -28, H/2, -4, concreteWall, { solid: true }); // not quite right, simplified
  // West wall of common area (x=-24)
  box(W_T, H, 18, -24, H/2, 13, concreteWall, { solid: true });
  box(W_T, H, 40, -16, H/2, -2, concreteWall, { solid: true }); // West cell block wall
  // East wall of visitation/warden (x=24)
  box(W_T, H, 36, 24, H/2, -5, concreteWall, { solid: true });
  box(W_T, H, 40, 16, H/2, -2, concreteWall, { solid: true });  // East cell block wall

  // Common Area north wall (z=22, x=-24..-16)
  box(8, H, W_T, -20, H/2, 22, concreteWall, { solid: true });
  // Common Area south divider (z=4)
  box(5.2, H, W_T, -18.4, H/2, 4, innerWall, { solid: true });  // door gap at x=-16
  box(2.6, H, W_T, -22.7, H/2, 4, innerWall, { solid: true });
  // Corridor / Common Area divider (x=-16, z=4..22) - door at z=13
  box(W_T, H, 5.5, -16, H/2, 6.75, innerWall, { solid: true });
  box(W_T, H, 5.5, -16, H/2, 15.25, innerWall, { solid: true });
  box(W_T, H, 4, -16, H/2, 20, innerWall, { solid: true });

  // Corridor / Cell Block A divider (x=-4, z=-22..18) - doors per cell
  // Main corridor east wall at x=-4 (continuous with gaps)
  box(W_T, H, 8, -4, H/2, -18, innerWall, { solid: true });
  // Cell gaps: each 2.6m wide, spaced every 5m
  for (let i = 0; i < 8; i++) {
    const cz = -14 + i * 5;
    box(W_T, H, 2.5, -4, H/2, cz - 1.25, innerWall, { solid: true });
    // cell door lintel
    box(2.4, 0.3, 0.12, -5.2, H - 0.2, cz, mat(0x5a5e64));
  }
  box(W_T, H, 3, -4, H/2, 19.5, innerWall, { solid: true });

  // Corridor / Cell Block B (x=4, same pattern)
  box(W_T, H, 8, 4, H/2, -18, innerWall, { solid: true });
  for (let i = 0; i < 8; i++) {
    const cz = -14 + i * 5;
    box(W_T, H, 2.5, 4, H/2, cz - 1.25, innerWall, { solid: true });
    box(2.4, 0.3, 0.12, 5.2, H - 0.2, cz, mat(0x5a5e64));
  }
  box(W_T, H, 3, 4, H/2, 19.5, innerWall, { solid: true });

  // Corridor / Guard Station divider (z=18)
  box(2.6, H, W_T, -1.3, H/2, 18, innerWall, { solid: true });
  box(2.6, H, W_T,  1.3, H/2, 18, innerWall, { solid: true });

  // Warden / Visitation divider (z=-6, x=16..24)
  box(8, H, W_T, 20, H/2, -6, innerWall, { solid: true });
  // Visitation / Corridor divider (x=16, z=-6..14) - door at z=4
  box(W_T, H, 5.5, 16, H/2, -3.25, innerWall, { solid: true });
  box(W_T, H, 5.5, 16, H/2, 8.75, innerWall, { solid: true });
  box(W_T, H, 6, 16, H/2, -13, innerWall, { solid: true });

  // Ceiling
  box(56, 0.18, 56, 0, H + 0.09, 0, mat(0xb0b2b4));

  /* ─── CELL BLOCK A (west) ─── */
  // 8 cells on west wall: each x=-16..-4, 5m deep
  for (let i = 0; i < 8; i++) {
    const cz = -14 + i * 5;
    // Back wall of cell
    box(0.18, H, 4.8, -16, H/2, cz, innerWall, { solid: true });
    // Cell dividers between cells
    if (i > 0) box(12, 0.18, 0.18, -10, H/2, cz - 2.5, innerWall, { solid: true });

    // Cell floor highlight
    box(11.6, 0.04, 4.6, -10, 0.2, cz, mat(0x7a7e82));

    // Bunk bed
    box(0.95, 0.2, 1.9, -15, 0.1, cz, mat(0x5a5e64), { solid: true });
    box(0.95, 0.2, 1.9, -15, 1.0, cz, mat(0x5a5e64), { solid: true });
    box(0.9, 0.12, 1.85, -15, 0.32, cz, mat(0xd8dce0));
    box(0.9, 0.12, 1.85, -15, 1.22, cz, mat(0xd8dce0));
    // Bunk pillows
    box(0.4, 0.1, 0.3, -15.2, 0.44, cz - 0.75, mat(0xf0eee8));
    box(0.4, 0.1, 0.3, -15.2, 1.35, cz - 0.75, mat(0xf0eee8));
    // Bunk ladder
    box(0.05, 0.9, 0.05, -14.55, 0.45, cz + 0.7, barM);
    box(0.05, 0.9, 0.05, -14.55, 0.45, cz + 0.55, barM);
    for (let r = 0; r < 3; r++) box(0.05, 0.05, 0.22, -14.55, 0.25 + r * 0.27, cz + 0.62, barM);

    seats.push({ type: "lie", label: "LIE DOWN", x: -15, z: cz, dx: 0, dz: 1, yaw: 0, h: 0.32, level: 0, taken: false });
    seats.push({ type: "lie", label: "LIE DOWN (TOP)", x: -15, z: cz, dx: 0, dz: 1, yaw: 0, h: 1.22, level: 0, taken: false });

    // Toilet in cell corner
    box(0.42, 0.4, 0.22, -15.3, 0.2, cz + 2.1, mat(0xe0e0e0));
    cyl(0.19, 0.38, -15.3, 0.19, cz + 1.8, mat(0xe0e0e0));
    box(0.38, 0.06, 0.48, -15.3, 0.42, cz + 1.95, mat(0xd4d4d4));
    seats.push({ type: "toilet", label: "USE TOILET", x: -15.3, z: cz + 1.8, dx: 0, dz: -1, yaw: Math.PI, h: 0.48, level: 0, taken: false });

    // Cell desk + stool
    box(0.8, 0.75, 0.45, -5.5, 0.375, cz - 1.5, mat(0x5a5e64), { solid: true });
    box(0.8, 0.04, 0.48, -5.5, 0.76, cz - 1.5, mat(0x7a7e84));
    cyl(0.18, 0.42, -5.5, 0.21, cz - 0.9, mat(0x5a5e64), { solid: true });
    uses.push({ kind: "use", label: "USE DESK", x: -5.5, z: cz - 1.5, y: 0, level: 0, r: 1.4 });

    // Bar door (6 bars at cell opening)
    for (let b = 0; b < 5; b++) {
      box(0.06, H - 0.4, 0.06, -4.15, H/2 - 0.2, cz - 0.9 + b * 0.45, barM);
    }
  }

  /* ─── CELL BLOCK B (east, mirror of A) ─── */
  for (let i = 0; i < 8; i++) {
    const cz = -14 + i * 5;
    box(0.18, H, 4.8, 16, H/2, cz, innerWall, { solid: true });
    if (i > 0) box(12, 0.18, 0.18, 10, H/2, cz - 2.5, innerWall, { solid: true });
    box(11.6, 0.04, 4.6, 10, 0.2, cz, mat(0x7a7e82));

    box(0.95, 0.2, 1.9, 15, 0.1, cz, mat(0x5a5e64), { solid: true });
    box(0.95, 0.2, 1.9, 15, 1.0, cz, mat(0x5a5e64), { solid: true });
    box(0.9, 0.12, 1.85, 15, 0.32, cz, mat(0xd8dce0));
    box(0.9, 0.12, 1.85, 15, 1.22, cz, mat(0xd8dce0));
    box(0.4, 0.1, 0.3, 14.8, 0.44, cz - 0.75, mat(0xf0eee8));
    box(0.4, 0.1, 0.3, 14.8, 1.35, cz - 0.75, mat(0xf0eee8));
    box(0.05, 0.9, 0.05, 14.55, 0.45, cz + 0.7, barM);
    box(0.05, 0.9, 0.05, 14.55, 0.45, cz + 0.55, barM);
    for (let r = 0; r < 3; r++) box(0.05, 0.05, 0.22, 14.55, 0.25 + r * 0.27, cz + 0.62, barM);

    seats.push({ type: "lie", label: "LIE DOWN", x: 15, z: cz, dx: 0, dz: 1, yaw: 0, h: 0.32, level: 0, taken: false });

    box(0.42, 0.4, 0.22, 15.3, 0.2, cz + 2.1, mat(0xe0e0e0));
    cyl(0.19, 0.38, 15.3, 0.19, cz + 1.8, mat(0xe0e0e0));
    box(0.38, 0.06, 0.48, 15.3, 0.42, cz + 1.95, mat(0xd4d4d4));
    seats.push({ type: "toilet", label: "USE TOILET", x: 15.3, z: cz + 1.8, dx: 0, dz: -1, yaw: Math.PI, h: 0.48, level: 0, taken: false });

    box(0.8, 0.75, 0.45, 5.5, 0.375, cz - 1.5, mat(0x5a5e64), { solid: true });
    box(0.8, 0.04, 0.48, 5.5, 0.76, cz - 1.5, mat(0x7a7e84));
    cyl(0.18, 0.42, 5.5, 0.21, cz - 0.9, mat(0x5a5e64), { solid: true });
    uses.push({ kind: "use", label: "USE DESK", x: 5.5, z: cz - 1.5, y: 0, level: 0, r: 1.4 });

    for (let b = 0; b < 5; b++) {
      box(0.06, H - 0.4, 0.06, 4.15, H/2 - 0.2, cz - 0.9 + b * 0.45, barM);
    }
  }

  /* ─── GUARD STATION (x=-4..4, z=18..22) ─── */
  // Control desk (U-shape)
  box(6.4, 0.9, 0.6, 0, 0.45, 21.2, mat(0x3a3e44), { solid: true });
  box(0.6, 0.9, 2.4, -3.5, 0.45, 19.9, mat(0x3a3e44), { solid: true });
  box(0.6, 0.9, 2.4,  3.5, 0.45, 19.9, mat(0x3a3e44), { solid: true });
  box(6.4, 0.06, 0.7, 0, 0.93, 21.2, mat(0x5a5e64));
  // Control monitors (row of screens)
  for (let i = -2; i <= 2; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.4, 0.03),
      new THREE.MeshBasicMaterial({ color: [0x224466, 0x226644, 0x443322, 0x226644, 0x224466][i + 2] })
    );
    m.position.set(i * 1.15, 1.46, 20.95); scene.add(m);
  }
  // Guard chair
  cyl(0.28, 0.45, 0, 0.22, 20.5, mat(0x2a2a2e));
  box(0.55, 0.6, 0.1, 0, 0.75, 20.2, mat(0x2a2a2e));
  seats.push({ type: "sit", label: "GUARD DUTY", x: 0, z: 20.5, dx: 0, dz: 1, yaw: 0, h: 0.55, level: 0, taken: false });
  uses.push({ kind: "use", label: "CONTROL PANEL", x: 0, z: 21.5, y: 0, level: 0, r: 2 });

  // Red emergency beacon
  {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    e.position.set(-2, 5.5, 21.8); scene.add(e);
  }

  /* ─── COMMON AREA (x=-24..-16, z=4..22) ─── */
  // Folding tables + benches
  const tablePositions = [
    [-20, 9], [-20, 14], [-20, 19],
  ];
  tablePositions.forEach(([tx, tz]) => {
    box(4.2, 0.06, 1.1, tx, 0.76, tz, mat(0x5a5e64), { solid: true });
    box(4.2, 0.7, 1.1, tx, 0.38, tz, mat(0x3a3e44));
    // Benches each side
    box(4.0, 0.12, 0.36, tx, 0.46, tz + 1.05, mat(0x3a3e44), { solid: true });
    box(4.0, 0.12, 0.36, tx, 0.46, tz - 1.05, mat(0x3a3e44), { solid: true });
    for (let j = -1.2; j <= 1.3; j += 0.8) {
      seats.push({ type: "sit", label: "SIT", x: tx + j, z: tz + 1.05, dx: 0, dz: -1, yaw: Math.PI, h: 0.55, level: 0, taken: false });
      seats.push({ type: "sit", label: "SIT", x: tx + j, z: tz - 1.05, dx: 0, dz: 1, yaw: 0, h: 0.55, level: 0, taken: false });
    }
    uses.push({ kind: "eat", label: "EAT", x: tx, z: tz, y: 0, level: 0, r: 2.5 });
  });

  // TV mounted on west wall
  box(2.8, 0.08, 0.5, -23.5, 3.0, 13, mat(0x2a2a2e), { solid: true });
  box(2.8, 1.6, 0.08, -23.5, 3.0, 12.76, mat(0x0a0a10), { solid: true });
  {
    const tv = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.02), new THREE.MeshBasicMaterial({ color: 0x1a2a3a }));
    tv.position.set(-23.5, 3.0, 12.78); scene.add(tv);
  }
  uses.push({ kind: "watch", label: "WATCH TV", x: -20, z: 13, y: 0, level: 0, r: 5 });

  // Basketball hoop (north end of common area)
  cyl(0.04, 5.2, -18.8, 2.6, 21.5, mat(0x9a9a9a));
  box(1.5, 1.0, 0.08, -19.6, 5.6, 21.5, mat(0xf8f8f8));
  {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.025, 8, 20),
      mat(0xff5500)
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(-19.6, 5.1, 21.3);
    scene.add(rim);
  }
  uses.push({ kind: "play", label: "SHOOT HOOPS", x: -20, z: 18, y: 0, level: 0, r: 4 });

  /* ─── WARDEN'S OFFICE (x=16..24, z=-22..-6) ─── */
  // Warden's desk
  box(3.0, 0.88, 1.4, 20, 0.44, -14.5, mat(0x3a2010), { solid: true });
  box(3.2, 0.06, 1.5, 20, 0.91, -14.5, mat(0x5a3018));
  cyl(0.28, 0.45, 20, 0.22, -16.2, mat(0x1a1a1e));
  box(0.5, 0.6, 0.1, 20, 0.75, -16.5, mat(0x1a1a1e));
  seats.push({ type: "sit", label: "SIT - WARDEN", x: 20, z: -16.2, dx: 0, dz: 1, yaw: 0, h: 0.55, level: 0, taken: false });
  uses.push({ kind: "use", label: "WARDEN'S DESK", x: 20, z: -13.6, y: 0, level: 0, r: 1.8 });

  // Visitor chairs
  formalChair(-19.2, 20, -12.8, Math.PI);
  formalChair(-20.8, 20, -12.8, Math.PI);
  function formalChair(unused, cx, cz, ry) {
    box(0.52, 0.42, 0.5, cx, 0.21, cz, mat(0x5a3018), { solid: true });
    box(0.52, 0.65, 0.08, cx, 0.71, cz, mat(0x5a3018));
    seats.push({ type: "sit", label: "SIT", x: cx, z: cz, dx: Math.sin(ry), dz: Math.cos(ry), yaw: ry, h: 0.55, level: 0, taken: false });
  }

  // Filing cabinet
  box(0.55, 1.5, 0.45, 23.7, 0.75, -15, mat(0x5a5e64), { solid: true });
  for (let r = 0; r < 3; r++) box(0.5, 0.02, 0.42, 23.7, 0.25 + r * 0.45, -15, mat(0x7a7e84));

  // Bookshelf
  box(3.5, 2.5, 0.4, 20, 1.25, -21.6, mat(0x4a3018), { solid: true });
  for (let r = 0; r < 3; r++) box(3.3, 0.05, 0.38, 20, 0.3 + r * 0.7, -21.6, mat(0x6a4828));

  /* ─── VISITATION ROOM (x=16..24, z=-6..14) ─── */
  // Divider wall (clear panel down the middle)
  box(8, 2.0, 0.08, 20, 1.0, 4, mat(0x9a9ea2), { solid: true });
  {
    const gp = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.6, 0.04),
      new THREE.MeshLambertMaterial({ color: 0xbbddee, transparent: true, opacity: 0.35 }));
    gp.position.set(20, 1.0, 4); scene.add(gp);
  }
  // Phone slots in divider
  for (let i = -3; i <= 3; i++) {
    box(0.18, 0.32, 0.08, 20 + i * 1.05, 1.62, 4, mat(0x2a2a2e));
    const recv = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0x2a2a2e }));
    recv.position.set(20 + i * 1.05, 1.7, 4.07); scene.add(recv);
  }

  // Visitor side seats (z > 4 side)
  for (let i = -2; i <= 2; i++) {
    cyl(0.22, 0.44, 20 + i * 1.05 * 1.1, 0.22, 6.5, mat(0x5a5e64), { solid: true });
    seats.push({ type: "sit", label: "VISIT", x: 20 + i * 1.05 * 1.1, z: 6.5, dx: 0, dz: -1, yaw: Math.PI, h: 0.55, level: 0, taken: false });
    uses.push({ kind: "use", label: "PHONE VISIT", x: 20 + i * 1.05 * 1.1, z: 5.2, y: 0, level: 0, r: 1.0 });
  }
  // Inmate side seats (z < 4 side)
  for (let i = -2; i <= 2; i++) {
    cyl(0.22, 0.44, 20 + i * 1.05 * 1.1, 0.22, 1.5, mat(0x5a5e64), { solid: true });
    seats.push({ type: "sit", label: "VISITATION", x: 20 + i * 1.05 * 1.1, z: 1.5, dx: 0, dz: 1, yaw: 0, h: 0.55, level: 0, taken: false });
  }

  // Guard post in visitation
  box(1.4, 0.88, 0.6, 23, 0.44, 10, mat(0x3a3e44), { solid: true });
  seats.push({ type: "sit", label: "GUARD POST", x: 23, z: 11, dx: 0, dz: -1, yaw: Math.PI, h: 0.55, level: 0, taken: false });

  /* ─── SPAWN ─── */
  const START = { x: 0, z: 20, yaw: Math.PI };

  /* ── COLLIDERS ── */
  const colliders = [];
  for (const b of solid) {
    colliders.push({
      minX: b.x - b.hw, maxX: b.x + b.hw,
      minZ: b.z - b.hd, maxZ: b.z + b.hd,
      y0: 0, y1: H, level: 0,
    });
  }

  const __world = {
    colliders, seats, uses,
    stairs: [], platforms: [],
    levelHeight: () => 0.12,
    ceilingHeight: H,
    bounds: { minX: -28.5, maxX: 24.5, minZ: -22.5, maxZ: 22.5 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene,
    x: START.x, z: START.z, yaw: START.yaw, level: 0,
    speedMult: 1.1,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "PRISON",
    title: "STATE PRISON",
    subtitle: "RIVERS · CORRECTIONAL",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "prison",
    update: (dt) => ctl.update(dt),
    dispose: () => ctl.dispose(),
  };
}

