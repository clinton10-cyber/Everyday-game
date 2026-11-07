/* js/vehicles/models.js -- Math-driven 3D models for all vehicles */
import * as THREE from "three";
import { buildMercedes3D } from "./mercedes3d.js";
import { buildBMW3D } from "./bmw3d.js";
import { buildChiron3D } from "./chiron3d.js";

/* Helper to make a standard PBR paint material */
function paintMat(body) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(body),
    roughness: 0.25,
    metalness: 0.65
  });
}

/* Helper to make a rim material */
function rimMat(rim) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(rim),
    roughness: 0.2,
    metalness: 0.9
  });
}

/* Helper to make a detailed wheel */
function makeWheel(radius, width, rimColor) {
  const g = new THREE.Group();

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }));
  tire.castShadow = true;
  g.add(tire);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width + 0.02, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat(rimColor));
  g.add(rim);

  for (let i = 0; i < 5; i++) {
    const spokeGeo = new THREE.BoxGeometry(width + 0.04, radius * 0.12, radius * 1.1);
    const spoke = new THREE.Mesh(spokeGeo, rimMat(rimColor));
    spoke.rotation.x = (i / 5) * Math.PI * 2;
    g.add(spoke);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, width + 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  hub.rotation.z = Math.PI / 2;
  g.add(hub);

  return g;
}

/* Helper to make a glass material */
function glassMat() {
  return new THREE.MeshStandardMaterial({
    color: 0x0a1520,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.6
  });
}

/* ── 1. G-WAGON ────────────────────────────────────────────────── */
export function buildGWagon(body = "#1b1f24", rim = "#c9ced6") {
  const g = new THREE.Group();
  const paint = paintMat(body);
  const blackTrim = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 });
  const glass = glassMat();

  const mainBox = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 1.9), paint);
  mainBox.position.y = 0.95;
  mainBox.castShadow = true;
  g.add(mainBox);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.85), paint);
  cabin.position.set(-0.4, 2.0, 0);
  cabin.castShadow = true;
  g.add(cabin);

  const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 1.75), glass);
  frontGlass.position.set(1.2, 2.0, 0);
  frontGlass.rotation.z = -0.15;
  g.add(frontGlass);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 1.75), glass);
  rearGlass.position.set(-2.0, 2.0, 0);
  g.add(rearGlass);

  for (const sx of [-1, 1]) {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.75, 0.05), glass);
    sideGlass.position.set(-0.4, 2.0, sx * 0.95);
    g.add(sideGlass);
  }

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 1.6), blackTrim);
  grille.position.set(2.2, 0.9, 0);
  g.add(grille);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 1.95), blackTrim);
  bumper.position.set(2.2, 0.5, 0);
  g.add(bumper);

  for (const sx of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    light.position.set(2.21, 1.0, sx * 0.6);
    g.add(light);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.2), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    tail.position.set(-2.21, 1.0, sx * 0.7);
    g.add(tail);
  }

  const rack = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.6), blackTrim);
  rack.position.set(-0.4, 2.5, 0);
  g.add(rack);

  const spare = makeWheel(0.45, 0.3, rim);
  spare.position.set(-2.4, 0.95, 0);
  spare.rotation.y = Math.PI / 2;
  g.add(spare);

  const wheels = [];
  const wPositions = [
    [1.5, 0.45, 0.95], [1.5, 0.45, -0.95],
    [-1.5, 0.45, 0.95], [-1.5, 0.45, -0.95]
  ];
  for (const p of wPositions) {
    const w = makeWheel(0.48, 0.32, rim);
    w.position.set(p[0], p[1], p[2]);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;

  for (const wx of [1.5, -1.5]) {
    for (const wz of [1, -1]) {
      const fender = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.2), blackTrim);
      fender.position.set(wx, 0.65, wz * 1.0);
      g.add(fender);
    }
  }

  return g;
}

/* ── 2. MERCEDES S-CLASS (W223) ──────────────────────────────────
   Delegates to the ported W223 model in mercedes3d.js.
   Wheels are axle-along-Z and tagged spinZ: true. */
