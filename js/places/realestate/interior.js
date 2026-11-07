import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { HousesPanel } from "../../ui/houses-panel.js";

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  // Bright, welcoming — no fog (fog costs + darkens)
  scene.background = new THREE.Color(0xcfe4f4);

  const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 220);
  camera.rotation.order = "YXZ";

  // ---------- SHARED GEO ----------
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
  const CONE = new THREE.ConeGeometry(1, 1, 5);
  const SPH = new THREE.SphereGeometry(1, 8, 6);
  const PLANE = new THREE.PlaneGeometry(1, 1);

  // ---------- SHARED MATS ----------
  const LAM = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const BAS = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });

  const MAT = {
    room: LAM(0xf0f4f8, { side: THREE.BackSide }),
    ceiling: LAM(0xe8eef4),
    desk: LAM(0x8a5a34),
    deskDark: LAM(0x6a4020),
    chair: LAM(0x2c3e50),
    sofa: LAM(0x455a64),
    sofaCushion: LAM(0x607d8b),
    frameDark: LAM(0x2c3e50),
    frameGold: LAM(0xc9a227),
    pot: LAM(0xa08070),
    leaf: LAM(0x3a7a2a),
    darkLeaf: LAM(0x2a5a1a),
    metal: LAM(0x333333),
    screen: BAS(0x3388cc),
    signBg: BAS(0xc62828),
    glow: BAS(0xffd54f),
    warm: BAS(0xfff2b0),
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

  // ---------- LIGHTING (no point lights) ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8b8a0, 1.35));
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  // ---------- ROOM ----------
  const room = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), MAT.room);
  room.position.y = 4;
  scene.add(room);

  // Checkered light tile floor (small canvas)
  const fc = document.createElement("canvas");
  fc.width = fc.height = 128;
  const fx = fc.getContext("2d");
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      fx.fillStyle = (x + y) % 2 === 0 ? "#e8eef4" : "#c8d4dc";
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

  // ---------- RECEPTION DESK ----------
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, 0, -4);

  // Top
  deskGroup.add(mkBox(MAT.desk, 3.2, 0.15, 1.1, 0, 1.05, 0));
  // Front panel
  deskGroup.add(mkBox(MAT.deskDark, 3.0, 1.0, 0.12, 0, 0.5, 0.5));
  // Side panels
  deskGroup.add(mkBox(MAT.deskDark, 0.12, 1.0, 1.0, -1.5, 0.5, 0));
  deskGroup.add(mkBox(MAT.deskDark, 0.12, 1.0, 1.0, 1.5, 0.5, 0));
  // Gold trim line
  deskGroup.add(mkBox(MAT.frameGold, 3.2, 0.05, 0.02, 0, 0.15, 0.57));

  // Monitor
  deskGroup.add(mkBox(MAT.metal, 0.15, 0.25, 0.15, -0.7, 1.25, 0));
  deskGroup.add(mkBox(MAT.screen, 0.9, 0.55, 0.05, -0.7, 1.7, 0));

  // Nameplate
  deskGroup.add(mkBox(MAT.frameGold, 0.8, 0.1, 0.02, 0.8, 1.15, 0.4));

  // Small plant on desk
  const dpot = new THREE.Mesh(CYL, MAT.pot);
  dpot.scale.set(0.14, 0.16, 0.14); dpot.position.set(1.0, 1.2, 0.1);
  deskGroup.add(dpot);
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const l = new THREE.Mesh(CONE, MAT.leaf);
    l.scale.set(0.06, 0.22, 0.06);
    l.position.set(1.0 + Math.cos(ang) * 0.05, 1.4, 0.1 + Math.sin(ang) * 0.05);
    l.rotation.z = Math.cos(ang) * 0.4;
    l.rotation.x = Math.sin(ang) * 0.4;
    deskGroup.add(l);
  }

  scene.add(deskGroup);

  // ---------- CHAIR BEHIND DESK ----------
  const chair = new THREE.Group();
  chair.position.set(0, 0, -4.9);
  chair.add(mkBox(MAT.chair, 0.6, 0.08, 0.6, 0, 0.55, 0));
  chair.add(mkBox(MAT.chair, 0.6, 0.65, 0.08, 0, 0.85, -0.26));
  chair.add(mkBox(MAT.metal, 0.08, 0.5, 0.08, 0, 0.28, 0));
  scene.add(chair);

  // ---------- WAITING SOFA (against right wall) ----------
  const sofa = new THREE.Group();
  sofa.position.set(4.3, 0, -1.5);
  sofa.rotation.y = -Math.PI / 2;
  // Base
  sofa.add(mkBox(MAT.sofa, 2.4, 0.5, 0.9, 0, 0.35, 0));
  // Back
  sofa.add(mkBox(MAT.sofa, 2.4, 0.6, 0.2, 0, 0.85, -0.35));
  // Cushions
  sofa.add(mkBox(MAT.sofaCushion, 1.0, 0.15, 0.7, -0.55, 0.65, 0.05));
  sofa.add(mkBox(MAT.sofaCushion, 1.0, 0.15, 0.7, 0.55, 0.65, 0.05));
  // Armrests
  sofa.add(mkBox(MAT.sofa, 0.2, 0.35, 0.9, -1.1, 0.78, 0));
  sofa.add(mkBox(MAT.sofa, 0.2, 0.35, 0.9, 1.1, 0.78, 0));
  // Legs
  for (const lx of [-1.0, 1.0]) {
    for (const lz of [-0.35, 0.35]) {
      sofa.add(mkBox(MAT.deskDark, 0.08, 0.15, 0.08, lx, 0.07, lz));
    }
  }
  scene.add(sofa);

  // ---------- COFFEE TABLE (in front of sofa) ----------
  const table = new THREE.Group();
  table.position.set(3.0, 0, -1.5);
  table.add(mkBox(MAT.desk, 1.2, 0.06, 0.6, 0, 0.42, 0));
  for (const lx of [-0.5, 0.5]) {
    for (const lz of [-0.22, 0.22]) {
      table.add(mkBox(MAT.deskDark, 0.06, 0.42, 0.06, lx, 0.21, lz));
    }
  }
  // Magazine on table
  table.add(mkBox(MAT.frameGold, 0.35, 0.02, 0.25, 0.1, 0.46, 0));
  scene.add(table);

  // ---------- FRAMED PROPERTY PHOTOS ON BACK WALL ----------
  // Small canvases showing "houses" — procedurally
  function makeHousePhoto(bgColor, roofColor, skyColor) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    // Sky
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, 64, 64);
    // Grass
    ctx.fillStyle = "#6aa84f";
    ctx.fillRect(0, 44, 64, 20);
    // House body
    ctx.fillStyle = bgColor;
    ctx.fillRect(16, 28, 32, 20);
    // Roof
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(12, 28);
    ctx.lineTo(32, 14);
    ctx.lineTo(52, 28);
    ctx.closePath();
    ctx.fill();
    // Door
    ctx.fillStyle = "#5a3a20";
    ctx.fillRect(29, 36, 6, 12);
    // Window
    ctx.fillStyle = "#ffe580";
    ctx.fillRect(20, 33, 5, 5);
    ctx.fillRect(39, 33, 5, 5);
    // Sun
    ctx.fillStyle = "#fff59d";
    ctx.beginPath(); ctx.arc(52, 10, 4, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  const photoSpecs = [
    { x: -3.5, color: "#e8d5b7", roof: "#c62828", sky: "#bbdefb" },
    { x: 0, color: "#cfd8dc", roof: "#2e7d32", sky: "#b3e5fc" },
    { x: 3.5, color: "#ffe0b2", roof: "#6a1b9a", sky: "#c5e1a5" },
  ];
  for (const spec of photoSpecs) {
    const tex = makeHousePhoto(spec.color, spec.roof, spec.sky);
    tex.anisotropy = 1;

    // Frame (dark wood, with gold inner border)
    const frameGroup = new THREE.Group();
    frameGroup.position.set(spec.x, 3.0, -5.95);

    frameGroup.add(mkBox(MAT.frameDark, 1.3, 1.3, 0.08, 0, 0, 0));
    frameGroup.add(mkBox(MAT.frameGold, 1.15, 1.15, 0.06, 0, 0, 0.02));

    const photo = new THREE.Mesh(PLANE, new THREE.MeshLambertMaterial({ map: tex }));
    photo.scale.set(1.05, 1.05, 1);
    photo.position.z = 0.06;
    frameGroup.add(photo);

    scene.add(frameGroup);
  }

  // ---------- SIGN OVER DESK ----------
  const sc = document.createElement("canvas");
  sc.width = 256; sc.height = 64;
  const sctx = sc.getContext("2d");
  sctx.fillStyle = "#c62828"; sctx.fillRect(0, 0, 256, 64);
  sctx.strokeStyle = "#ffd54f"; sctx.lineWidth = 3;
  sctx.strokeRect(3, 3, 250, 58);
  sctx.fillStyle = "#fff"; sctx.font = "bold 26px sans-serif";
  sctx.textAlign = "center"; sctx.textBaseline = "middle";
  sctx.fillText("PROPERTY OFFICE", 128, 34);
  const signTex = new THREE.CanvasTexture(sc);
  signTex.anisotropy = 1;

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 1.0, 0.12),
    [MAT.signBg, MAT.signBg, MAT.signBg, MAT.signBg,
      BAS(0xffffff, { map: signTex }), MAT.signBg]
  );
  sign.position.set(0, 5.5, -5.9);
  scene.add(sign);

  const signGlow = new THREE.Mesh(PLANE, MAT.glow);
  signGlow.scale.set(3.6, 0.06, 1);
  signGlow.position.set(0, 4.95, -5.85);
  scene.add(signGlow);

  // ---------- CORNER PLANTS ----------
  for (const [px, pz] of [[-5, -5], [5, 5], [-5, 5]]) {
    const plant = new THREE.Group();
    const pot = new THREE.Mesh(CYL, MAT.pot);
    pot.scale.set(0.4, 0.6, 0.4); pot.position.y = 0.3;
    plant.add(pot);
    for (let i = 0; i < 6; i++) {
      const h = 0.55 + (i % 3) * 0.18;
      const ang = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(CONE, MAT.darkLeaf);
      leaf.scale.set(0.14, h, 0.14);
      leaf.position.set(Math.cos(ang) * 0.12, 0.6 + h / 2, Math.sin(ang) * 0.12);
      leaf.rotation.z = Math.cos(ang) * 0.5;
      leaf.rotation.x = Math.sin(ang) * 0.5;
      plant.add(leaf);
    }
    plant.position.set(px, 0, pz);
    scene.add(plant);
  }

  // ---------- CEILING LIGHTS (visual only) ----------
  for (const side of [-1, 1]) {
    scene.add(mkSph(MAT.warm, 0.12, side * 3, 7.85, 0));
    const shade = new THREE.Mesh(CONE, MAT.metal);
    shade.scale.set(0.25, 0.2, 0.25);
    shade.rotation.x = Math.PI;
    shade.position.set(side * 3, 7.9, 0);
    scene.add(shade);
  }

  // ---------- COLLIDERS ----------
  const colliders = [
    // Desk
    { minX: -1.6, maxX: 1.6, minZ: -4.6, maxZ: -3.4, y0: 0, y1: 1.2, level: 0 },
    // Chair behind desk
    { minX: -0.35, maxX: 0.35, minZ: -5.25, maxZ: -4.55, y0: 0, y1: 1.2, level: 0 },
    // Sofa
    { minX: 3.75, maxX: 4.85, minZ: -2.7, maxZ: -0.3, y0: 0, y1: 1.1, level: 0 },
    // Coffee table
    { minX: 2.4, maxX: 3.6, minZ: -1.8, maxZ: -1.2, y0: 0, y1: 0.5, level: 0 },
    // Corner plants
    { minX: -5.4, maxX: -4.6, minZ: -5.4, maxZ: -4.6, y0: 0, y1: 1.2, level: 0 },
    { minX: 4.6, maxX: 5.4, minZ: 4.6, maxZ: 5.4, y0: 0, y1: 1.2, level: 0 },
    { minX: -5.4, maxX: -4.6, minZ: 4.6, maxZ: 5.4, y0: 0, y1: 1.2, level: 0 },
    // Walls
    { minX: -6, maxX: 6, minZ: -6.1, maxZ: -5.9, y0: 0, y1: 8, level: 0 },
    { minX: -6, maxX: 6, minZ: 5.9, maxZ: 6.1, y0: 0, y1: 8, level: 0 },
    { minX: -6.1, maxX: -5.9, minZ: -6, maxZ: 6, y0: 0, y1: 8, level: 0 },
    { minX: 5.9, maxX: 6.1, minZ: -6, maxZ: 6, y0: 0, y1: 8, level: 0 },
  ];

  const uses = [
    { kind: "use", label: "BUY PROPERTY", x: 0, z: -3, y: 0, level: 0, r: 2.5 },
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
      if (use.label === "BUY PROPERTY") HousesPanel.show();
    },
  });

  // Throttled glow pulse
  let accum = 0;
  let glowOn = true;

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "REAL ESTATE",
    title: "PROPERTY OFFICE",
    subtitle: "BUY & SELL",
    hint: "WALK TO THE DESK & PRESS E",
    isInterior: true,
    sceneId: "realestate",
    update: (dt) => {
      ctl.update(dt);
      accum += dt;
      if (accum < 0.08) return;
      accum = 0;
      glowOn = !glowOn;
      signGlow.material.color.setHex(glowOn ? 0xffd54f : 0xddb830);
    },
    dispose: () => ctl.dispose(),
  };
}
