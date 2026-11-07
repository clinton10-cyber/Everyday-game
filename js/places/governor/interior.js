/* governor/interior.js — Governor's Mansion walkable interior.
   Rooms: Entrance Hall, Governor's Office, Conference Room, Lounge, Dining,
          Private Study, Restroom, Security Post.
   Uses ThirdPersonControls pattern matching church/statejail/mosque. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {

  /* ── SCENE ── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1810);
  scene.fog = new THREE.Fog(0x1c1810, 45, 140);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 300);
  camera.rotation.order = "YXZ";

  /* ── LIGHTING ── */
  scene.add(new THREE.HemisphereLight(0xfff8e8, 0x2a2418, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0cc, 1.1);
  sun.position.set(20, 45, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;  sun.shadow.camera.bottom = -30;
  scene.add(sun);

  const chandLight = new THREE.PointLight(0xffd080, 1.8, 28, 2);
  chandLight.position.set(0, 6, 2);
  scene.add(chandLight);
  const offLight = new THREE.PointLight(0xffe8c0, 0.9, 18, 2);
  offLight.position.set(-12, 5, -8);
  scene.add(offLight);
  const dineLight = new THREE.PointLight(0xfff0d0, 0.9, 18, 2);
  dineLight.position.set(14, 5, -8);
  scene.add(dineLight);

  /* ── GEOMETRY HELPERS ── */
  const BOXG = new THREE.BoxGeometry(1, 1, 1);
  const CYLG = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const SPHG = new THREE.SphereGeometry(0.5, 10, 8);
  const MC = new Map();

  function mat(c, o) {
    if (o && o.map) return new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
    const k = c + "|" + JSON.stringify(o || 0);
    let m = MC.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); MC.set(k, m); }
    return m;
  }
  const glow = c => new THREE.MeshBasicMaterial({ color: c });

  const world = new THREE.Group();
  scene.add(world);
  const solid = [], seats = [], uses = [];

  function box(w, h, d, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(BOXG, typeof m === "number" ? mat(m) : m);
    s.scale.set(w, h, d);
    s.position.set(x, y, z);
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
    s.scale.set(r * 2, h, r * 2);
    s.position.set(x, y, z);
    s.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    s.castShadow = true; s.receiveShadow = true;
    world.add(s);
    if (o.solid) solid.push({ x, z, hw: r, hd: r });
    return s;
  }
  function sph(r, x, y, z, m) {
    const s = new THREE.Mesh(SPHG, typeof m === "number" ? mat(m) : m);
    s.scale.setScalar(r * 2);
    s.position.set(x, y, z);
    s.castShadow = true;
    world.add(s);
    return s;
  }

  /* ── DIMENSIONS ── */
  // Layout (top-down, all coords in metres):
  //   Entrance Hall (centre): x=-4..4, z=4..14  (8×10)
  //   Security Post (left):   x=-12..-4, z=4..10 (8×6)
  //   Lounge (right):         x=4..14, z=4..12   (10×8)
  //   Governor's Office (back-left): x=-14..-4, z=-6..4 (10×10)
  //   Conference Room (back-centre): x=-4..4, z=-8..4   (8×12)
  //   Dining Room (back-right):      x=4..14, z=-6..4   (10×10)
  //   Private Study (far-left):      x=-14..-8, z=-14..-6 (6×8)
  //   Restroom (far-right):           x=8..14, z=-14..-6  (6×8)

  const H   = 7.0;   // ceiling height
  const W_T = 0.22;  // wall thickness
  const ROOM = { hw: 14, hd: 14 }; // half-extents of outer shell

  /* ─── FLOORS ─── */
  // Marble foyer
  function marbleTex() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const g = cv.getContext("2d");
    g.fillStyle = "#d6cfc2"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#c8c0b0"; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(${140+Math.random()*40|0},${130+Math.random()*40|0},${110+Math.random()*40|0},.18)`;
      g.lineWidth = Math.random() * 2 + 0.5;
      g.beginPath(); let px = Math.random()*256, py = Math.random()*256; g.moveTo(px, py);
      for (let j=0;j<4;j++){ px+=(Math.random()-.5)*80; py+=(Math.random()-.5)*80; g.lineTo(px,py); }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function woodTex() {
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
    const g = cv.getContext("2d");
    g.fillStyle = "#5a3c1e"; g.fillRect(0, 0, 128, 128);
    for (let i=0;i<20;i++){
      g.strokeStyle=`rgba(${80+Math.random()*30|0},${50+Math.random()*20|0},${20+Math.random()*15|0},.35)`;
      g.lineWidth=Math.random()*3+1;
      g.beginPath(); g.moveTo(0, i*8); g.lineTo(128, i*8+(Math.random()-.5)*12); g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const marbTex = marbleTex();
  const wdTex   = woodTex();
  const flMarble = mat(0xffffff, { map: marbTex });
  const flWood   = mat(0xffffff, { map: wdTex });

  // Entrance Hall floor (marble)
  box(8, 0.18, 10, 0, 0.09, 9, flMarble);
  // Security Post floor (dark tile)
  box(8, 0.18, 6, -8, 0.09, 7, mat(0x6a6660));
  // Lounge floor (warm wood)
  box(10, 0.18, 8, 9, 0.09, 8, flWood);
  // Governor's Office floor (deep wood)
  box(10, 0.18, 10, -9, 0.09, -1, mat(0x4a2e12));
  // Conference floor (stone tile)
  box(8, 0.18, 12, 0, 0.09, -2, mat(0x9a9088));
  // Dining floor (parquet)
  box(10, 0.18, 10, 9, 0.09, -1, flWood);
  // Private Study floor (wood)
  box(6, 0.18, 8, -11, 0.09, -10, mat(0x3a2010));
  // Restroom floor (white tile)
  box(6, 0.18, 8, 11, 0.09, -10, mat(0xe8e8e8));

  /* ─── OUTER WALLS ─── */
  const wallM  = mat(0xe8e2d4);
  const outerM = mat(0xd0c8b8);

  // North outer wall (z = 14)
  box(28, H, W_T,  0, H/2, 14, outerM, { solid: true });
  // South outer wall (z = -14)
  box(28, H, W_T,  0, H/2, -14, outerM, { solid: true });
  // West outer wall (x = -14)
  box(W_T, H, 28, -14, H/2, 0, outerM, { solid: true });
  // East outer wall (x = 14)
  box(W_T, H, 28,  14, H/2, 0, outerM, { solid: true });

  /* ─── INNER PARTITION WALLS ─── */
  // Hall / Security divider (x=-4, z=4..14) - door at z=9
  box(W_T, H, 2.5, -4, H/2, 5.75, wallM, { solid: true });
  box(W_T, H, 2.5, -4, H/2, 11.25, wallM, { solid: true });
  // Hall / Lounge divider (x=4, z=4..14) - door at z=9
  box(W_T, H, 2.5,  4, H/2, 5.75, wallM, { solid: true });
  box(W_T, H, 2.5,  4, H/2, 11.25, wallM, { solid: true });
  // Hall / Conference divider (z=4, x=-4..4) - door at x=0
  box(2, H, W_T, -3, H/2, 4, wallM, { solid: true });
  box(2, H, W_T,  3, H/2, 4, wallM, { solid: true });
  // Office / Study divider (z=-6, x=-14..-8)
  box(6, H, W_T, -11, H/2, -6, wallM, { solid: true });
  // Conference / Study divider (x=-8, z=-14..-6)
  box(W_T, H, 8, -8, H/2, -10, wallM, { solid: true });
  // Conference / Restroom divider (x=8, z=-14..-6)
  box(W_T, H, 8,  8, H/2, -10, wallM, { solid: true });
  // Dining / Restroom divider (z=-6, x=8..14)
  box(6, H, W_T,  11, H/2, -6, wallM, { solid: true });
  // Office top wall (z=4, x=-14..-4) - door at x=-9
  box(3.5, H, W_T, -11.75, H/2, 4, wallM, { solid: true });
  box(3.5, H, W_T,  -5.75, H/2, 4, wallM, { solid: true });
  // Dining top wall (z=4, x=4..14) - door at x=9
  box(3.5, H, W_T,  5.75, H/2, 4, wallM, { solid: true });
  box(3.5, H, W_T,  11.75, H/2, 4, wallM, { solid: true });
  // Office / Conference divider (x=-4, z=-8..4) - door at z=-2
  box(W_T, H, 3.5, -4, H/2, -0.25, wallM, { solid: true });
  box(W_T, H, 3.5, -4, H/2, -5.25, wallM, { solid: true });
  // Conference / Dining divider (x=4, z=-8..4) - door at z=-2
  box(W_T, H, 3.5,  4, H/2, -0.25, wallM, { solid: true });
  box(W_T, H, 3.5,  4, H/2, -5.25, wallM, { solid: true });

  /* ─── CEILING ─── */
  box(28, 0.18, 28, 0, H + 0.09, 0, mat(0xf5f2ec));

  /* ─── ENTRANCE HALL FURNITURE ─── */
  // Central chandelier
  cyl(0.04, 3.5, 0, H - 1.75, 9, mat(0xc8a840));
  cyl(0.7, 0.25, 0, H - 3.5, 9, mat(0xd4af37));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    cyl(0.03, 0.2, Math.cos(a) * 0.6, H - 3.62, 9 + Math.sin(a) * 0.6, glow(0xfff8d0));
  }

  // Reception desk
  box(3.2, 0.9, 0.65, 0, 0.45, 12.3, mat(0x4a3018), { solid: true });
  box(3.4, 0.06, 0.75, 0, 0.93, 12.3, mat(0x6b5030));
  // Secretary chair
  cyl(0.26, 0.45, 0.4, 0.22, 11.5, mat(0x2a1a08));
  box(0.5, 0.6, 0.06, 0.4, 0.72, 11.2, mat(0x2a1a08));
  seats.push({ type: "sit", label: "SIT AT DESK", x: 0.4, z: 11.5, dx: 0, dz: 1, yaw: 0, h: 0.55, level: 0, taken: false });

  // Two formal chairs facing desk
  function formalChair(x, z, ry) {
    box(0.52, 0.42, 0.5, x, 0.21, z, mat(0x6a3828), { solid: true });
    box(0.52, 0.7, 0.08, x, 0.71, z - 0.28 * Math.cos(ry), mat(0x6a3828));
    [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([lx, lz]) => {
      cyl(0.035, 0.38, x + lx * Math.cos(ry) - lz * Math.sin(ry), 0.19, z + lx * Math.sin(ry) + lz * Math.cos(ry), mat(0x2a1a08));
    });
    seats.push({ type: "sit", label: "SIT", x, z, dx: 0, dz: Math.sign(Math.cos(ry)) || 1, yaw: ry, h: 0.55, level: 0, taken: false });
  }
  formalChair(-1, 11.6 + 1.0, 0);
  formalChair( 1, 11.6 + 1.0, 0);

  // Gold-framed portraits on north wall
  box(0.8, 1.1, 0.05, -2.5, 3.2, 13.92, mat(0xd4af37));
  box(0.68, 0.95, 0.04, -2.5, 3.2, 13.95, mat(0x4a6030));
  box(0.8, 1.1, 0.05,  2.5, 3.2, 13.92, mat(0xd4af37));
  box(0.68, 0.95, 0.04,  2.5, 3.2, 13.95, mat(0x5a4030));

  // Potted palms by entrance
  cyl(0.28, 0.55, -3, 0.27, 13.2, mat(0x7a4a2a));
  cyl(0.1, 1.4, -3, 1.15, 13.2, mat(0x3a6a2a));
  sph(0.65, -3, 2.0, 13.2, mat(0x4a8a30));
  cyl(0.28, 0.55,  3, 0.27, 13.2, mat(0x7a4a2a));
  cyl(0.1, 1.4,  3, 1.15, 13.2, mat(0x3a6a2a));
  sph(0.65,  3, 2.0, 13.2, mat(0x4a8a30));

  // National flag
  cyl(0.03, 4.5, -1.5, 2.25, 13.8, mat(0xaaaaaa));
  box(1.2, 0.75, 0.02, -0.85, 4.5, 13.8, mat(0x2a8a3a));

  // Entrance door (south side, z=14 gap centred x=0)
  uses.push({ kind: "exit", label: "EXIT", x: 0, z: 13.5, y: 0, level: 0, r: 2 });

  /* ─── SECURITY POST ─── */
  // Guard desk
  box(2.4, 0.9, 0.6, -8, 0.45, 6.8, mat(0x3a3a40), { solid: true });
  box(2.6, 0.06, 0.7, -8, 0.93, 6.8, mat(0x4a4a4e));
  // Monitor screens
  {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.03), new THREE.MeshBasicMaterial({ color: 0x224466 }));
    s.position.set(-7.4, 1.4, 6.55); world.add(s);
    const s2 = s.clone(); s2.position.set(-8.5, 1.4, 6.55); world.add(s2);
  }
  cyl(0.26, 0.45, -8, 0.22, 7.55, mat(0x2a2a2e));
  box(0.5, 0.55, 0.06, -8, 0.72, 7.82, mat(0x2a2a2e));
  seats.push({ type: "sit", label: "GUARD STATION", x: -8, z: 7.55, dx: 0, dz: -1, yaw: Math.PI, h: 0.55, level: 0, taken: false });
  uses.push({ kind: "use", label: "MONITOR", x: -8, z: 6.2, y: 0, level: 0, r: 1.8 });

  // Metal detector arch
  box(0.1, 2.8, 0.1, -5.2, 1.4, 7, mat(0x5a5a64), { solid: true });
  box(0.1, 2.8, 0.1, -5.6, 1.4, 7, mat(0x5a5a64), { solid: true });
  box(0.42, 0.1, 0.1, -5.4, 2.82, 7, mat(0x5a5a64));
  const arcGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.6, 0.04), glow(0x44ff88));
  arcGlow.position.set(-5.38, 1.4, 7); world.add(arcGlow);

  // Waiting bench
  box(2.2, 0.14, 0.45, -9.5, 0.46, 9.2, mat(0x6a5030), { solid: true });
  [-0.85, 0.85].forEach(ox => cyl(0.06, 0.44, -9.5 + ox, 0.22, 9.6, mat(0x4a3820)));
  seats.push({ type: "sit", label: "WAIT", x: -9.5, z: 9.2, dx: 0, dz: -1, yaw: Math.PI, h: 0.55, level: 0, taken: false });

  /* ─── LOUNGE (right of entrance, x=4..14, z=4..12) ─── */
  // Large sofa (L-shape against east wall)
  box(4.2, 0.42, 0.9, 9.8, 0.21, 10.5, mat(0x8a3a3a), { solid: true });
  box(4.2, 0.72, 0.16, 9.8, 0.65, 10.08, mat(0x8a3a3a));
  box(0.16, 0.72, 3.8, 11.88, 0.65, 8.6, mat(0x8a3a3a), { solid: true });
  box(0.9, 0.42, 3.8, 11.5, 0.21, 8.6, mat(0x8a3a3a), { solid: true });
  // Seat cushions
  for (let i = 0; i < 3; i++) {
    box(1.2, 0.16, 0.75, 8.8 + i * 1.4, 0.5, 10.5, mat(0xb06060));
    box(1.2, 0.4, 0.14, 8.8 + i * 1.4, 0.78, 10.08, mat(0xb06060));
  }
  seats.push({ type: "sit", label: "SIT ON SOFA", x: 8.8,  z: 10.5, dx: 0, dz: 1, yaw: 0,          h: 0.55, level: 0, taken: false });
  seats.push({ type: "sit", label: "SIT ON SOFA", x: 10.2, z: 10.5, dx: 0, dz: 1, yaw: 0,          h: 0.55, level: 0, taken: false });
  seats.push({ type: "sit", label: "SIT ON SOFA", x: 11.6, z: 8.6,  dx:-1, dz: 0, yaw:-Math.PI/2,  h: 0.55, level: 0, taken: false });

  // Coffee table
  box(1.4, 0.06, 0.7, 9.5, 0.46, 9.8, mat(0x6a4820), { solid: true });
  box(1.35, 0.02, 0.65, 9.5, 0.5, 9.8, mat(0x8a6030));
  [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].forEach(([lx, lz]) =>
    cyl(0.04, 0.44, 9.5 + lx, 0.22, 9.8 + lz, mat(0x4a3010))
  );
  // Armchair opposite sofa
  box(0.85, 0.42, 0.85, 7.8, 0.21, 9.8, mat(0x6a3828), { solid: true });
  box(0.85, 0.65, 0.14, 7.8, 0.65, 9.4, mat(0x6a3828));
  [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].forEach(([lx, lz]) =>
    cyl(0.04, 0.38, 7.8 + lx, 0.19, 9.8 + lz, mat(0x3a1808))
  );
  seats.push({ type: "sit", label: "SIT", x: 7.8, z: 9.8, dx: 1, dz: 0, yaw: Math.PI/2, h: 0.55, level: 0, taken: false });

  // TV on east wall
  box(2.4, 0.06, 0.5, 13, 0.55, 8, mat(0x2a2a2e), { solid: true });
  box(2.4, 1.35, 0.06, 13, 1.5, 7.74, mat(0x0a0a10), { solid: true });
  {
    const tv = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.02), new THREE.MeshBasicMaterial({ color: 0x1a3a5a }));
    tv.position.set(13, 1.5, 7.76); world.add(tv);
  }
  uses.push({ kind: "watch", label: "WATCH TV", x: 9.5, z: 8.5, y: 0, level: 0, r: 3.5 });

  // Side table with lamp
  box(0.52, 0.6, 0.52, 7.0, 0.3, 11.4, mat(0x5a3818), { solid: true });
  cyl(0.04, 0.55, 7.0, 0.88, 11.4, mat(0x3a2810));
  cyl(0.18, 0.32, 7.0, 1.16, 11.4, glow(0xffe080));

  /* ─── GOVERNOR'S OFFICE (x=-14..-4, z=-6..4) ─── */
  // Governor's desk (imposing, centred in room)
  box(3.8, 0.9, 1.8, -9, 0.45, -0.5, mat(0x3a1a08), { solid: true });
  box(4.0, 0.06, 1.9, -9, 0.93, -0.5, mat(0x5a2a0e));
  box(3.8, 0.06, 0.1, -9, 0.5, 0.38, mat(0x5a2a0e));
  // Nameplate
  box(0.7, 0.06, 0.2, -9, 0.97, -0.06, mat(0xd4af37));
  // Monitor
  {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.03), new THREE.MeshBasicMaterial({ color: 0x1a2a3a }));
    m.position.set(-9, 1.5, -0.84); world.add(m);
  }
  box(0.2, 0.55, 0.2, -9, 0.73, -0.55, mat(0x2a2a2e));
  // Governor's chair
  cyl(0.35, 0.45, -9, 0.22, -1.9, mat(0x1a0a04));
  box(0.8, 1.1, 0.12, -9, 0.9, -2.2, mat(0x1a0a04));
  box(0.75, 0.42, 0.75, -9, 0.21, -1.9, mat(0x1a0a04), { solid: true });
  seats.push({ type: "sit", label: "SIT - GOVERNOR", x: -9, z: -1.9, dx: 0, dz: 1, yaw: 0, h: 0.55, level: 0, taken: false });
  uses.push({ kind: "use", label: "WORK AT DESK", x: -9, z: 0.8, y: 0, level: 0, r: 1.8 });

  // Two visitor chairs front of desk
  formalChair(-10.2, 0.9, Math.PI);
  formalChair( -7.8, 0.9, Math.PI);

  // Bookcase wall (west wall, x=-13.8)
  box(9.6, 4.5, 0.42, -9, 2.25, -5.6, mat(0x3a2010), { solid: true });
  for (let row = 0; row < 5; row++) {
    box(9.4, 0.06, 0.4, -9, 0.52 + row * 0.85, -5.6, mat(0x5a3018));
  }
  const bookColors = [0xb03030, 0x2060b0, 0x308040, 0xb08020, 0x802090, 0x208090];
  let bx = -13.5;
  while (bx < -4.5) {
    const bw = 0.08 + (Math.random() * 5 | 0) * 0.016;
    const bh = 0.22 + (Math.random() * 4 | 0) * 0.025;
    const row = Math.random() * 4 | 0;
    box(bw, bh, 0.28, bx + bw/2, 0.55 + row * 0.85 + bh/2, -5.6,
      mat(bookColors[Math.random() * 6 | 0]));
    bx += bw + 0.015;
  }

  // Globe
  sph(0.35, -5.6, 1.72, -5.3, mat(0x3870a8));
  cyl(0.04, 1.2, -5.6, 0.6, -5.3, mat(0x6a5030));
  cyl(0.2, 0.06, -5.6, 0.06, -5.3, mat(0x6a5030));
  uses.push({ kind: "read", label: "INSPECT GLOBE", x: -5.6, z: -4.8, y: 0, level: 0, r: 1.5 });

  // Potted plant by window (west wall)
  cyl(0.24, 0.5, -13.5, 0.25, 1.5, mat(0x7a4a2a));
  cyl(0.28, 0.22, -13.5, 0.52, 1.5, mat(0x5a3818));
  sph(0.5, -13.5, 1.1, 1.5, mat(0x4a8830));

  // Flag in office corner
  cyl(0.03, 4.8, -13.5, 2.4, -5.5, mat(0xaaaaaa));
  box(1.4, 0.85, 0.02, -12.8, 4.35, -5.5, mat(0x2a8a3a));
  // Second flag (national)
  cyl(0.03, 4.8, -13.5, 2.4, -4.0, mat(0xaaaaaa));
  box(1.4, 0.85, 0.02, -12.8, 4.35, -4.0, mat(0xa03030));

  /* ─── CONFERENCE ROOM (x=-4..4, z=-8..4) ─── */
  // Long conference table
  box(5.2, 0.06, 2.4, 0, 0.76, -3.5, mat(0x4a2808), { solid: true });
  box(5.2, 0.7, 2.4, 0, 0.38, -3.5, mat(0x3a1e06));
  // 10 chairs around the table
  const confPoses = [
    [-2.2, -2.0, Math.PI], [-0.8, -2.0, Math.PI], [0.6, -2.0, Math.PI], [2.0, -2.0, Math.PI],
    [-2.2, -5.0, 0],       [-0.8, -5.0, 0],        [0.6, -5.0, 0],       [2.0, -5.0, 0],
    [-3.4, -3.5, Math.PI/2], [3.4, -3.5, -Math.PI/2],
  ];
  confPoses.forEach(([cx, cz, ry]) => {
    box(0.52, 0.42, 0.5, cx, 0.21, cz, mat(0x5a3018), { solid: true });
    box(0.52, 0.65, 0.08, cx, 0.71, cz - 0.28 * Math.cos(ry) + 0.28 * Math.sin(ry) * 0, mat(0x5a3018));
    seats.push({ type: "sit", label: "SIT", x: cx, z: cz, dx: Math.sin(ry), dz: Math.cos(ry), yaw: ry, h: 0.55, level: 0, taken: false });
  });
  // Presentation screen on south wall
  box(4.5, 2.8, 0.08, 0, 2.6, -7.88, mat(0xf8f6f2), { solid: true });
  {
    const scr = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.5, 0.02), new THREE.MeshBasicMaterial({ color: 0x1a2a4a }));
    scr.position.set(0, 2.6, -7.82); world.add(scr);
  }
  uses.push({ kind: "use", label: "PRESENT", x: 0, z: -7, y: 0, level: 0, r: 2.2 });
  // Water pitchers
  cyl(0.06, 0.28, -2.5, 0.92, -3.5, mat(0x88b8d0));
  cyl(0.06, 0.28,  2.5, 0.92, -3.5, mat(0x88b8d0));
  cyl(0.035, 0.05, -2.5, 0.8, -3.5, glow(0xa0d8f0));

  /* ─── DINING ROOM (x=4..14, z=-6..4) ─── */
  // Oval dining table
  box(5.5, 0.06, 2.6, 9, 0.78, -1.5, mat(0x6a3010), { solid: true });
  box(5.5, 0.72, 2.6, 9, 0.39, -1.5, mat(0x4a1e06));
  // Chandelier above dining table
  cyl(0.035, 2.5, 9, H - 1.25, -1.5, mat(0xd4af37));
  cyl(0.5, 0.18, 9, H - 2.5, -1.5, mat(0xd4af37));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    cyl(0.025, 0.16, 9 + Math.cos(a) * 0.45, H - 2.62, -1.5 + Math.sin(a) * 0.45, glow(0xfff4c8));
  }
  // 8 dining chairs
  const diningPoses = [
    [6.2, -1.5, Math.PI/2], [7.5, -1.5, Math.PI/2], [10.5, -1.5, -Math.PI/2], [11.8, -1.5, -Math.PI/2],
    [9.0, 0.2, Math.PI], [9.0, -3.2, 0],
    [6.4, 0.2, Math.PI * 3/4], [11.6, 0.2, Math.PI * 5/4],
  ];
  diningPoses.forEach(([cx, cz, ry]) => {
    box(0.52, 0.42, 0.5, cx, 0.21, cz, mat(0x3a1808), { solid: true });
    box(0.52, 0.72, 0.08, cx, 0.68, cz, mat(0x3a1808));
    seats.push({ type: "sit", label: "DINE", x: cx, z: cz, dx: Math.sin(ry), dz: Math.cos(ry), yaw: ry, h: 0.55, level: 0, taken: false });
  });
  uses.push({ kind: "eat", label: "DINE", x: 9, z: -1.5, y: 0, level: 0, r: 2.8 });

  // Buffet / sideboard along east wall
  box(5.5, 0.9, 0.55, 9, 0.45, -5.2, mat(0x5a2a0a), { solid: true });
  box(5.7, 0.06, 0.65, 9, 0.93, -5.2, mat(0x8a5020));
  // Candelabra centrepiece on buffet
  cyl(0.05, 0.5, 9, 1.22, -5.2, mat(0xd4af37));
  for (let i = -1; i <= 1; i++) {
    cyl(0.02, 0.2, 9 + i * 0.4, 1.58, -5.2, glow(0xfff2a0));
  }

  // Framed artwork on dining south wall
  box(1.2, 1.6, 0.05, 9, 2.6, 3.92, mat(0xd4af37));
  box(1.05, 1.42, 0.04, 9, 2.6, 3.95, mat(0x8a5a3a));

  /* ─── PRIVATE STUDY (x=-14..-8, z=-14..-6) ─── */
  // Writing desk
  box(1.8, 0.82, 0.8, -11, 0.41, -10.5, mat(0x3a1e06), { solid: true });
  box(1.9, 0.06, 0.86, -11, 0.85, -10.5, mat(0x5a2e0a));
  // Inkwell / papers
  cyl(0.04, 0.08, -11.3, 0.92, -10.2, mat(0x1a1a1e));
  cyl(0.08, 0.03, -11.3, 0.9, -10.2, glow(0x1a1a1e));
  // Writing chair
  cyl(0.26, 0.45, -11, 0.22, -11.4, mat(0x3a2010));
  box(0.5, 0.55, 0.06, -11, 0.72, -11.7, mat(0x3a2010));
  seats.push({ type: "sit", label: "WRITE", x: -11, z: -11.4, dx: 0, dz: 1, yaw: 0, h: 0.55, level: 0, taken: false });
  uses.push({ kind: "read", label: "WRITE / READ", x: -11, z: -9.8, y: 0, level: 0, r: 1.6 });
  // Bookshelf
  box(5, 3.2, 0.38, -11, 1.6, -13.6, mat(0x3a2010), { solid: true });
  for (let r = 0; r < 4; r++) box(4.8, 0.05, 0.36, -11, 0.32 + r * 0.78, -13.6, mat(0x5a3018));
  // Reading lamp
  cyl(0.04, 1.2, -9.4, 0.6, -11.2, mat(0x2a2a2e));
  cyl(0.18, 0.22, -9.4, 1.28, -11.2, glow(0xffe090));

  /* ─── RESTROOM (x=8..14, z=-14..-6) ─── */
  // Toilet cubicle partition
  box(0.06, 2.0, 2.5, 9.6, 1.0, -12, mat(0xd0ccc8), { solid: true });
  box(2.5, 0.06, 0.06, 11.9, 2.0, -10.8, mat(0xd0ccc8));
  // Toilet
  box(0.42, 0.42, 0.22, 11, 0.21, -13.4, mat(0xf6f6f6));
  cyl(0.19, 0.4, 11, 0.2, -12.9, mat(0xf6f6f6));
  box(0.38, 0.06, 0.5, 11, 0.44, -13.06, mat(0xeaeaea));
  seats.push({ type: "toilet", label: "USE TOILET", x: 11, z: -12.9, dx: 0, dz: 1, yaw: 0, h: 0.48, level: 0, taken: false });
  // Vanity / sink
  box(1.4, 0.82, 0.5, 11, 0.41, -7.2, mat(0xdcdcdc), { solid: true });
  box(1.5, 0.06, 0.55, 11, 0.85, -7.2, mat(0xeaeaea));
  box(0.5, 0.16, 0.35, 11, 0.8, -6.98, mat(0x9a9ea4));
  cyl(0.025, 0.24, 11, 0.98, -7.05, mat(0xd0d4d8));
  box(0.75, 0.95, 0.04, 11, 1.7, -6.94, mat(0xb0d8e8));
  uses.push({ kind: "wash", label: "WASH HANDS", x: 11, z: -6.6, y: 0, level: 0, r: 1.4 });
  // Light strip above mirror
  box(1.2, 0.06, 0.06, 11, 2.22, -6.94, glow(0xfff8e0));

  /* ─── SPAWN ─── */
  const START = { x: 0, z: 12.5, yaw: Math.PI };

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
    bounds: { minX: -14.5, maxX: 14.5, minZ: -14.5, maxZ: 14.5 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene,
    x: START.x, z: START.z, yaw: START.yaw, level: 0,
    speedMult: 1.15,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "GOVERNOR",
    title: "GOVERNOR'S MANSION",
    subtitle: "STATE HOUSE",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "governor",
    update: (dt) => ctl.update(dt),
    dispose: () => ctl.dispose(),
  };
}

