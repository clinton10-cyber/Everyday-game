/* governor.js -- Rivers State Governor's Mansion, EXTERIOR.
   Walkable in third person. Player spawns on the driveway facing
   the mansion, can walk the compound / up the grand staircase onto
   the portico, and stands in front of the doors to press E and
   enter the interior. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../core/thirdperson.js";
import { Quality } from "../core/quality.js";

export async function governorScene(params, router) {
  const LOW = Quality.isLow;

  /* ── SCENE ────────────────────────────────────────────── */
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe3f2, 170, 420);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.5, 700);
  camera.rotation.order = "YXZ";

  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6b5c46, 1.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 2.35);
  sun.position.set(72, 108, 62);
  sun.target.position.set(0, 6, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 512 : 1024, LOW ? 512 : 1024);
  sun.shadow.camera.left   = -72;
  sun.shadow.camera.right  =  72;
  sun.shadow.camera.top    =  72;
  sun.shadow.camera.bottom = -72;
  sun.shadow.camera.near   = 1;
  sun.shadow.camera.far    = 320;
  sun.shadow.bias          = -0.0006;
  sun.shadow.normalBias    = 0.06;
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(0xbcd6ea, 0.45);
  fill.position.set(-60, 40, -50);
  scene.add(fill);

  /* ── TEXTURES ─────────────────────────────────────────── */
  const textures = [];
  const track = (t) => { textures.push(t); return t; };

  function noiseTex(size, base, amp, rep) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amp;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    if (rep) t.repeat.set(rep, rep);
    return track(t);
  }

  function pavingTex() {
    const s = 256, c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d");
    x.fillStyle = "#c9c2b3"; x.fillRect(0, 0, s, s);
    const img = x.getImageData(0, 0, s, s), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    x.strokeStyle = "#a49a86"; x.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      x.beginPath(); x.moveTo(i * s / 4, 0); x.lineTo(i * s / 4, s); x.stroke();
      x.beginPath(); x.moveTo(0, i * s / 4); x.lineTo(s, i * s / 4); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return track(t);
  }

  const wallTex  = noiseTex(256, "#efe4cd", 15, 4);
  const trimTex  = noiseTex(128, "#fbf7ee", 8,  2);
  const stoneTex = noiseTex(256, "#cfc3ab", 20, 6);
  const paveTex  = pavingTex();

  /* ── MATERIALS ────────────────────────────────────────── */
  const MATS = {
    wall : new THREE.MeshLambertMaterial({ color: 0xffffff, map: wallTex }),
    trim : new THREE.MeshLambertMaterial({ color: 0xffffff, map: trimTex }),
    stone: new THREE.MeshLambertMaterial({ color: 0xffffff, map: stoneTex }),
    pave : new THREE.MeshLambertMaterial({ color: 0xffffff, map: paveTex }),
    roof : new THREE.MeshLambertMaterial({ color: 0x8e3f2c }),
    glass: new THREE.MeshPhongMaterial({ color: 0x1e3d55, specular: 0x9fd4f5, shininess: 110 }),
    wood : new THREE.MeshLambertMaterial({ color: 0x4a2f1c }),
    gold : new THREE.MeshPhongMaterial({ color: 0xc9a227, specular: 0xfff0b0, shininess: 130 }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x8a6a45 }),
    leaf : new THREE.MeshLambertMaterial({ color: 0x2c7a33 }),
    leaf2: new THREE.MeshLambertMaterial({ color: 0x3f9440 }),
    hedge: new THREE.MeshLambertMaterial({ color: 0x376b2b }),
    grass: new THREE.MeshLambertMaterial({ color: 0x4f7a34 }),
    water: new THREE.MeshPhongMaterial({ color: 0x2b7fa8, specular: 0xd8f4ff, shininess: 220, transparent: true, opacity: 0.88 })
  };

  /* ── BUILDER + COLLIDERS ──────────────────────────────── */
  const bags = new Map();
  const bag  = (k) => { let b = bags.get(k); if (!b) { b = []; bags.set(k, b); } return b; };
  const colliders = [];

  const _e = new THREE.Euler(), _q = new THREE.Quaternion(),
        _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  function m4(x, y, z, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, "YXZ");
    _q.setFromEuler(_e);
    _p.set(x, y, z); _s.set(1, 1, 1);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }

  const SOLID_KEYS = new Set([
    "wall", "trim", "stone", "roof", "wood", "gold",
    "trunk", "leaf", "leaf2", "hedge"
  ]);

  function addGeo(key, geo, m) {
    geo.applyMatrix4(m);
    bag(key).push(geo);
  }

  function bx(key, w, h, d, x, y, z, ry = 0) {
    addGeo(key, new THREE.BoxGeometry(w, h, d), m4(x, y, z, ry));
    if (SOLID_KEYS.has(key)) {
      const cs = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry));
      const ex = (w * cs + d * sn) / 2;
      const ez = (w * sn + d * cs) / 2;
      colliders.push({
        minX: x - ex, maxX: x + ex,
        minZ: z - ez, maxZ: z + ez,
        y0: y - h / 2, y1: y + h / 2,
        level: 0,
      });
    }
  }

  function cy(key, rt, rb, h, seg, x, y, z, ry = 0) {
    addGeo(key, new THREE.CylinderGeometry(rt, rb, h, seg, 1), m4(x, y, z, ry));
    if (SOLID_KEYS.has(key)) {
      const r = Math.max(rt, rb);
      colliders.push({
        minX: x - r, maxX: x + r,
        minZ: z - r, maxZ: z + r,
        y0: y - h / 2, y1: y + h / 2,
        level: 0,
      });
    }
  }

  function prism(key, w, h, d, x, y, z, ry = 0) {
    const hw = w / 2, hd = d / 2;
    const A = [-hw, 0, hd], B = [hw, 0, hd], C = [0, h, hd];
    const D = [-hw, 0, -hd], E = [hw, 0, -hd], F = [0, h, -hd];
    const V = [];
    const tri = (a, b, c) => V.push(...a, ...b, ...c);
    tri(A, B, C); tri(D, F, E);
    tri(A, D, E); tri(A, E, B);
    tri(A, C, F); tri(A, F, D);
    tri(B, E, F); tri(B, F, C);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(V, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(V.length / 3 * 2), 2));
    g.computeVertexNormals();
    g.setIndex(Array.from({ length: V.length / 3 }, (_, i) => i));
    addGeo(key, g, m4(x, y, z, ry));
    if (SOLID_KEYS.has(key)) {
      colliders.push({
        minX: x - hw, maxX: x + hw,
        minZ: z - hd, maxZ: z + hd,
        y0: y, y1: y + h,
        level: 0,
      });
    }
  }

  function hipRoof(key, W, D, H, x, yBase, z, taper = 0.28) {
    const g = new THREE.CylinderGeometry(0.5 * taper, 0.5, 1, 4, 1, false);
    g.rotateY(Math.PI / 4);
    g.scale(W / 0.70710678, H, D / 0.70710678);
    g.translate(0, 0.5 * H, 0);
    addGeo(key, g, m4(x, yBase, z));
  }

  /* ── ARCHITECTURE ─────────────────────────────────────── */
  function windowUnit(x, y, z, ry, w = 1.5, h = 2.4, ped = false) {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const P = (key, bw, bh, bd, lx, ly, lz) => {
      const wx = x + lx * cs + lz * sn;
      const wz = z - lx * sn + lz * cs;
      bx(key, bw, bh, bd, wx, y + ly, wz, ry);
    };
    P("glass", w, h, 0.10, 0, 0, 0.07);
    P("trim", w + 0.42, 0.20, 0.26, 0, h / 2 + 0.10, 0.14);
    P("trim", w + 0.52, 0.22, 0.36, 0, -h / 2 - 0.11, 0.16);
    P("trim", 0.20, h, 0.26, -w / 2 - 0.11, 0, 0.14);
    P("trim", 0.20, h, 0.26,  w / 2 + 0.11, 0, 0.14);
    P("trim", 0.09, h, 0.20, 0, 0, 0.16);
    P("trim", w, 0.09, 0.20, 0, 0, 0.16);
    if (ped) P("trim", w + 0.72, 0.20, 0.40, 0, h / 2 + 0.36, 0.16);
  }

  function balustrade(cx, cz, len, axis, y, h = 0.78) {
    const n = Math.max(2, Math.round(len / 0.58));
    const step = len / n;
    for (let i = 0; i <= n; i++) {
      const t  = -len / 2 + i * step;
      const px = axis === "x" ? cx + t : cx;
      const pz = axis === "x" ? cz : cz + t;
      cy("trim", 0.062, 0.085, h, 6, px, y + h / 2, pz);
    }
    const w = axis === "x" ? len + 0.3 : 0.3;
    const d = axis === "x" ? 0.3 : len + 0.3;
    bx("trim", w, 0.14, d, cx, y + h + 0.07, cz);
    bx("trim", w, 0.12, d, cx, y + 0.06, cz);
  }

  function column(x, z, yBase, height, r = 0.36) {
    bx("trim", 1.05, 0.26, 1.05, x, yBase + 0.13, z);
    bx("trim", 0.92, 0.20, 0.92, x, yBase + 0.36, z);
    const sh = height - 0.36 - 0.46;
    cy("trim", r, r * 1.10, sh, LOW ? 8 : 12, x, yBase + 0.46 + sh / 2, z);
    bx("trim", 0.96, 0.30, 0.96, x, yBase + height - 0.16, z);
    bx("trim", 1.12, 0.16, 1.12, x, yBase + height - 0.01, z);
  }

  function palm(x, z, s = 1) {
    let px = x, pz = z, py = 0;
    const segs = 5, H = 7.4 * s;
    for (let i = 0; i < segs; i++) {
      const hh = H / segs;
      const r1 = 0.33 * s * (1 - i * 0.055);
      const r2 = 0.33 * s * (1 - (i + 1) * 0.055);
      cy("trunk", Math.max(r2, 0.09), r1, hh * 1.04, 6, px, py + hh / 2, pz);
      py += hh;
      px += 0.14 * s * Math.cos(i * 1.7 + x);
      pz += 0.14 * s * Math.sin(i * 1.7 + z);
    }
    const n = LOW ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + x * 0.3;
      const tilt = -0.34 - Math.random() * 0.36;
      const g = new THREE.BoxGeometry(3.5 * s, 0.09 * s, 0.78 * s);
      g.translate(1.75 * s, 0, 0);
      addGeo(Math.random() > 0.5 ? "leaf" : "leaf2", g, m4(px, py, pz, a, 0, tilt));
    }
    for (let i = 0; i < 3; i++) {
      addGeo("trunk", new THREE.SphereGeometry(0.19 * s, 6, 4),
        m4(px + 0.3 * Math.cos(i * 2.1), py - 0.26 * s, pz + 0.3 * Math.sin(i * 2.1)));
    }
  }

  /* ── MANSION ──────────────────────────────────────────── */
  const PL = 1.2;
  const CH = 8.4, CW = 20, CD = 18;
  const WH = 7.2, WW = 13, WD = 15;
  const WX = 16.5, WZ = -1.0;

  function buildMansion() {
    bx("stone", 52, 0.6, 27, 0, 0.30, 2);
    bx("stone", 50, 0.6, 25, 0, 0.90, 2);

    for (let k = 0; k < 4; k++) {
      const h = 1.2 - 0.3 * k;
      bx("stone", 16, h, 0.85, 0, h / 2, 14.5 + k * 0.85 + 0.425);
    }

    bx("wall", CW, CH, CD, 0, PL + CH / 2, 0);
    bx("stone", CW + 0.7, 0.9, CD + 0.7, 0, PL + 0.45, 0);
    bx("trim", CW + 0.5, 0.30, CD + 0.5, 0, PL + 4.2, 0);
    bx("trim", CW + 1.2, 0.55, CD + 1.2, 0, PL + CH + 0.275, 0);
    bx("trim", CW + 1.5, 0.18, CD + 1.5, 0, PL + CH + 0.64, 0);

    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      bx("trim", 1.2, CH, 1.2, sx * 9.9, PL + CH / 2, sz * 8.9);
    }

    hipRoof("roof", 21.6, 19.6, 3.7, 0, PL + CH + 0.73, 0, 0.30);

    bx("stone", 1.1, 2.0, 1.1, -7.5, PL + CH + 3.2, -4.0);
    bx("stone", 1.1, 2.0, 1.1,  7.5, PL + CH + 3.2, -4.0);

    for (const sx of [-1, 1]) {
      const cx = sx * WX;
      bx("wall", WW, WH, WD, cx, PL + WH / 2, WZ);
      bx("stone", WW + 0.7, 0.9, WD + 0.7, cx, PL + 0.45, WZ);
      bx("trim", WW + 0.5, 0.30, WD + 0.5, cx, PL + 4.2, WZ);
      bx("trim", WW + 1.1, 0.50, WD + 1.1, cx, PL + WH + 0.25, WZ);
      bx("trim", WW + 1.4, 0.16, WD + 1.4, cx, PL + WH + 0.58, WZ);

      const ry = PL + WH + 0.66;
      balustrade(cx, WZ + WD / 2 - 0.15, WW - 0.6, "x", ry);
      balustrade(cx, WZ - WD / 2 + 0.15, WW - 0.6, "x", ry);
      balustrade(cx + sx * (WW / 2 - 0.15), WZ, WD - 0.6, "z", ry);

      for (const sz of [-1, 1]) {
        bx("trim", 1.0, WH, 1.0, cx + sx * (WW / 2 - 0.1), PL + WH / 2, WZ + sz * (WD / 2 - 0.1));
      }
    }

    const F1 = 3.4, F2 = 7.35;
    for (const x of [-7.0, -3.2, 3.2, 7.0]) {
      windowUnit(x, F1, 9.0, 0, 1.5, 2.4, true);
      windowUnit(x, F2, 9.0, 0, 1.5, 2.4, false);
      windowUnit(x, F1, -9.0, Math.PI, 1.5, 2.4, true);
      windowUnit(x, F2, -9.0, Math.PI, 1.5, 2.4, false);
    }
    for (const sx of [-1, 1]) {
      const cx = sx * WX;
      for (const dx of [-3.1, 0, 3.1]) {
        windowUnit(cx + dx, F1, WZ + WD / 2, 0, 1.4, 2.3, true);
        windowUnit(cx + dx, F2, WZ + WD / 2, 0, 1.4, 2.3, false);
        windowUnit(cx + dx, F1, WZ - WD / 2, Math.PI, 1.4, 2.3, true);
        windowUnit(cx + dx, F2, WZ - WD / 2, Math.PI, 1.4, 2.3, false);
      }
      const sideX = sx * (WX + WW / 2), ryS = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const dz of [-5, 0, 5]) {
        windowUnit(sideX, F1, WZ + dz, ryS, 1.4, 2.3, true);
        windowUnit(sideX, F2, WZ + dz, ryS, 1.4, 2.3, false);
      }
    }

    bx("wood", 3.2, 4.0, 0.26, 0, PL + 2.0, 9.15);
    bx("gold", 0.09, 3.9, 0.32, 0, PL + 2.0, 9.20);
    bx("gold", 0.9, 0.09, 0.32, -0.85, PL + 3.2, 9.20);
    bx("gold", 0.9, 0.09, 0.32,  0.85, PL + 3.2, 9.20);
    bx("trim", 0.55, 4.6, 0.62, -1.90, PL + 2.3, 9.18);
    bx("trim", 0.55, 4.6, 0.62,  1.90, PL + 2.3, 9.18);
    bx("trim", 4.9, 0.62, 0.62, 0, PL + 4.85, 9.18);
    prism("trim", 5.2, 1.05, 0.62, 0, PL + 5.16, 9.18);

    const colX = [-6.5, -3.9, -1.3, 1.3, 3.9, 6.5];
    for (const x of colX) column(x, 12.8, PL, 6.6);

    bx("trim", 15.4, 0.88, 4.95, 0, 7.98, 11.5);
    bx("gold", 15.5, 0.10, 5.05, 0, 7.62, 11.5);
    prism("trim", 15.4, 1.95, 4.95, 0, 8.42, 11.5);
    bx("gold", 2.2, 0.85, 0.30, 0, 9.10, 13.90);

    bx("pave", 15.4, 0.16, 4.95, 0, PL + 0.08, 11.5);

    bx("wall", 8, 2.2, 5, 0, PL + CH + 1.83, -5.5);
    hipRoof("roof", 9, 6, 1.6, 0, PL + CH + 2.93, -5.5, 0.2);

    bx("hedge", 5.5, 1.0, 1.3, -13, 0.50, 19.5);
    bx("hedge", 5.5, 1.0, 1.3,  13, 0.50, 19.5);
    bx("hedge", 9.0, 0.9, 1.2, -22, 0.45, 21.0);
    bx("hedge", 9.0, 0.9, 1.2,  22, 0.45, 21.0);

    const palms = [
      [-30, 20], [30, 20], [-30, -18], [30, -18],
      [-16, 27], [16, 27], [-45, 4], [45, 4],
      [-45, 32], [45, 32], [-20, 48], [20, 48]
    ];
    for (const [px, pz] of palms) palm(px, pz, 0.92 + Math.random() * 0.22);

    bx("pave", 17, 0.14, 11, -36, 0.07, 8);
    bx("stone", 12.4, 0.95, 6.4, -36, 0.475, 8);
    bx("water", 11.2, 0.10, 5.2, -36, 0.94, 8);

    cy("stone", 4.2, 4.6, 0.85, 16, 0, 0.425, 36);
    cy("water", 3.9, 3.9, 0.12, 16, 0, 0.80, 36);
    cy("stone", 0.55, 0.85, 1.9, 10, 0, 0.95, 36);
    cy("stone", 1.55, 0.55, 0.5, 12, 0, 2.05, 36);
    cy("water", 1.30, 1.30, 0.09, 12, 0, 2.28, 36);

    bx("stone", 42, 2.4, 0.8, -29, 1.2, 58);
    bx("stone", 42, 2.4, 0.8,  29, 1.2, 58);
    bx("stone", 1.9, 3.5, 1.9, -8, 1.75, 58);
    bx("stone", 1.9, 3.5, 1.9,  8, 1.75, 58);
    bx("gold", 1.3, 0.35, 1.3, -8, 3.68, 58);
    bx("gold", 1.3, 0.35, 1.3,  8, 3.68, 58);
    for (let i = 0; i < 15; i++) {
      cy("gold", 0.07, 0.07, 2.6, 6, -6.8 + i * 0.97, 1.3, 58);
    }
    bx("gold", 15.6, 0.15, 0.15, 0, 2.62, 58);
    bx("gold", 15.6, 0.15, 0.15, 0, 0.30, 58);
  }

  /* ── ENVIRONMENT ──────────────────────────────────────── */
  function buildEnvironment() {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), MATS.grass);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    scene.add(grass);

    const apron = new THREE.Mesh(new THREE.PlaneGeometry(44, 10), MATS.pave);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, 0.02, 20.5);
    apron.receiveShadow = true;
    scene.add(apron);

    paveTex.repeat.set(6, 2);

    const drive = new THREE.Mesh(new THREE.PlaneGeometry(18, 22), MATS.pave);
    drive.rotation.x = -Math.PI / 2;
    drive.position.set(0, 0.025, 27.5);
    drive.receiveShadow = true;
    scene.add(drive);

    const circle = new THREE.Mesh(new THREE.CircleGeometry(14, 40), MATS.pave);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(0, 0.03, 36);
    circle.receiveShadow = true;
    scene.add(circle);

    const gateRoad = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), MATS.pave);
    gateRoad.rotation.x = -Math.PI / 2;
    gateRoad.position.set(0, 0.025, 52);
    gateRoad.receiveShadow = true;
    scene.add(gateRoad);
  }

  function buildSky() {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.00, "#2c6cb0");
    g.addColorStop(0.42, "#7db4dd");
    g.addColorStop(0.72, "#cde2f1");
    g.addColorStop(1.00, "#eaf2f7");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
    const tex = track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(430, 16, 12),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    scene.add(sky);
  }

  /* ── BUILD ────────────────────────────────────────────── */
  buildSky();
  buildEnvironment();
  buildMansion();

  const mergedMeshes = [];
  for (const [key, geos] of bags) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, MATS[key]);
    mesh.castShadow    = !["grass", "water"].includes(key);
    mesh.receiveShadow = !["glass", "water"].includes(key);
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    mergedMeshes.push(mesh);
  }
  bags.clear();

  /* ── STAIRCASE + PLATFORMS ────────────────────────────── */
  const STAIR_X0 = -8.0, STAIR_X1 = 8.0;
  const STAIR_Z0 = 12.8, STAIR_Z1 = 18.05;
  const STAIR_H  = 1.2;

  const stairs = [{
    minX: STAIR_X0, maxX: STAIR_X1,
    minZ: STAIR_Z0, maxZ: STAIR_Z1,
    axis: "z", y0: 0, y1: STAIR_H,
    level: 0, toLevel: 0,
  }];

  const plinthTop = {
    level: 0, minX: -24, maxX: 24, minZ: -10, maxZ: 14.8,
    h: STAIR_H,
  };

  const portico = {
    level: 0, minX: -7.7, maxX: 7.7, minZ: 9.0, maxZ: 14.0,
    h: STAIR_H + 0.08,
  };

  /* ── INTERACTABLES ────────────────────────────────────── */
  /* A single "ENTER" use-point right in front of the doors.
     Player walks up the grand staircase, stands in front of the
     doors, sees "ENTER · Governor's Mansion", presses E → interior. */
  const uses = [{
    kind: "enter-mansion",
    label: "ENTER · GOVERNOR'S MANSION",
    x: 0, z: 10.2, y: STAIR_H + 0.08, level: 0,
    r: 2.8,
  }];

  const world = {
    colliders, seats: [],
    uses,
    platforms: [plinthTop, portico],
    stairs,
    levelHeight: () => 0,
    ceilingHeight: 60,
    bounds: { minX: -48, maxX: 48, minZ: -20, maxZ: 56 },
  };

  /* Player starts on the driveway facing the mansion. */
  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene,
    x: 0, z: 34, yaw: Math.PI, level: 0,
    speedMult: 1.15,
    camDist: 7.0,
    onUse: (use) => {
      if (use.kind === "enter-mansion") {
        router.go("governorInterior");
      } else if (window.__ph3d_phone) {
        window.__ph3d_phone._toast(use.label || "USE");
      }
    },
  });

  window.__ph3d_walkCtrl = ctl;

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "STATE HOUSE",
    title: "GOVERNOR'S MANSION",
    subtitle: "EXTERIOR",
    hint: "LEFT: MOVE  ·  RIGHT: LOOK  ·  E: ENTER",
    isInterior: false,
    sceneId: "governor",

    update: (dt) => {
      ctl.update(dt);
      sun.position.set(ctl.pos.x + 72, 108, ctl.pos.z + 62);
      sun.target.position.set(ctl.pos.x, 6, ctl.pos.z);
    },

    dispose: () => {
      if (window.__ph3d_walkCtrl === ctl) window.__ph3d_walkCtrl = null;
      ctl.dispose();
      mergedMeshes.forEach((m) => { if (m.geometry) m.geometry.dispose(); });
      Object.values(MATS).forEach((m) => { if (m && m.dispose) m.dispose(); });
      textures.forEach((t) => { try { t.dispose(); } catch (e) {} });
    },
  };
}