export function buildMercedes(body = "#b9c3cd", rim = "#c9ced6") {
  return buildMercedes3D(body, rim);
}

/* ── 3. CYBERTRUCK ──────────────────────────────────────────────── */
export function buildCybertruck(body = "#b8bcc2", rim = "#2b2b2b") {
  const g = new THREE.Group();

  const steel = new THREE.MeshStandardMaterial({
    color: new THREE.Color(body),
    roughness: 0.35,
    metalness: 0.95,
    side: THREE.DoubleSide
  });
  const glass = glassMat();

  const shape = new THREE.Shape();
  shape.moveTo(-2.6, 0.3);
  shape.lineTo(2.6, 0.3);
  shape.lineTo(2.6, 0.7);
  shape.lineTo(1.5, 1.3);
  shape.lineTo(0.0, 1.7);
  shape.lineTo(-1.4, 1.7);
  shape.lineTo(-2.6, 1.0);
  shape.closePath();

  const extrudeSettings = {
    depth: 1.9,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 2,
    bevelSize: 0.05,
    bevelThickness: 0.05
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -0.95);
  const bodyMesh = new THREE.Mesh(geo, steel);
  bodyMesh.castShadow = true;
  g.add(bodyMesh);

  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 1.92), glass);
  sideGlass.position.set(-0.3, 1.35, 0);
  sideGlass.rotation.z = -0.1;
  g.add(sideGlass);

  const wheels = [];
  for (const wx of [1.7, -1.7]) {
    for (const wz of [1.0, -1.0]) {
      const w = makeWheel(0.52, 0.34, rim);
      w.position.set(wx, 0.52, wz);
      const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.1, 3), steel);
      fender.rotation.z = Math.PI / 2;
      fender.rotation.y = Math.PI / 2;
      fender.position.set(wx, 0.52, wz);
      g.add(fender);

      g.add(w);
      wheels.push(w);
    }
  }
  g.userData.wheels = wheels;

  const frontBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  frontBar.position.set(2.6, 0.7, 0);
  g.add(frontBar);

  const rearBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  rearBar.position.set(-2.6, 1.0, 0);
  g.add(rearBar);

  return g;
}

/* ── 4. RANGE ROVER ─────────────────────────────────────────────── */
export function buildRangeRover(body = "#f2f4f7", rim = "#0d0d0f") {
  const g = new THREE.Group();
  const paint = paintMat(body);
  const blackTrim = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const glass = glassMat();

  const lower = new THREE.Mesh(new THREE.BoxGeometry(4.9, 1.0, 2.0), paint);
  lower.position.y = 0.9;
  lower.castShadow = true;
  g.add(lower);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 1.8), blackTrim);
  roof.position.set(-0.3, 2.2, 0);
  g.add(roof);

  const glassBlock = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 1.85), glass);
  glassBlock.position.set(-0.3, 1.7, 0);
  g.add(glassBlock);

  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 0.1), paint);
    pillar.position.set(-0.3, 1.7, sx * 0.92);
    g.add(pillar);
  }

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.4), blackTrim);
  grille.position.set(2.45, 1.0, 0);
  g.add(grille);

  for (const sx of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    light.position.set(2.46, 1.15, sx * 0.75);
    g.add(light);
  }

  const wheels = [];
  for (const wx of [1.6, -1.6]) {
    for (const wz of [1.0, -1.0]) {
      const w = makeWheel(0.48, 0.3, rim);
      w.position.set(wx, 0.48, wz);
      g.add(w);
      wheels.push(w);
    }
  }
  g.userData.wheels = wheels;

  return g;
}

/* ── 5. TOYOTA HILUX (ported from the standalone 3D model) ───────── */
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clampG = (v, a, b) => v < a ? a : v > b ? b : v;

