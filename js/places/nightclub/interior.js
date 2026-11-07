/* nightclub/interior.js -- CLUB ECLIPSE
   The big feature is the LED DANCE FLOOR: a 7x7 grid of emissive tiles that
   pulse to the beat in 4 light shows (switch them at the DJ booth), under a
   spinning mirror ball with sweeping coloured beams.  Stand on the floor and
   press USE → DANCE.  Also: bar with stools, VIP sofas, DJ booth with a live
   equaliser screen, speaker stacks, smoke-haze glow, coat check. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07050c);
  scene.fog = new THREE.Fog(0x140c24, 14, 60);
  const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 100);

  const W = 30, D = 36, H = 7.5;
  const ROOM = { x: W / 2 - 0.5, z: D / 2 - 0.5 };
  const START = { x: 0, z: 14.5, yaw: 0 };

  scene.add(new THREE.HemisphereLight(0x8f7fd6, 0x2a1840, 1.1));
  scene.add(new THREE.AmbientLight(0x6a5a9a, 0.7));

  /* extra club lighting: entrance, bar/side areas, DJ stage */
  const fillLights = [];
  const addFill = (col, x, y, z, i, d) => {
    const l = new THREE.PointLight(col, i, d, 1.6); l.position.set(x, y, z); scene.add(l);
    fillLights.push({ l, base: i });
    return l;
  };
  addFill(0xffc9a8, 0, 4.5, START.z - 1, 2.4, 20);        /* entrance */
  addFill(0xff4ad0, -ROOM.x + 3, 4.2, 6, 2.2, 18);        /* left wall wash */
  addFill(0x4ad8ff, ROOM.x - 3, 4.2, 6, 2.2, 18);         /* right wall wash */
  addFill(0xb04aff, -ROOM.x + 3, 4.2, -8, 2.0, 18);
  addFill(0x4affb0, ROOM.x - 3, 4.2, -8, 2.0, 18);

  const BOXG = new THREE.BoxGeometry(1, 1, 1);
  const CYLG = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
  const SPHG = new THREE.SphereGeometry(0.5, 14, 10);
  const MC = new Map();
  const mat = (c, o) => {
    const k = c + "|" + JSON.stringify(o || 0); let m = MC.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); MC.set(k, m); }
    return m;
  };
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });

  const world = new THREE.Group(); scene.add(world);
  const solid = [], seats = [], uses = [];

  function box(w, h, d, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(BOXG, typeof m === "number" ? mat(m) : m);
    s.scale.set(w, h, d); s.position.set(x, y, z); s.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
    s.castShadow = false; s.receiveShadow = true; world.add(s);
    if (o.solid) solid.push({ x, z, hw: w / 2, hd: d / 2 });
    return s;
  }
  function cyl(r, h, x, y, z, m, o) {
    o = o || {};
    const s = new THREE.Mesh(CYLG, typeof m === "number" ? mat(m) : m);
    s.scale.set(r * 2, h, r * 2); s.position.set(x, y, z); world.add(s);
    if (o.solid) solid.push({ x, z, hw: r, hd: r });
    return s;
  }
  function sph(r, x, y, z, m) {
    const s = new THREE.Mesh(SPHG, typeof m === "number" ? mat(m) : m);
    s.scale.setScalar(r * 2); s.position.set(x, y, z); world.add(s); return s;
  }

  /* ───────── shell ───────── */
  box(W, 0.2, D, 0, -0.1, 0, 0x17131f);                         /* floor */
  box(W, H, 0.4, 0, H / 2, -D / 2, 0x1a1426, { solid: true });  /* back wall */
  box(0.4, H, D, -W / 2, H / 2, 0, 0x1a1426, { solid: true });
  box(0.4, H, D, W / 2, H / 2, 0, 0x1a1426, { solid: true });
  box(W, H, 0.4, 0, H / 2, D / 2, 0x1a1426, { solid: true });  /* front wall */
  box(W, 0.3, D, 0, H + 0.15, 0, 0x0c0912);                     /* ceiling */
  /* neon wall strips */
  const neonA = glow(0xb04aff), neonB = glow(0xff3ad0), neonC = glow(0x3ad8ff);
  box(W - 1, 0.12, 0.1, 0, 5.2, -D / 2 + 0.25, neonA);
  box(W - 1, 0.12, 0.1, 0, 5.6, -D / 2 + 0.25, neonB);
  for (const s of [-1, 1]) { box(0.1, 0.12, D - 2, s * (W / 2 - 0.25), 5.0, 0, neonC); box(0.1, 0.12, D - 2, s * (W / 2 - 0.25), 5.4, 0, neonA); }
  /* entrance */
  box(3.4, 4.2, 0.2, 0, 2.1, D / 2 - 0.25, 0x2a1a44, { solid: true });
  box(3.8, 0.3, 0.3, 0, 4.3, D / 2 - 0.3, neonB);

  /* ───────── DANCE FLOOR: 7x7 LED tiles ───────── */
  const N = 7, TILE = 1.7, GAP = 0.08;
  const FLOOR_Z = -1;                                           /* centre of the floor */
  const tiles = [];
  box(N * TILE + 0.6, 0.12, N * TILE + 0.6, 0, 0.06, FLOOR_Z, 0x0a0810);   /* frame */
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const m = new THREE.MeshBasicMaterial({ color: 0x220044 });
    const t = new THREE.Mesh(BOXG, m);
    t.scale.set(TILE - GAP, 0.05, TILE - GAP);
    t.position.set((i - (N - 1) / 2) * TILE, 0.14, FLOOR_Z + (j - (N - 1) / 2) * TILE);
    world.add(t);
    tiles.push({ m, i, j, d: Math.hypot(i - (N - 1) / 2, j - (N - 1) / 2) });
  }
  /* dance spots (USE → DANCE) at the middle and four quadrants */
  [[0, 0], [-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([x, z]) =>
    uses.push({ kind: "dance", label: "DANCE", x, z: FLOOR_Z + z, y: 0, level: 0, r: 2.2 }));

  /* ───────── mirror ball + beams ───────── */
  const ballG = new THREE.Group(); ballG.position.set(0, H - 1.6, FLOOR_Z); scene.add(ballG);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1),
    new THREE.MeshStandardMaterial({ color: 0xdfe6ff, metalness: 1, roughness: 0.12, flatShading: true }));
  ballG.add(ball);
  cyl(0.02, 1.6, 0, H - 0.8, FLOOR_Z, 0x555566);
  const beams = [];
  const beamCols = [0xff2ad0, 0x2ad8ff, 0xb04aff, 0x7dff6a];
  for (let k = 0; k < 4; k++) {
    const sp = new THREE.SpotLight(beamCols[k], 2.4, 30, 0.34, 0.5, 1.2);
    sp.position.set((k - 1.5) * 5, H - 0.6, FLOOR_Z - 7);
    const tgt = new THREE.Object3D(); scene.add(tgt); sp.target = tgt; scene.add(sp);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: beamCols[k], transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.copy(sp.position); scene.add(cone);
    beams.push({ sp, tgt, cone, k });
  }
  const djSpot = new THREE.SpotLight(0xfff0ff, 3.2, 26, 0.6, 0.6, 1.2);
  djSpot.position.set(0, H - 0.5, -D / 2 + 9);
  const djTgt = new THREE.Object3D(); djTgt.position.set(0, 1.2, -D / 2 + 3); scene.add(djTgt);
  djSpot.target = djTgt; scene.add(djSpot);
  const floorGlow = new THREE.PointLight(0xb04aff, 2.2, 22); floorGlow.position.set(0, 3, FLOOR_Z); scene.add(floorGlow);

  /* ───────── DJ booth + equaliser screen ───────── */
  const DJZ = -D / 2 + 3;
  box(10, 0.5, 4.5, 0, 0.25, DJZ, 0x14101c, { solid: true });                 /* stage */
  box(5.2, 1.1, 1.4, 0, 1.05, DJZ - 0.2, 0x211a30, { solid: true });          /* console */
  box(5.2, 0.06, 1.3, 0, 1.62, DJZ - 0.2, 0x0a0a10);
  for (const x of [-1.5, 1.5]) { cyl(0.45, 0.06, x, 1.68, DJZ - 0.2, 0x08080c); cyl(0.12, 0.07, x, 1.7, DJZ - 0.2, 0xff3ad0); }
  box(1.0, 0.1, 0.5, 0, 1.68, DJZ - 0.2, glow(0x3ad8ff));                     /* mixer glow */
  uses.push({ kind: "dj", label: "DJ BOOTH · CHANGE LIGHT SHOW", x: 0, z: DJZ + 1.4, y: 0, level: 0, r: 2.2 });
  const eqC = document.createElement("canvas"); eqC.width = 512; eqC.height = 192;
  const eqT = new THREE.CanvasTexture(eqC); eqT.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshBasicMaterial({ map: eqT }));
  screen.position.set(0, 4.0, -D / 2 + 0.3); scene.add(screen);
  const drawEQ = (t, show) => {
    const g = eqC.getContext("2d");
    g.fillStyle = "#07050c"; g.fillRect(0, 0, 512, 192);
    const bars = 32;
    for (let b = 0; b < bars; b++) {
      const h = 20 + (Math.sin(t * 5 + b * 0.7) * 0.5 + 0.5) * 100 * (0.5 + 0.5 * Math.sin(t * 2.4 + b * 0.2) ** 2);
      g.fillStyle = `hsl(${(b * 8 + t * 60) % 360},95%,60%)`;
      g.fillRect(b * 16 + 2, 150 - h, 12, h);
    }
    g.fillStyle = "#fff"; g.font = "bold 26px sans-serif"; g.textAlign = "center";
    g.fillText("CLUB ECLIPSE  ·  " + SHOWS[show].name, 256, 32);
    eqT.needsUpdate = true;
  };
  /* speaker stacks */
  for (const x of [-7.2, 7.2]) {
    box(1.8, 3.4, 1.4, x, 1.7, DJZ + 1.0, 0x0e0c14, { solid: true });
    cyl(0.5, 0.1, x, 0.9, DJZ + 1.72, 0x1a1a22).rotation.x = Math.PI / 2;
    cyl(0.5, 0.1, x, 2.4, DJZ + 1.72, 0x1a1a22).rotation.x = Math.PI / 2;
  }

  /* ───────── bar (left) ───────── */
  const BX = -W / 2 + 3;
  box(1.2, 1.15, 12, BX, 0.58, 3, 0x2a1a14, { solid: true });
  box(1.5, 0.08, 12.3, BX, 1.18, 3, 0x0e0a08);
  box(0.4, 2.8, 12, BX - 1.4, 1.5, 3, 0x1c1410, { solid: true });             /* back shelf */
  for (let k = 0; k < 10; k++) {
    const c = [0xff5a5a, 0x5affb0, 0xffd45a, 0x5ab4ff][k % 4];
    cyl(0.08, 0.34, BX - 1.2, 1.6 + (k % 2) * 0.6, -1.5 + k * 1.1, glow(c));
  }
  box(0.1, 0.12, 12, BX - 1.18, 2.05, 3, neonC);
  for (let k = 0; k < 6; k++) {
    const z = -1.5 + k * 2.0;
    cyl(0.25, 0.08, BX + 1.2, 0.78, z, 0x3a1a5a);
    cyl(0.04, 0.78, BX + 1.2, 0.39, z, 0x888890);
    seats.push({ type: "sit", label: "SIT AT BAR", x: BX + 1.2, z, yaw: -Math.PI / 2, h: 0.78, level: 0, taken: false });
  }
  uses.push({ kind: "drink", label: "ORDER A DRINK", x: BX + 1.2, z: 3, y: 0, level: 0, r: 4.0 });

  /* ───────── VIP booths (right) ───────── */
  const VX = W / 2 - 3.2;
  for (let k = 0; k < 3; k++) {
    const z = -1 + k * 5;
    box(2.4, 0.5, 4, VX, 0.25, z, 0x5a1a4a, { solid: true });                  /* sofa base */
    box(0.5, 1.3, 4, VX + 1.1, 0.95, z, 0x5a1a4a);                              /* back */
    box(1.6, 0.06, 1.6, VX - 2.0, 0.75, z, 0x0e0a14, { solid: true });          /* table */
    cyl(0.08, 0.75, VX - 2.0, 0.37, z, 0x888890);
    sph(0.07, VX - 2.0, 0.9, z, glow(0xffd45a));
    [-1.0, 0, 1.0].forEach(dz => seats.push({ type: "sit", label: "SIT IN VIP", x: VX, z: z + dz, yaw: Math.PI / 2, h: 0.5, level: 0, taken: false }));
  }
  box(0.14, 0.14, 15, W / 2 - 0.4, 3.2, 4, neonB);

  /* coat check + plants near entrance */
  box(4, 1.1, 1, -9, 0.55, D / 2 - 2.2, 0x1c1410, { solid: true });
  box(4, 0.08, 1.2, -9, 1.14, D / 2 - 2.2, 0x0e0a08);
  for (const x of [-4, 4]) { cyl(0.45, 0.7, x, 0.35, D / 2 - 2.2, 0x2a1a30, { solid: true }); sph(0.5, x, 1.1, D / 2 - 2.2, 0x2f7a3a); }

  /* ───────── LIGHT SHOWS (switch at the DJ booth) ───────── */
  const SHOWS = [
    { name: "RAINBOW WAVE" },
    { name: "BEAT CHECKERBOARD" },
    { name: "RIPPLE" },
    { name: "STROBE PARTY" },
  ];
  let show = 0, T = 0;
  const BPM = 118, BEAT = 60 / BPM;
  const hsl = (h, s, l) => new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l);

  const update = (dt) => {
    T += dt;
    const beat = (T / BEAT) % 1, kick = Math.pow(1 - beat, 3);
    for (const t of tiles) {
      let c;
      if (show === 0) c = hsl(T * 0.12 + (t.i + t.j) * 0.06, 1, 0.35 + 0.25 * kick);
      else if (show === 1) { const on = (t.i + t.j + Math.floor(T / BEAT)) % 2 === 0; c = on ? hsl(T * 0.05 + 0.85, 1, 0.45 + 0.2 * kick) : hsl(T * 0.05 + 0.55, 0.9, 0.12); }
      else if (show === 2) { const w = Math.sin(t.d * 1.3 - T * 5) * 0.5 + 0.5; c = hsl(0.75 + w * 0.2, 1, 0.1 + w * 0.5); }
      else { const on = Math.floor(T / (BEAT / 2)) % 2 === 0; c = on ? hsl(Math.random(), 1, 0.55) : new THREE.Color(0x050308); }
      t.m.color.copy(c);
    }
    ball.rotation.y += dt * 0.9;
    floorGlow.intensity = 2.4 + 2.2 * kick;
    fillLights.forEach((f, n) => {
      f.l.intensity = f.base * (0.85 + 0.35 * kick);
      if (n > 0) f.l.color.setHSL((T * 0.05 + n * 0.2) % 1, 1, 0.6);
    });
    floorGlow.color.setHSL((T * 0.08) % 1, 1, 0.55);
    for (const b of beams) {
      const a = T * 0.9 + b.k * 1.6;
      b.tgt.position.set(Math.sin(a) * 6, 0, FLOOR_Z + Math.cos(a * 1.3) * 6);
      b.sp.intensity = show === 3 ? (Math.floor(T / (BEAT / 2)) % 2 ? 4 : 0.2) : 2.4;
      b.cone.visible = b.sp.intensity > 1;
      b.cone.position.copy(b.sp.position);
      b.cone.lookAt(b.tgt.position); b.cone.rotateX(Math.PI / 2);
      b.cone.position.lerpVectors(b.sp.position, b.tgt.position, 0.5);
      b.cone.scale.set(1, b.sp.position.distanceTo(b.tgt.position) / 6, 1);
    }
    drawEQ(T, show);
  };

  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const cols = solid.map((b) => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level: 0 }));
  const __world = {
    colliders: cols, seats, uses, stairs: [], platforms: [],
    levelHeight: () => 0, ceilingHeight: H,
    bounds: { minX: -ROOM.x, maxX: ROOM.x, minZ: -ROOM.z, maxZ: ROOM.z },
  };
  const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (use, c) => {
      if (use.kind === "dance") { (c || ctl).playEmote("dance"); toast("🕺 Hit the dance floor!"); }
      else if (use.kind === "dj") { show = (show + 1) % SHOWS.length; toast("🎛 Light show: " + SHOWS[show].name); }
      else if (use.kind === "drink") { toast("🍹 Mocktail ordered — cheers!"); }
      else toast(use.label || "USE");
    },
  });

  return {
    three: scene, camera,
    controls: { update: () => {} },
    crumb: "CLUB ECLIPSE",
    title: "CLUB ECLIPSE",
    subtitle: "LED DANCE FLOOR",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: DANCE / DJ / BAR",
    isInterior: true,
    sceneId: "nightclub",
    update: (dt) => { update(dt); ctl.update(dt); },
    dispose: () => ctl.dispose(),
  };
}
