import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { JobsPanel } from "../../ui/jobs-panel.js";

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  // BRIGHT, welcoming room — no fog, no nightclub vibe
  scene.background = new THREE.Color(0xc8dcec);
  // Remove fog entirely — it was eating FPS and darkening everything

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 220);
  camera.rotation.order = "YXZ";

  // ---------- SHARED GEO ----------
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
  const CONE = new THREE.ConeGeometry(1, 1, 5);
  const SPH = new THREE.SphereGeometry(1, 8, 6);
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const TORUS = new THREE.TorusGeometry(1, 0.08, 4, 12);

  // ---------- LAMBERT MATS (cheap) ----------
  const LAM = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const BAS = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });

  const MAT = {
    room: LAM(0xd8e6f0, { side: THREE.BackSide }),
    ceiling: LAM(0xe8f0f5),
    floor: null, // built later with texture
    desk: LAM(0x6a5040),
    bench: LAM(0x556670),
    frame: LAM(0x4a3520),
    pot: LAM(0xa08070),
    bigPot: LAM(0x7a5a48),
    leaf: LAM(0x4a8a3a),
    darkLeaf: LAM(0x2a6a20),
    metal: LAM(0x333333),
    wire: BAS(0x111111),
    coolerBody: LAM(0xf0f0f0),
    bottle: new THREE.MeshLambertMaterial({
      color: 0x88c8f0, transparent: true, opacity: 0.55,
    }),
    screen: BAS(0x3388cc),
    signBg: BAS(0x0d47a1),
    glow: BAS(0x4fc3f7),
    shade: LAM(0x333333, { side: THREE.DoubleSide }),
    bulb: BAS(0xfff2b0),
    warm: BAS(0xffdd88),
  };

  const mkBox = (mat, sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(BOX, mat);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    return m;
  };
  const mkSph = (mat, r, x, y, z) => {
    const m = new THREE.Mesh(SPH, mat);
    m.scale.setScalar(r); m.position.set(x, y, z);
    return m;
  };

  // ---------- LIGHTING: NO POINT LIGHTS AT ALL ----------
  // Hemisphere + ambient is enough for Lambert. Zero per-fragment light cost.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a890, 1.3));
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  // ---------- ROOM SHELL ----------
  const room = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), MAT.room);
  room.position.y = 4;
  scene.add(room);

  // Floor — brighter tile, small canvas
  const fc = document.createElement("canvas");
  fc.width = fc.height = 128;
  const fx = fc.getContext("2d");
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      fx.fillStyle = (x + y) % 2 === 0 ? "#c8d8e8" : "#a8b8c8";
      fx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const floorTex = new THREE.CanvasTexture(fc);
  floorTex.anisotropy = 1;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshLambertMaterial({ map: floorTex })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  scene.add(floor);

  scene.add(mkBox(MAT.ceiling, 12, 0.01, 12, 0, 7.999, 0));

  // ---------- JOB BOARD ----------
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 0, -5.75);

  boardGroup.add(mkBox(MAT.frame, 4.4, 2.6, 0.18, 0, 1.6, 0));

  // board canvas — small + bright
  const bc = document.createElement("canvas");
  bc.width = 256; bc.height = 160;
  const bx = bc.getContext("2d");
  bx.fillStyle = "#c8a878"; bx.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 300; i++) {
    bx.fillStyle = `rgba(120,90,50,${Math.random() * 0.4})`;
    bx.fillRect(Math.random() * 256, Math.random() * 160, 2, 2);
  }
  const posts = [
    [15, 12, 70, 50, "#fffde0", "JOB"],
    [98, 18, 65, 45, "#e8f8ea", "HIRING"],
    [172, 10, 70, 55, "#fff2dc", "OPEN"],
    [20, 75, 65, 70, "#e0eeff", "APPLY"],
    [95, 75, 75, 50, "#fce0ea", "PART"],
    [180, 75, 60, 65, "#f0e0f8", "NOW"],
  ];
  posts.forEach(([x, y, w, h, c, text]) => {
    bx.fillStyle = c; bx.fillRect(x, y, w, h);
    bx.fillStyle = "#333"; bx.font = "bold 8px monospace";
    bx.textAlign = "center";
    bx.fillText(text, x + w / 2, y + 12);
    bx.fillStyle = "#aaa";
    for (let i = 0; i < 3; i++) {
      bx.fillRect(x + 4, y + 20 + i * 6, (w - 8) * (0.5 + Math.random() * 0.4), 2);
    }
    bx.fillStyle = "#cc2222";
    bx.beginPath(); bx.arc(x + w / 2, y + 4, 3, 0, Math.PI * 2); bx.fill();
  });
  const btex = new THREE.CanvasTexture(bc);
  btex.anisotropy = 1;
  const bs = new THREE.Mesh(PLANE, new THREE.MeshLambertMaterial({ map: btex }));
  bs.scale.set(4.0, 2.4, 1);
  bs.position.set(0, 1.6, 0.095);
  boardGroup.add(bs);

  // sign
  const sc = document.createElement("canvas");
  sc.width = 256; sc.height = 64;
  const sx = sc.getContext("2d");
  sx.fillStyle = "#0d47a1"; sx.fillRect(0, 0, 256, 64);
  sx.strokeStyle = "#4fc3f7"; sx.lineWidth = 3;
  sx.strokeRect(3, 3, 250, 58);
  sx.fillStyle = "#fff"; sx.font = "bold 28px sans-serif";
  sx.textAlign = "center"; sx.textBaseline = "middle";
  sx.fillText("JOB CENTER", 128, 34);
  const stex = new THREE.CanvasTexture(sc);
  stex.anisotropy = 1;
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 1.0, 0.12),
    [MAT.signBg, MAT.signBg, MAT.signBg, MAT.signBg,
      BAS(0xffffff, { map: stex }), MAT.signBg]
  );
  sign.position.set(0, 3.35, 0.1);
  boardGroup.add(sign);

  const glow = new THREE.Mesh(PLANE, MAT.glow);
  glow.scale.set(4.2, 0.08, 1);
  glow.position.set(0, 2.75, 0.12);
  boardGroup.add(glow);

  scene.add(boardGroup);

  // ---------- RECEPTION DESK ----------
  const desk = new THREE.Group();
  desk.position.set(-4.2, 0, -3.5);
  desk.add(mkBox(MAT.desk, 2.2, 0.12, 1.0, 0, 1.0, 0));
  desk.add(mkBox(MAT.desk, 2.2, 1.0, 0.12, 0, 0.5, 0.44));
  desk.add(mkBox(MAT.desk, 0.12, 1.0, 1.0, -1.04, 0.5, 0));
  desk.add(mkBox(MAT.desk, 0.12, 1.0, 1.0, 1.04, 0.5, 0));
  desk.add(mkBox(MAT.screen, 0.7, 0.5, 0.05, 0, 1.4, 0));
  desk.add(mkBox(MAT.metal, 0.08, 0.2, 0.08, 0, 1.05, 0));
  desk.add(mkBox(MAT.pot, 0.24, 0.18, 0.24, 0.7, 1.14, 0.1));
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const l = new THREE.Mesh(CONE, MAT.leaf);
    l.scale.set(0.06, 0.25, 0.06);
    l.position.set(0.7 + Math.cos(ang) * 0.05, 1.32, 0.1 + Math.sin(ang) * 0.05);
    l.rotation.z = Math.cos(ang) * 0.4;
    l.rotation.x = Math.sin(ang) * 0.4;
    desk.add(l);
  }
  scene.add(desk);

  // ---------- BENCHES ----------
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    b.add(mkBox(MAT.bench, 1.6, 0.08, 0.5, 0, 0.5, 0));
    b.add(mkBox(MAT.bench, 1.6, 0.5, 0.08, 0, 0.78, -0.21));
    b.add(mkBox(MAT.bench, 0.08, 0.5, 0.4, -0.7, 0.25, 0));
    b.add(mkBox(MAT.bench, 0.08, 0.5, 0.4, 0.7, 0.25, 0));
    b.position.set(3.8, 0, -2.5 + i * 1.6);
    b.rotation.y = -Math.PI / 2;
    scene.add(b);
  }

  // ---------- WATER COOLER ----------
  const cooler = new THREE.Group();
  const cb = new THREE.Mesh(CYL, MAT.coolerBody);
  cb.scale.set(0.25, 0.9, 0.25); cb.position.y = 0.45;
  cooler.add(cb);
  const bot = new THREE.Mesh(CYL, MAT.bottle);
  bot.scale.set(0.22, 0.55, 0.22); bot.position.y = 1.15;
  cooler.add(bot);
  cooler.add(mkBox(MAT.metal, 0.1, 0.15, 0.08, 0.22, 0.7, 0));
  cooler.position.set(-4.5, 0, 4.5);
  scene.add(cooler);

  // ---------- CORNER PLANTS ----------
  for (const [px, pz] of [[-5, -5], [5, -5], [5, 5], [-5, 5]]) {
    const plant = new THREE.Group();
    const pot = new THREE.Mesh(CYL, MAT.bigPot);
    pot.scale.set(0.35, 0.55, 0.35); pot.position.y = 0.28;
    plant.add(pot);
    for (let i = 0; i < 5; i++) {
      const h = 0.5 + (i % 3) * 0.15;
      const ang = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(CONE, MAT.darkLeaf);
      leaf.scale.set(0.12, h, 0.12);
      leaf.position.set(Math.cos(ang) * 0.1, 0.55 + h / 2, Math.sin(ang) * 0.1);
      leaf.rotation.z = Math.cos(ang) * 0.5;
      leaf.rotation.x = Math.sin(ang) * 0.5;
      plant.add(leaf);
    }
    plant.position.set(px, 0, pz);
    scene.add(plant);
  }

  // ---------- HANGING LIGHTS (visual only, emissive) ----------
  for (const side of [-1, 1]) {
    const wire = new THREE.Mesh(CYL, MAT.wire);
    wire.scale.set(0.015, 1.2, 0.015);
    wire.position.set(side * 3, 7.4, 0);
    scene.add(wire);
    const shade = new THREE.Mesh(CONE, MAT.shade);
    shade.scale.set(0.35, 0.4, 0.35);
    shade.rotation.x = Math.PI;
    shade.position.set(side * 3, 6.7, 0);
    scene.add(shade);
    scene.add(mkSph(MAT.bulb, 0.1, side * 3, 6.55, 0));
  }

  // ---------- POSTERS ----------
  [
    { pos: [-5.95, 3.5, 2], rot: Math.PI / 2, color: "#e91e63", label: "!" },
    { pos: [5.95, 4.0, -1], rot: -Math.PI / 2, color: "#ff9800", label: "?" },
    { pos: [-2.5, 4.0, 5.95], rot: Math.PI, color: "#9c27b0", label: "★" },
  ].forEach((p) => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const cx = c.getContext("2d");
    cx.fillStyle = p.color; cx.fillRect(0, 0, 64, 64);
    cx.fillStyle = "#fff"; cx.font = "bold 40px sans-serif";
    cx.textAlign = "center"; cx.textBaseline = "middle";
    cx.fillText(p.label, 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 1;
    const poster = new THREE.Mesh(PLANE, new THREE.MeshLambertMaterial({ map: t }));
    poster.scale.set(0.8, 0.8, 1);
    poster.position.set(...p.pos);
    poster.rotation.y = p.rot;
    scene.add(poster);
  });

  // ---------- COLLIDERS ----------
  const colliders = [
    { minX: -2.2, maxX: 2.2, minZ: -5.9, maxZ: -5.55, y0: 0, y1: 4.5, level: 0 },
    { minX: -6, maxX: 6, minZ: -6.1, maxZ: -5.9, y0: 0, y1: 8, level: 0 },
    { minX: -6, maxX: 6, minZ: 5.9, maxZ: 6.1, y0: 0, y1: 8, level: 0 },
    { minX: -6.1, maxX: -5.9, minZ: -6, maxZ: 6, y0: 0, y1: 8, level: 0 },
    { minX: 5.9, maxX: 6.1, minZ: -6, maxZ: 6, y0: 0, y1: 8, level: 0 },
    { minX: -5.35, maxX: -3.05, minZ: -4.05, maxZ: -2.95, y0: 0, y1: 1.2, level: 0 },
    { minX: 3.45, maxX: 4.15, minZ: -3.4, maxZ: -1.6, y0: 0, y1: 1.0, level: 0 },
    { minX: 3.45, maxX: 4.15, minZ: -1.8, maxZ: 0.0, y0: 0, y1: 1.0, level: 0 },
    { minX: 3.45, maxX: 4.15, minZ: -0.2, maxZ: 1.6, y0: 0, y1: 1.0, level: 0 },
    { minX: -4.8, maxX: -4.2, minZ: 4.2, maxZ: 4.8, y0: 0, y1: 1.4, level: 0 },
    { minX: -5.4, maxX: -4.6, minZ: -5.4, maxZ: -4.6, y0: 0, y1: 1.2, level: 0 },
    { minX: 4.6, maxX: 5.4, minZ: -5.4, maxZ: -4.6, y0: 0, y1: 1.2, level: 0 },
    { minX: 4.6, maxX: 5.4, minZ: 4.6, maxZ: 5.4, y0: 0, y1: 1.2, level: 0 },
    { minX: -5.4, maxX: -4.6, minZ: 4.6, maxZ: 5.4, y0: 0, y1: 1.2, level: 0 },
  ];

  const uses = [
    { kind: "use", label: "VIEW JOBS", x: 0, z: -4.5, y: 0, level: 0, r: 2.4 },
  ];

  const world = {
    colliders, seats: [], uses, platforms: [],
    levelHeight: () => 0,
    ceilingHeight: 8.0,
    bounds: { minX: -5.5, maxX: 5.5, minZ: -5.5, maxZ: 5.5 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: 0, z: 4, yaw: Math.PI, level: 0,
    onUse: (use) => {
      if (use.label === "VIEW JOBS") JobsPanel.show();
    },
  });

  let accum = 0;
  let glowOn = true;

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "JOB CENTER",
    title: "EMPLOYMENT HUB",
    subtitle: "FIND WORK",
    hint: "WALK TO THE BOARD & PRESS E",
    isInterior: true,
    sceneId: "jobcenter",
    update: (dt) => {
      ctl.update(dt);

      accum += dt;
      if (accum < 0.06) return; // ~16Hz
      accum = 0;

      const t = performance.now() * 0.001;

      // Subtle glow pulse — cheap
      glowOn = !glowOn;
      glow.material.color.setHex(glowOn ? 0x4fc3f7 : 0x3a9ac8);
    },
    dispose: () => ctl.dispose(),
  };
}