function extrudeProfile(points, depth, material) {
  const shape = new THREE.Shape(points);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: false, curveSegments: 1, steps: 1
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function quadsGeometry(list) {
  const pos = [];
  for (const [a, b, c, d] of list) {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function cyl(rt, rb, h, seg, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function buildHilux(bodyColor = "#d6dce3", rimColor = "#c9ced6") {
  const g = new THREE.Group();
  const LOW = false;

  const HALF_W    = 0.93;
  const CAB_HW    = 0.86;
  const GROUND    = 0.55;
  const AXLE_F    = 1.55;
  const AXLE_R    = -1.45;
  const WHEEL_R   = 0.42;
  const ARCH_R    = 0.56;
  const WHEELBASE = AXLE_F - AXLE_R;
  /* Arch apex = WHEEL_R + ARCH_R = 0.98. The bed floor MUST sit above
     this or the extruded silhouette self-intersects and earcut tears
     the body. BED_FLOOR_Y is the corrected value. */
  const BED_FLOOR_Y = 1.02;
  const BED_RAIL_Y  = 1.36;
  const BED_WALL_H  = BED_RAIL_Y - BED_FLOOR_Y;

  function cvs(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 1;
    return t;
  }

  const treadTex = cvs(64, 64, (x, w, h) => {
    x.fillStyle = '#101113'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1d2023';
    for (let i = 0; i < 8; i++) x.fillRect(i * 8 + 1, 0, 5, h);
    x.fillStyle = '#0a0b0c';
    for (let i = 0; i < 8; i++) x.fillRect(i * 8 + 6, 0, 2, h);
  });
  treadTex.wrapS = treadTex.wrapT = THREE.RepeatWrapping;
  treadTex.repeat.set(9, 1);

  const rimTex = cvs(256, 256, (x) => {
    const C = 128;
    x.fillStyle = '#0d0e10'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#15171a'; x.beginPath(); x.arc(C, C, 126, 0, TAU); x.fill();
    const ring = x.createRadialGradient(C - 40, C - 40, 40, C, C, 100);
    ring.addColorStop(0, rimColor);
    ring.addColorStop(1, '#5a6470');
    x.fillStyle = ring;
    x.beginPath(); x.arc(C, C, 98, 0, TAU); x.fill();
    x.fillStyle = '#5c646d';
    for (let i = 0; i < 6; i++) {
      x.save(); x.translate(C, C); x.rotate(i * TAU / 6);
      x.beginPath();
      x.moveTo(-15, -14); x.lineTo(15, -14); x.lineTo(10, -94); x.lineTo(-10, -94);
      x.closePath(); x.fill();
      x.strokeStyle = '#8e98a2'; x.lineWidth = 2; x.stroke();
      x.restore();
    }
    x.fillStyle = '#aab4be'; x.beginPath(); x.arc(C, C, 34, 0, TAU); x.fill();
    x.fillStyle = '#31363c'; x.beginPath(); x.arc(C, C, 13, 0, TAU); x.fill();
    x.fillStyle = '#c9d2db';
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 - 0.4;
      x.beginPath(); x.arc(C + Math.cos(a) * 23, C + Math.sin(a) * 23, 5, 0, TAU); x.fill();
    }
  });

  const grilleTex = cvs(128, 64, (x, w, h) => {
    x.fillStyle = '#0a0c0e'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const gg = x.createLinearGradient(0, 8 + i * 14, 0, 14 + i * 14);
      gg.addColorStop(0, '#33383e'); gg.addColorStop(0.5, '#191d21'); gg.addColorStop(1, '#33383e');
      x.fillStyle = gg;
      x.fillRect(8, 8 + i * 14, w - 16, 6);
    }
    x.strokeStyle = '#4b535b'; x.lineWidth = 2;
    x.strokeRect(4, 3, w - 8, h - 6);
    x.fillStyle = '#aeb8c2';
    x.beginPath(); x.ellipse(64, 32, 15, 9, 0, 0, TAU); x.fill();
    x.fillStyle = '#0a0c0e';
    x.beginPath(); x.ellipse(64, 32, 9, 4.5, 0, 0, TAU); x.fill();
  });

  const badgeTex = cvs(256, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#c9d3dd';
    x.font = 'bold 46px Helvetica, Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('TOYOTA', w / 2, h / 2 + 2);
  });

  const MAT = {
    paint:    new THREE.MeshPhongMaterial({ color: new THREE.Color(bodyColor), shininess: 130, specular: 0x93a5b8 }),
    black:    new THREE.MeshLambertMaterial({ color: 0x0e1013 }),
    plastic:  new THREE.MeshPhongMaterial({ color: 0x1a1e23, shininess: 26,  specular: 0x2a2f36 }),
    rubber:   new THREE.MeshLambertMaterial({ color: 0x141518 }),
    tireSide: new THREE.MeshPhongMaterial({ map: treadTex, color: 0x33363b, shininess: 6, specular: 0x0a0a0a }),
    rimSide:  new THREE.MeshPhongMaterial({ color: 0x2b3036, shininess: 60, specular: 0x555555 }),
    rimFace:  new THREE.MeshPhongMaterial({ map: rimTex, shininess: 110, specular: 0xb0b8c0 }),
    glass:    new THREE.MeshPhongMaterial({ color: 0x0b1622, shininess: 300, specular: 0xffffff, side: THREE.DoubleSide }),
    chrome:   new THREE.MeshPhongMaterial({ color: 0xb8c2cc, shininess: 300, specular: 0xffffff }),
    head:     new THREE.MeshPhongMaterial({ color: 0xe9f2ff, emissive: 0x4a5c72, shininess: 320, specular: 0xffffff }),
    tail:     new THREE.MeshPhongMaterial({ color: 0xa41414, emissive: 0x380000, shininess: 220, specular: 0xff9999 }),
    amber:    new THREE.MeshPhongMaterial({ color: 0xcf8a12, emissive: 0x3a2000, shininess: 200 }),
    grille:   new THREE.MeshPhongMaterial({ map: grilleTex, shininess: 60, specular: 0x666666 }),
    badge:    new THREE.MeshPhongMaterial({ map: badgeTex, transparent: true, shininess: 120 }),
  };

  /* ── Body silhouette ────────────────────────────────── */
  {
    const archPoints = (cx, segments) => {
      const out = [];
      const dy  = (GROUND - WHEEL_R) / ARCH_R;
      const a0  = Math.PI - Math.asin(dy);
      const a1  = Math.asin(dy);
      for (let i = 0; i <= segments; i++) {
        const a = a0 + (a1 - a0) * (i / segments);
        out.push(V2(cx + ARCH_R * Math.cos(a), WHEEL_R + ARCH_R * Math.sin(a)));
      }
      return out;
    };

    const P = [];
    P.push(V2(-2.55, GROUND));
    archPoints(AXLE_R, 12).forEach(p => P.push(p));
    archPoints(AXLE_F, 12).forEach(p => P.push(p));
    P.push(V2(2.45, GROUND));
    P.push(V2(2.60, 0.70));
    P.push(V2(2.64, 0.90));
    P.push(V2(2.64, 1.16));
    P.push(V2(2.56, 1.24));
    P.push(V2(2.30, 1.26));
    P.push(V2(0.90, 1.30));
    P.push(V2(-0.50, 1.30));
    /* Bed floor now clears the rear arch apex (0.98). */
    P.push(V2(-0.50, BED_FLOOR_Y));
    P.push(V2(-2.50, BED_FLOOR_Y));
    P.push(V2(-2.50, 1.30));
    P.push(V2(-2.60, 1.30));
    P.push(V2(-2.64, 0.86));
    P.push(V2(-2.58, 0.62));

    g.add(extrudeProfile(P, HALF_W * 2, MAT.paint));
  }

  /* ── Cabin ──────────────────────────────────────────── */
  {
    const C = new THREE.Shape();
    C.moveTo( 0.92, 1.28);
    C.lineTo( 0.34, 1.84);
    C.lineTo(-0.42, 1.88);
    C.lineTo(-0.52, 1.30);
    C.closePath();

    const geo = new THREE.ExtrudeGeometry(C, {
      depth: CAB_HW * 2, bevelEnabled: false, curveSegments: 1, steps: 1
    });
    geo.translate(0, 0, -CAB_HW);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, MAT.paint));
  }

  /* ── Glass ──────────────────────────────────────────── */
  {
    const glassQuads = [];

    /* Windshield normal (unit vector). Previously (0.6945, 0.7195) used
       a comma operator which produced a single scalar → NaN offsets on
       every vertex → the whole truck vanished from the bounding box.
       It is now a proper 2-element array. */
    const N = [0.6945, 0.7195];
    const winds = (t) => V2(0.92 - 0.58 * t, 1.28 + 0.56 * t);

    {
      const a = winds(0.06), b = winds(0.94);
      const ox = 0.012 * N[0], oy = 0.012 * N[1];
      glassQuads.push([
        V3(a.x + ox, a.y + oy,  0.76),
        V3(b.x + ox, b.y + oy,  0.76),
        V3(b.x + ox, b.y + oy, -0.76),
        V3(a.x + ox, a.y + oy, -0.76)
      ]);
    }

    const sideWin = [
      [[0.72, 1.35], [-0.10, 1.35], [-0.10, 1.78], [0.30, 1.78]],
      [[-0.18, 1.35], [-0.46, 1.35], [-0.38, 1.78], [-0.18, 1.78]]
    ];
    for (const s of [1, -1]) {
      const z = CAB_HW * s + 0.006 * s;
      for (const w of sideWin) {
        glassQuads.push([
          V3(w[0][0], w[0][1], z), V3(w[1][0], w[1][1], z),
          V3(w[2][0], w[2][1], z), V3(w[3][0], w[3][1], z)
        ]);
      }
    }

    {
      const a = V3(-0.438 - 0.0115, 1.822 + 0.0036, 0.70);
      const b = V3(-0.582 - 0.0115, 1.358 + 0.0036, 0.70);
      glassQuads.push([
        a, b, V3(b.x, b.y, -0.70), V3(a.x, a.y, -0.70)
      ]);
    }

    g.add(new THREE.Mesh(quadsGeometry(glassQuads), MAT.glass));
  }

  /* ── Bed (side walls raised to match new floor) ──────── */
  {
    const bedLen = 2.00, bedX = -1.50;
    const bedWallY = BED_FLOOR_Y + BED_WALL_H * 0.5;
    const bedRailY = BED_RAIL_Y;
    for (const s of [1, -1]) {
      box(bedLen, BED_WALL_H, 0.10, MAT.paint, bedX, bedWallY, s * 0.88, g);
      box(bedLen + 0.06, 0.035, 0.13, MAT.black, bedX, bedRailY, s * 0.88, g);
    }
    box(bedLen - 0.02, 0.03, 1.66, MAT.black, bedX, BED_FLOOR_Y, 0, g);

    cyl(0.042, 0.042, 0.40, 8, MAT.black, -0.78, 1.46,  0.74, g);
    cyl(0.042, 0.042, 0.40, 8, MAT.black, -0.78, 1.46, -0.74, g);
    const bar = cyl(0.042, 0.042, 1.52, 8, MAT.black, -0.78, 1.66, 0, g);
    bar.rotation.x = Math.PI / 2;
  }

  /* ── Wheel arch flares ──────────────────────────────── */
  for (const ax of [AXLE_F, AXLE_R]) {
    for (const s of [1, -1]) {
      const t = new THREE.Mesh(
        new THREE.TorusGeometry(0.575, 0.048, 5, 14, Math.PI),
        MAT.plastic
      );
      t.position.set(ax, WHEEL_R, s * (HALF_W + 0.012));
      g.add(t);
    }
  }

  /* ── Front end ──────────────────────────────────────── */
  {
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.24), MAT.grille);
    gr.position.set(2.646, 1.045, 0);
    gr.rotation.y = Math.PI / 2;
    g.add(gr);

    for (const s of [1, -1]) {
      box(0.07, 0.145, 0.30, MAT.head, 2.632, 1.05, s * 0.71, g);
      box(0.05, 0.05, 0.10, MAT.amber, 2.638, 0.955, s * 0.86, g);
    }

    box(0.19, 0.30, 1.92, MAT.plastic, 2.60, 0.80, 0, g);
    box(0.14, 0.10, 0.90, MAT.chrome, 2.655, 0.78, 0, g);
    for (const s of [1, -1]) {
      box(0.06, 0.09, 0.16, MAT.head, 2.678, 0.70, s * 0.62, g);
    }
    const skid = box(0.40, 0.05, 1.10, MAT.chrome, 2.34, 0.60, 0, g);
    skid.rotation.z = 0.16;

    for (const s of [1, -1]) box(0.10, 0.06, 0.06, MAT.tail, 2.66, 0.62, s * 0.40, g);
  }

  /* ── Rear end ───────────────────────────────────────── */
  {
    for (const s of [1, -1]) {
      box(0.07, 0.34, 0.21, MAT.tail, -2.618, 1.06, s * 0.78, g);
      box(0.05, 0.09, 0.19, MAT.amber, -2.605, 0.90, s * 0.78, g);
    }
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.22), MAT.badge);
    bd.position.set(-2.638, 1.05, 0);
    bd.rotation.y = -Math.PI / 2;
    g.add(bd);

    box(0.17, 0.28, 1.90, MAT.plastic, -2.66, 0.78, 0, g);
    box(0.10, 0.09, 0.80, MAT.chrome, -2.72, 0.66, 0, g);

    const ex = cyl(0.045, 0.045, 0.16, 8, MAT.chrome, -2.70, 0.62, 0.62, g);
    ex.rotation.z = Math.PI / 2;
  }

  /* ── Side details ───────────────────────────────────── */
  {
    const seam = (x) => {
      for (const s of [1, -1]) {
        box(0.013, 0.68, 0.008, MAT.black, x, 0.95, s * 0.9315, g);
      }
    };
    seam(0.86); seam(-0.06); seam(-0.48);

    for (const s of [1, -1]) {
      box(0.16, 0.045, 0.05, MAT.chrome, 0.30, 1.19, s * 0.945, g);
      box(0.16, 0.045, 0.05, MAT.chrome, -0.30, 1.19, s * 0.945, g);
    }

    for (const s of [1, -1]) {
      const arm = box(0.10, 0.05, 0.14, MAT.plastic, 0.86, 1.36, s * 0.94, g);
      arm.rotation.y = -s * 0.25;
      box(0.09, 0.16, 0.10, MAT.paint, 0.86, 1.42, s * 1.03, g);
      box(0.02, 0.12, 0.08, MAT.glass, 0.83, 1.42, s * 1.03, g);
    }

    for (const s of [1, -1]) {
      box(2.00, 0.07, 0.16, MAT.plastic, -0.05, 0.56, s * 0.90, g);
    }

    const cap = cyl(0.09, 0.09, 0.02, 10, MAT.chrome, -1.02, 1.02, HALF_W + 0.002, g);
    cap.rotation.x = Math.PI / 2;

    const ant = cyl(0.012, 0.018, 0.55, 5, MAT.black, 0.86, 1.62, 0.80, g);
    ant.rotation.z = -0.24;

    for (let i = 0; i < 2; i++) {
      const w = box(0.42, 0.012, 0.018, MAT.black, 0.72 - i * 0.05, 1.315 + i * 0.02, -0.34 + i * 0.68, g);
      w.rotation.y = 0.30;
    }
  }

  /* ── Wheels ─────────────────────────────────────────── */
  const wheels = [];
  const wheelPos = [
    [ AXLE_F,  0.80, true ], [ AXLE_F, -0.80, true ],
    [ AXLE_R,  0.80, false], [ AXLE_R, -0.80, false]
  ];

  for (const [x, z, isFront] of wheelPos) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_R, z);
    g.add(pivot);

    const spin = new THREE.Group();
    pivot.add(spin);

    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.30, LOW ? 16 : 20, 1, false),
      [MAT.tireSide, MAT.rubber, MAT.rubber]
    );
    tire.rotation.x = Math.PI / 2;
    spin.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.265, 0.265, 0.315, LOW ? 12 : 18, 1, false),
      [MAT.rimSide, MAT.rimFace, MAT.rimFace]
    );
    rim.rotation.x = Math.PI / 2;
    spin.add(rim);

    wheels.push({ pivot, spin, steer: isFront, spinZ: true });
  }
  g.userData.wheels = wheels;

  return g;
}

/* ── 6. BMW M4 ─────────────────────────────────────────────────── */
export function buildBMW(body = "#1f3a93", rim = "#2b2b2b") {
  return buildBMW3D(body, rim);
}

/* ── 6b. BUGATTI CHIRON ────────────────────────────────────────── */
export function buildChiron(body = "#0e2138", rim = "#c9ced6") {
  return buildChiron3D(body, rim);
}

/* ── 7. TAXI (Simple Danfo) ─────────────────────────────────────── */
export function buildTaxi(body = "#f2c31a", rim = "#111") {
  const g = new THREE.Group();
  const paint  = paintMat(body);
  const black  = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.9, roughness: 0.2 });
  const glass  = glassMat();

  /* Long van-style danfo shape (nose toward +X) */
  const lower = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.0, 2.0), paint);
  lower.position.set(0, 0.85, 0); lower.castShadow = true; g.add(lower);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.82, 0.18, 2.02), black);
  stripe.position.set(0, 0.85, 0); g.add(stripe);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.95, 1.92), paint);
  cab.position.set(-0.4, 1.75, 0); cab.castShadow = true; g.add(cab);
  const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.85, 1.94), glass);
  cabGlass.position.set(-0.4, 1.75, 0); g.add(cabGlass);

  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.9, 0.08), paint);
    p.position.set(-0.4, 1.75, s * 0.95); g.add(p);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.94), paint);
  roof.position.set(-0.4, 2.26, 0); g.add(roof);
  const rack = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 1.5), black);
  rack.position.set(-0.4, 2.32, 0); g.add(rack);

  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(4.86, 0.28, 2.04), black);
  bumpF.position.set(0, 0.42, 0); g.add(bumpF);

  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.34), headMat);
    hl.position.set(2.44, 0.95, s * 0.62); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.24), tailMat);
    tl.position.set(-2.44, 0.95, s * 0.70); g.add(tl);
  }

  for (let k = 0; k < 3; k++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.2), chrome);
    slat.position.set(2.42, 0.78 + k * 0.10, 0); g.add(slat);
  }

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheels = [];
  for (const wx of [1.55, -1.55]) {
    for (const wz of [1.0, -1.0]) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, 0.46, wz); g.add(pivot);
      const spin = new THREE.Group(); pivot.add(spin);
      const tireGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.30, 20);
      tireGeo.rotateX(Math.PI / 2);
      spin.add(new THREE.Mesh(tireGeo, tireMat));
      const rimGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.32, 16);
      rimGeo.rotateX(Math.PI / 2);
      spin.add(new THREE.Mesh(rimGeo, rimMat(rim)));
      wheels.push({ pivot, spin, steer: Math.abs(wx - 1.55) < 0.01, spinZ: true });
    }
  }
  g.userData.wheels = wheels;
  return g;
}

import { buildNK250 } from "./nk250.js";
import { buildHoverboard } from "./hoverboard.js";

export const VEHICLE_BUILDERS = {
  nk250:      buildNK250,
  hoverboard: buildHoverboard,
  gwagon:     buildGWagon,
  mercedes:   buildMercedes,
  cybertruck: buildCybertruck,
  rangerover: buildRangeRover,
  hilux:      buildHilux,
  bmw:        buildBMW,
  chiron:     buildChiron,
  taxi:       buildTaxi,
};

export function buildVehicle(id, body, rim, opts) {
  const fn = VEHICLE_BUILDERS[id] || buildGWagon;
  return fn(body, rim, opts);
}

/* ── Seat Counts ────────────────────────────────────────────────── */
export const SEAT_COUNTS = {
  gwagon: 5, mercedes: 4, cybertruck: 5, hilux: 5,
  rangerover: 5, bmw: 4, chiron: 2, taxi: 5, nk250: 2, hoverboard: 1,
};

export function seatCount(id) {
  return SEAT_COUNTS[id] || 4;
}
