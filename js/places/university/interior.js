/* university/interior.js -- UNIPORT campus as ONE walkable interior.
   World code is the standalone campus prototype; its controls, HUD, start
   screen and loop were removed and replaced by the game's ThirdPersonControls. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  const scene = new THREE.Scene();
  const FOG_COLOR = 0xa8c6dd;
  scene.fog = new THREE.Fog(FOG_COLOR, 240, 720);
  scene.background = new THREE.Color(FOG_COLOR);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 3000);
  camera.rotation.order = "YXZ";

  /* ---------- SKY ---------- */
  {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x2d6fa8) },
        bottomColor: { value: new THREE.Color(0xd6e6f2) },
        offset: { value: 150.0 }, exponent: { value: 0.65 }
      },
      vertexShader: `varying vec3 vWorld;
        void main(){ vWorld=(modelMatrix*vec4(position,1.0)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor;
        uniform float offset; uniform float exponent; varying vec3 vWorld;
        void main(){ float h=normalize(vWorld+vec3(0.0,offset,0.0)).y;
        float t=pow(max(h,0.0),exponent);
        gl_FragColor=vec4(mix(bottomColor,topColor,t),1.0);}`
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 20), skyMat);
    sky.frustumCulled = false;
    scene.add(sky);
  }

  /* ---------- LIGHTS ---------- */
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x3d5230, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1d4, 2.2);
  sun.position.set(95, 165, 60);
  scene.add(sun);

  /* ---------- TEXTURES ---------- */
  function canvasTexture(w, h, draw, repX = 1, repY = 1) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX, repY);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const TEX = {};
  TEX.grass = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#4a7238"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) {
      const g = 90 + Math.random() * 70;
      ctx.fillStyle = `rgba(${25 + Math.random() * 45},${g},${20 + Math.random() * 35},${0.25 + Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 2 + Math.random() * 2);
    }
  }, 160, 160);
  TEX.asphalt = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#3a3d42"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      const v = 40 + Math.random() * 55;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + Math.random() * 0.45})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  TEX.tile = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#d9d4c8"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#b7b1a3"; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      const p = (i / 4) * w;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }
  });
  TEX.concrete = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#c9c4ba"; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      const v = 170 + Math.random() * 50;
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 10},${Math.random() * 0.35})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });

  function makeLabelTexture(title, subtitle) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#14232f"; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 9; ctx.strokeRect(16, 16, 992, 224);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 62px Georgia, "Times New Roman", serif';
    ctx.fillText(title, 512, subtitle ? 104 : 128);
    if (subtitle) {
      ctx.fillStyle = "#d9b74a";
      ctx.font = "italic 32px Georgia, serif";
      ctx.fillText(subtitle, 512, 178);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /* ---------- MATERIALS ---------- */
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const MAT = {
    grass: S({ map: TEX.grass, roughness: 1 }),
    asphalt: S({ map: TEX.asphalt, roughness: 0.95 }),
    tile: S({ map: TEX.tile, roughness: 0.55 }),
    concrete: S({ map: TEX.concrete, color: 0xd8d3c8, roughness: 0.92 }),
    slab: S({ color: 0xbfb9ad, roughness: 0.95 }),
    trim: S({ color: 0xe4dfd2, roughness: 0.85 }),
    white: S({ color: 0xf2f2f0, roughness: 0.7 }),
    lineWhite: S({ color: 0xf0f0ea, roughness: 0.8 }),
    lineYellow: S({ color: 0xe0b93a, roughness: 0.8 }),
    glass: S({ color: 0x9cc9e8, roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.34, side: THREE.DoubleSide }),
    wood: S({ color: 0x8a6242, roughness: 0.82 }),
    woodDark: S({ color: 0x53402e, roughness: 0.85 }),
    metal: S({ color: 0x8b9099, roughness: 0.42, metalness: 0.75 }),
    darkMetal: S({ color: 0x3b4048, roughness: 0.55, metalness: 0.6 }),
    fabric: S({ color: 0x2e4d6d, roughness: 1 }),
    fabricRed: S({ color: 0x7a3038, roughness: 1 }),
    board: S({ color: 0xf4f6f4, roughness: 0.45 }),
    trunk: S({ color: 0x5b4530, roughness: 1 }),
    leafA: S({ color: 0x3f7a35, roughness: 1 }),
    leafB: S({ color: 0x4f8f3c, roughness: 1 }),
    leafC: S({ color: 0x2f6428, roughness: 1 }),
    gold: S({ color: 0xc9a227, roughness: 0.35, metalness: 0.9 })
  };

  /* ---------- BATCHING ---------- */
  class Batch {
    constructor() { this.groups = new Map(); }
    add(geometry, material, matrix) {
      const g = geometry.clone();
      if (matrix) g.applyMatrix4(matrix);
      if (!this.groups.has(material)) this.groups.set(material, []);
      this.groups.get(material).push(g);
    }
    flush(maxVerts = 40000) {
      for (const [mat, geos] of this.groups) {
        let chunk = [], verts = 0;
        const push = () => {
          if (!chunk.length) return;
          const merged = mergeGeometries(chunk, false);
          if (merged) {
            const mesh = new THREE.Mesh(merged, mat);
            mesh.matrixAutoUpdate = false;
            scene.add(mesh);
          }
          chunk.forEach(g => g.dispose());
          chunk = []; verts = 0;
        };
        for (const g of geos) {
          chunk.push(g);
          verts += g.attributes.position.count;
          if (verts > maxVerts) push();
        }
        push();
      }
      this.groups.clear();
    }
  }
  const B = { solid: new Batch(), detail: new Batch(), flat: new Batch() };

  const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
  const UNIT_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const UNIT_CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  const UNIT_SPH = new THREE.SphereGeometry(0.5, 10, 7);
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(),
        _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

  function box(batch, mat, x, y, z, w, h, d, ry = 0) {
    _e.set(0, ry, 0); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(w, h, d);
    _m4.compose(_v, _q, _s); batch.add(UNIT_BOX, mat, _m4);
  }
  function cyl(batch, mat, x, y, z, radius, height, ry = 0, geo = UNIT_CYL) {
    _e.set(0, ry, 0); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(radius * 2, height, radius * 2);
    _m4.compose(_v, _q, _s); batch.add(geo, mat, _m4);
  }
  function sphere(batch, mat, x, y, z, rx, ry2, rz) {
    _e.set(0, 0, 0); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(rx * 2, ry2 * 2, rz * 2);
    _m4.compose(_v, _q, _s); batch.add(UNIT_SPH, mat, _m4);
  }

  /* ---------- COLLISION WORLD (game format) ---------- */
  const LEVEL_H = 4.6;
  const colliders = [];
  const stairs = [];
  function addCollider(minX, maxX, minZ, maxZ, minY, maxY) {
    colliders.push({ minX, maxX, minZ, maxZ, y0: minY, y1: maxY, level: minY >= 4 ? 1 : 0 });
  }
  function addCollider2(minX, maxX, minZ, maxZ, minY, maxY, level) {
    colliders.push({ minX, maxX, minZ, maxZ, y0: minY, y1: maxY, level });
  }

  /* ---------- GROUND ---------- */
  {
    const g = new THREE.PlaneGeometry(1400, 1400, 1, 1);
    g.rotateX(-Math.PI / 2);
    B.detail.add(g, MAT.grass, new THREE.Matrix4());
  }

  /* ---------- ROADS ---------- */
  const ROAD_W = 10;
  const RING_RADII = [110, 190];
  const RADIAL_ANGLES = [];
  for (let i = 0; i < 8; i++) RADIAL_ANGLES.push(i * Math.PI / 4);

  function addRoadSegment(x0, z0, x1, z1, width) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) return;
    const angle = Math.atan2(-dz, dx);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const y = 0.02;

    const rg = new THREE.PlaneGeometry(len, width);
    rg.rotateX(-Math.PI / 2); rg.rotateY(angle); rg.translate(cx, y, cz);
    B.detail.add(rg, MAT.asphalt, null);

    const dashLen = 3.0, gap = 5.5, step = dashLen + gap;
    const count = Math.floor(len / step);
    const startOffset = (len - (count - 1) * step) / 2 - len / 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    for (let i = 0; i < count; i++) {
      const t = startOffset + i * step + dashLen / 2;
      box(B.flat, MAT.lineYellow, cx + c * t, y + 0.012, cz - s * t, dashLen, 0.02, 0.22, angle);
    }
    const off = width / 2 - 0.55;
    for (const sign of [-1, 1]) {
      box(B.flat, MAT.lineWhite, cx - s * off * sign, y + 0.012, cz - c * off * sign, len - 1.0, 0.02, 0.16, angle);
    }
    const swOff = width / 2 + 1.15;
    for (const sign of [-1, 1]) {
      box(B.detail, MAT.concrete, cx - s * swOff * sign, y + 0.09, cz - c * swOff * sign, len, 0.18, 2.3, angle);
      const co = width / 2 + 0.02;
      box(B.detail, MAT.slab, cx - s * co * sign, y + 0.1, cz - c * co * sign, len, 0.2, 0.18, angle);
    }
  }

  function addRingRoad(radius, width, y) {
    const inner = radius - width / 2, outer = radius + width / 2;
    const rg = new THREE.RingGeometry(inner, outer, 128, 1);
    rg.rotateX(-Math.PI / 2);
    B.detail.add(rg, MAT.asphalt, new THREE.Matrix4().makeTranslation(0, y, 0));
    const n = Math.floor((2 * Math.PI * radius) / 8.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      box(B.flat, MAT.lineYellow, Math.cos(a) * radius, y + 0.012, Math.sin(a) * radius, 3.0, 0.02, 0.22, -a + Math.PI / 2);
    }
    for (const r of [inner + 0.55, outer - 0.55]) {
      const eg = new THREE.RingGeometry(r - 0.09, r + 0.09, 128, 1);
      eg.rotateX(-Math.PI / 2);
      B.flat.add(eg, MAT.lineWhite, new THREE.Matrix4().makeTranslation(0, y + 0.012, 0));
    }
  }

  {
    const R_IN = 17, R_OUT = 32;
    const rg = new THREE.RingGeometry(R_IN, R_OUT, 96, 1);
    rg.rotateX(-Math.PI / 2);
    B.detail.add(rg, MAT.asphalt, new THREE.Matrix4().makeTranslation(0, 0.03, 0));
    for (const r of [R_IN + 0.6, R_OUT - 0.6]) {
      const eg = new THREE.RingGeometry(r - 0.1, r + 0.1, 96, 1);
      eg.rotateX(-Math.PI / 2);
      B.flat.add(eg, MAT.lineWhite, new THREE.Matrix4().makeTranslation(0, 0.042, 0));
    }
    const isl = new THREE.CircleGeometry(R_IN, 64);
    isl.rotateX(-Math.PI / 2);
    B.detail.add(isl, MAT.grass, new THREE.Matrix4().makeTranslation(0, 0.1, 0));
    const kerb = new THREE.RingGeometry(R_IN - 0.6, R_IN, 64, 1);
    kerb.rotateX(-Math.PI / 2);
    B.detail.add(kerb, MAT.slab, new THREE.Matrix4().makeTranslation(0, 0.22, 0));
  }

  for (const a of RADIAL_ANGLES) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const [r0, r1] of [[34, 104], [116, 184], [196, 236]]) {
      addRoadSegment(ca * r0, sa * r0, ca * r1, sa * r1, ROAD_W);
    }
  }
  addRingRoad(RING_RADII[0], 9, 0.025);
  addRingRoad(RING_RADII[1], 9, 0.025);

  for (const a of RADIAL_ANGLES) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const r = 42;
    for (let i = -4; i <= 4; i++) {
      const off = i * 1.05;
      box(B.flat, MAT.lineWhite, ca * r - sa * off, 0.05, sa * r + ca * off, 2.4, 0.02, 0.55, -a + Math.PI / 2);
    }
  }

  /* ---------- MAIN GATE ---------- */
  function buildMainGate(gx, gz) {
    for (const sx of [-7.5, 7.5]) {
      box(B.solid, MAT.concrete, gx + sx, 4.0, gz, 2.2, 8.0, 2.2);
      box(B.solid, MAT.trim, gx + sx, 8.2, gz, 2.9, 0.5, 2.9);
      box(B.solid, MAT.gold, gx + sx, 8.7, gz, 1.4, 0.6, 1.4);
      addCollider2(gx + sx - 1.1, gx + sx + 1.1, gz - 1.1, gz + 1.1, 0, 8.5, 0);
    }
    box(B.solid, MAT.trim, gx, 8.6, gz, 17.5, 1.4, 2.0);
    box(B.solid, MAT.concrete, gx, 9.5, gz, 15.0, 0.5, 1.6);

    const tex = makeLabelTexture("UNIVERSITY OF PORT HARCOURT", "KNOWLEDGE · UNITY · SERVICE");
    const mat = S({ map: tex, roughness: 0.6, emissive: 0x0a1218, emissiveIntensity: 0.5 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 3.9), mat);
    sign.position.set(gx, 8.6, gz + 1.05);
    scene.add(sign);
    const signBack = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 3.9), mat);
    signBack.position.set(gx, 8.6, gz - 1.05);
    signBack.rotation.y = Math.PI;
    scene.add(signBack);

    for (const sx of [-16, 16]) {
      box(B.solid, MAT.concrete, gx + sx, 1.6, gz + 3, 6, 3.2, 5);
      box(B.solid, MAT.roofGrey || MAT.darkMetal, gx + sx, 3.4, gz + 3, 6.8, 0.4, 5.8);
      addCollider2(gx + sx - 3, gx + sx + 3, gz + 0.5, gz + 5.5, 0, 3.4, 0);
    }
  }
  buildMainGate(0, 234);

  /* ---------- FURNITURE ---------- */
  function makeFrame(x, y, z, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return {
      ry,
      pt(lx, ly, lz) { return [x + lx * c + lz * s, y + ly, z - lx * s + lz * c]; },
      box(batch, mat, lx, ly, lz, w, h, d) {
        const p = this.pt(lx, ly, lz);
        box(batch, mat, p[0], p[1], p[2], w, h, d, ry);
      }
    };
  }
  function fChair(F, lx, lz) {
    F.box(B.detail, MAT.woodDark, lx, 0.45, lz, 0.46, 0.07, 0.46);
    F.box(B.detail, MAT.woodDark, lx, 0.70, lz + 0.2, 0.46, 0.45, 0.06);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
      F.box(B.detail, MAT.metal, lx + dx, 0.22, lz + dz, 0.05, 0.45, 0.05);
    }
  }
  function fDesk(x, y, z, ry) {
    const F = makeFrame(x, y, z, ry);
    F.box(B.detail, MAT.wood, 0, 0.74, 0, 1.65, 0.07, 0.82);
    F.box(B.detail, MAT.metal, -0.75, 0.37, 0, 0.07, 0.74, 0.72);
    F.box(B.detail, MAT.metal, 0.75, 0.37, 0, 0.07, 0.74, 0.72);
    F.box(B.detail, MAT.metal, 0, 0.60, 0, 1.44, 0.04, 0.68);
    fChair(F, 0, 0.85);
  }
  function fTable(x, y, z, ry, w = 1.9, d = 0.95) {
    const F = makeFrame(x, y, z, ry);
    F.box(B.detail, MAT.wood, 0, 0.75, 0, w, 0.08, d);
    for (const [dx, dz] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1],
                            [-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]]) {
      F.box(B.detail, MAT.metal, dx, 0.37, dz, 0.07, 0.74, 0.07);
    }
    fChair(F, -w * 0.26, d / 2 + 0.32);
    fChair(F, w * 0.26, d / 2 + 0.32);
    fChair(F, -w * 0.26, -d / 2 - 0.32);
    fChair(F, w * 0.26, -d / 2 - 0.32);
  }
  function fShelf(x, y, z, ry) {
    const F = makeFrame(x, y, z, ry);
    F.box(B.detail, MAT.woodDark, 0, 1.0, 0, 1.15, 2.0, 0.36);
    for (let i = 0; i < 5; i++) {
      F.box(B.detail, MAT.wood, 0, 0.16 + i * 0.42, 0.02, 1.05, 0.05, 0.34);
      const n = 4 + Math.floor(Math.random() * 4);
      for (let b = 0; b < n; b++) {
        const bw = 0.07 + Math.random() * 0.05, bh = 0.22 + Math.random() * 0.1;
        F.box(B.detail, Math.random() > 0.5 ? MAT.fabricRed : MAT.fabric,
              -0.5 + b * 0.12, 0.18 + i * 0.42 + bh / 2, 0.02, bw, bh, 0.26);
      }
    }
  }
  function fCabinet(x, y, z, ry) {
    const F = makeFrame(x, y, z, ry);
    F.box(B.detail, MAT.metal, 0, 0.85, 0, 1.0, 1.7, 0.5);
    F.box(B.detail, MAT.darkMetal, 0, 1.28, 0.26, 0.9, 0.03, 0.02);
    F.box(B.detail, MAT.darkMetal, 0, 0.86, 0.26, 0.9, 0.03, 0.02);
    F.box(B.detail, MAT.darkMetal, 0, 0.44, 0.26, 0.9, 0.03, 0.02);
  }
  function fBoard(x, y, z, ry, w = 4.0) {
    const F = makeFrame(x, y, z, ry);
    F.box(B.detail, MAT.board, 0, 1.6, 0, w, 1.15, 0.07);
    F.box(B.detail, MAT.woodDark, 0, 0.99, 0.02, w + 0.14, 0.07, 0.12);
    F.box(B.detail, MAT.woodDark, 0, 2.2, 0.02, w + 0.14, 0.07, 0.12);
  }
  function fPlanter(x, y, z) {
    box(B.detail, MAT.slab, x, y + 0.28, z, 0.9, 0.56, 0.9);
    sphere(B.detail, MAT.leafA, x, y + 0.85, z, 0.42, 0.42, 0.42);
    sphere(B.detail, MAT.leafB, x + 0.16, y + 1.02, z - 0.1, 0.28, 0.28, 0.28);
  }

  function furnishRoom(x0, z0, x1, z1, fy, type, side) {
    const w = x1 - x0, d = z1 - z0;
    if (w < 2.0 || d < 2.0) return;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const face = side === "west" ? Math.PI / 2 : -Math.PI / 2;
    const outerX = side === "west" ? x0 : x1;
    const dir = side === "west" ? 1 : -1;
    const bx = outerX + (side === "west" ? 0.16 : -0.16);

    if (type === "office") {
      fDesk(cx, fy, cz + d * 0.16, face);
      fCabinet(x0 + 0.6, fy, z1 - 0.9, 0);
      if (d > 4.2) fShelf(cx + 1.1, fy, z0 + 0.45, 0);
      fPlanter(x1 - 0.9, fy, z1 - 0.9);
      if (Math.random() > 0.5) fTable(cx - 0.6, fy, z0 + 1.0, 0, 1.4, 0.85);
    } else if (type === "classroom") {
      fBoard(bx, fy, cz, face, Math.min(4.2, d - 1.6));
      const rows = Math.max(1, Math.floor((w - 2.0) / 1.9));
      const cols = Math.max(1, Math.floor((d - 1.6) / 1.9));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const px = (side === "west" ? x0 + 2.4 : x1 - 2.4) + dir * r * 1.9;
        const pz = z0 + 1.1 + c * 1.9;
        if (px > x0 + 0.9 && px < x1 - 0.9) fDesk(px, fy, pz, face);
      }
    } else if (type === "lab") {
      fBoard(bx, fy, cz, face, Math.min(4.0, d - 1.6));
      const rows = Math.max(1, Math.floor((w - 1.8) / 2.6));
      for (let r = 0; r < rows; r++) {
        const px = (side === "west" ? x0 + 2.2 : x1 - 2.2) + dir * r * 2.6;
        if (px < x0 + 0.8 || px > x1 - 0.8) continue;
        const len = Math.min(3.4, d - 1.4);
        box(B.detail, MAT.wood, px, fy + 0.86, cz, 1.1, 0.09, len);
        box(B.detail, MAT.metal, px, fy + 0.43, cz - len / 2 + 0.2, 0.9, 0.86, 0.08);
        box(B.detail, MAT.metal, px, fy + 0.43, cz + len / 2 - 0.2, 0.9, 0.86, 0.08);
        fChair(makeFrame(px, fy, cz - 1.0, face), 0, 0);
        fChair(makeFrame(px, fy, cz + 1.0, face), 0, 0);
      }
    } else if (type === "lecture") {
      fBoard(bx, fy, cz, face, Math.min(6.0, d - 1.4));
      const cols = Math.max(2, Math.floor((d - 1.2) / 1.15));
      const rows = Math.max(2, Math.floor((w - 1.6) / 1.7));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const px = (side === "west" ? x0 + 2.0 : x1 - 2.0) + dir * r * 1.7;
        const pz = z0 + 0.8 + c * 1.15;
        if (px < x0 + 0.7 || px > x1 - 0.7) continue;
        box(B.detail, MAT.fabricRed, px, fy + 0.44, pz, 0.5, 0.1, 0.5);
        box(B.detail, MAT.fabricRed, px, fy + 0.7, pz + 0.22, 0.5, 0.44, 0.07);
        box(B.detail, MAT.metal, px, fy + 0.2, pz, 0.08, 0.4, 0.08);
      }
    } else if (type === "study") {
      const rows = Math.max(1, Math.floor((w - 1.6) / 2.4));
      for (let r = 0; r < rows; r++) {
        const px = (side === "west" ? x0 + 2.0 : x1 - 2.0) + dir * r * 2.4;
        if (px < x0 + 0.9 || px > x1 - 0.9) continue;
        fTable(px, fy, cz, 0, 1.6, Math.min(3.2, d - 1.2));
        fShelf(px, fy, z0 + 0.5, 0);
      }
    } else if (type === "cafeteria") {
      const rows = Math.max(1, Math.floor((w - 1.4) / 2.8));
      const cols = Math.max(1, Math.floor((d - 1.4) / 2.8));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const px = x0 + 1.3 + r * 2.8, pz = z0 + 1.3 + c * 2.8;
        if (px > x1 - 1.0 || pz > z1 - 1.0) continue;
        fTable(px, fy, pz, 0, 1.6, 0.9);
      }
    }
  }

  /* ---------- WALL BUILDER ---------- */
  function buildWall(o) {
    const { x, z, len, height, thick, axis, y0 = 0, mat, openings = [], cast = false } = o;
    const level = y0 >= 4 ? 1 : 0;
    const half = len / 2;
    const ops = openings.map(op => ({
      a: op.at - half, b: op.at + op.width - half,
      bottom: op.bottom ?? 0, top: op.top ?? 2.5, glass: op.glass !== false
    })).sort((p, q) => p.a - q.a);

    const solids = [];
    let cur = -half;
    for (const op of ops) {
      if (op.a > cur + 0.001) solids.push({ u0: cur, u1: op.a, y0: 0, y1: height });
      if (op.bottom > 0.001) solids.push({ u0: op.a, u1: op.b, y0: 0, y1: op.bottom });
      if (op.top < height - 0.001) solids.push({ u0: op.a, u1: op.b, y0: op.top, y1: height });
      cur = Math.max(cur, op.b);
    }
    if (cur < half - 0.001) solids.push({ u0: cur, u1: half, y0: 0, y1: height });

    const batch = cast ? B.solid : B.detail;
    for (const s of solids) {
      const sl = s.u1 - s.u0, sh = s.y1 - s.y0;
      if (sl <= 0.01 || sh <= 0.01) continue;
      const cu = (s.u0 + s.u1) / 2, cy = y0 + s.y0 + sh / 2;
      if (axis === "x") {
        box(batch, mat, x + cu, cy, z, sl, sh, thick);
        addCollider2(x + cu - sl / 2, x + cu + sl / 2, z - thick / 2, z + thick / 2, y0 + s.y0, y0 + s.y1, level);
      } else {
        box(batch, mat, x, cy, z + cu, thick, sh, sl);
        addCollider2(x - thick / 2, x + thick / 2, z + cu - sl / 2, z + cu + sl / 2, y0 + s.y0, y0 + s.y1, level);
      }
    }
    for (const op of ops) {
      if (!op.glass) continue;
      const sl = op.b - op.a, sh = op.top - op.bottom;
      if (sl <= 0.02 || sh <= 0.02) continue;
      const cu = (op.a + op.b) / 2;
      if (axis === "x") box(B.flat, MAT.glass, x + cu, y0 + op.bottom + sh / 2, z, sl * 0.96, sh * 0.96, 0.06);
      else box(B.flat, MAT.glass, x, y0 + op.bottom + sh / 2, z + cu, 0.06, sh * 0.96, sl * 0.96);
    }
  }

  function makeWindows(len, winW, spacing, bottom, top, skip = []) {
    const out = [];
    const usable = len - 3.6 - winW;
    if (usable < 0) return out;
    const n = Math.max(1, Math.floor(usable / spacing) + 1);
    const total = (n - 1) * spacing + winW;
    const a0 = (len - total) / 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * spacing;
      if (skip.some(r => a < r[1] + 0.6 && a + winW > r[0] - 0.6)) continue;
      out.push({ at: a, width: winW, bottom, top, glass: true });
    }
    return out;
  }

  /* ---------- EXTERIOR STAIRCASE ---------- */
  function addExteriorStair(sx, zWall, y0, y1, lvFrom) {
    const rise = y1 - y0;
    const run = rise / Math.tan(THREE.MathUtils.degToRad(26));
    const halfW = 1.7;
    const zTop = zWall - 0.7;
    const zBot = zTop - run;

    stairs.push({ minX: sx - halfW, maxX: sx + halfW, minZ: zBot, maxZ: zTop,
                  y0, y1, axis: "z", level: lvFrom, toLevel: lvFrom + 1 });

    box(B.solid, MAT.concrete, sx, y1 - 0.15, (zTop + zWall) / 2, halfW * 2, 0.3, 0.85);

    const steps = Math.max(6, Math.round(rise / 0.19));
    const stepRise = rise / steps, stepRun = run / steps;
    for (let i = 0; i < steps; i++) {
      const zc = zBot + stepRun * (i + 0.5);
      const yc = y0 + stepRise * (i + 0.5);
      box(B.solid, MAT.concrete, sx, yc - stepRise / 2 + stepRise, zc, halfW * 2, stepRise * 2, stepRun + 0.02);
    }
    for (const side of [-1, 1]) {
      const rx = sx + side * halfW;
      const angle = Math.atan2(rise, run);
      const midZ = (zBot + zTop) / 2, midY = (y0 + y1) / 2 + 1.05;
      _e.set(-angle, 0, 0); _q.setFromEuler(_e); _v.set(rx, midY, midZ);
      _s.set(0.09, 0.09, run / Math.cos(angle));
      _m4.compose(_v, _q, _s); B.solid.add(UNIT_BOX, MAT.metal, _m4);
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        cyl(B.solid, MAT.metal, rx, y0 + rise * t + 0.55, zBot + run * t, 0.05, 1.1, 0, UNIT_CYL6);
      }
      _e.set(-angle, 0, 0); _q.setFromEuler(_e); _v.set(rx, (y0 + y1) / 2 - 0.05, midZ);
      _s.set(0.2, 0.45, run / Math.cos(angle));
      _m4.compose(_v, _q, _s); B.solid.add(UNIT_BOX, MAT.concrete, _m4);
      /* side rails block (both levels, taller than step height) */
      const wx0 = rx + (side > 0 ? 0.0 : -0.25), wx1 = rx + (side > 0 ? 0.25 : 0.0);
      addCollider2(wx0, wx1, zBot, zWall, y0, y1 + 2.2, lvFrom);
      addCollider2(wx0, wx1, zBot, zWall, y0, y1 + 2.2, lvFrom + 1);
    }
  }

  /* ---------- BUILDING FACTORY ---------- */
  const BUILDING_INFO = [];
  function createBuilding(cfg) {
    const { x, z, w, d, floors = 1, floorH = 4.6, wallT = 0.42,
            wallColor = 0xe8e3d6, roofColor = 0x606770,
            roomType = "office", title = "BUILDING", subtitle = "" } = cfg;

    const wallMat = S({ color: wallColor, roughness: 0.9 });
    const roofMat = S({ color: roofColor, roughness: 0.94 });

    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const inX0 = x0 + wallT, inX1 = x1 - wallT, inZ0 = z0 + wallT;
    const cw = 3.9, cxW = x - cw / 2, cxE = x + cw / 2;

    const lv = [0.1];
    for (let f = 1; f < floors; f++) lv[f] = lv[f - 1] + floorH;
    const wallH = floorH - 0.35;

    BUILDING_INFO.push({ x, z, r: Math.max(w, d) * 0.72 + 6, title });

    for (let f = 0; f < floors; f++) {
      const fy = lv[f];
      if (f === 0) {
        box(B.detail, MAT.slab, x, fy - 0.22, z, w, 0.44, d);
        box(B.detail, MAT.tile, x, fy - 0.02, z, w - wallT * 2, 0.05, d - wallT * 2);
      } else {
        box(B.solid, MAT.slab, x, fy - 0.19, z, w, 0.38, d);
        box(B.detail, MAT.tile, x, fy - 0.02, z, w - wallT * 2, 0.05, d - wallT * 2);
      }

      const nRooms = Math.max(2, Math.round((d - 2 * wallT) / 9));
      const roomD = (d - 2 * wallT) / nRooms;
      const doorsW = [], doorsE = [];
      for (let k = 0; k < nRooms; k++) {
        const at = (k + 0.5) * roomD - 0.85;
        doorsW.push({ at, width: 1.7, bottom: 0, top: 2.6, glass: false });
        doorsE.push({ at, width: 1.7, bottom: 0, top: 2.6, glass: false });
      }
      buildWall({ x: cxW, z, len: d - 2 * wallT, height: wallH, thick: 0.28, axis: "z", y0: fy, mat: wallMat, openings: doorsW });
      buildWall({ x: cxE, z, len: d - 2 * wallT, height: wallH, thick: 0.28, axis: "z", y0: fy, mat: wallMat, openings: doorsE });

      for (let k = 1; k < nRooms; k++) {
        const bz = inZ0 + k * roomD;
        const wLen = cxW - inX0;
        if (wLen > 0.5) buildWall({ x: (inX0 + cxW) / 2, z: bz, len: wLen, height: wallH, thick: 0.24, axis: "x", y0: fy, mat: wallMat });
        const eLen = inX1 - cxE;
        if (eLen > 0.5) buildWall({ x: (cxE + inX1) / 2, z: bz, len: eLen, height: wallH, thick: 0.24, axis: "x", y0: fy, mat: wallMat });
      }
      for (let k = 0; k < nRooms; k++) {
        const rz0 = inZ0 + k * roomD + 0.2, rz1 = inZ0 + (k + 1) * roomD - 0.2;
        furnishRoom(inX0 + 0.2, rz0, cxW - 0.2, rz1, fy, roomType, "west");
        furnishRoom(cxE + 0.2, rz0, inX1 - 0.2, rz1, fy, roomType, "east");
      }

      const southDoors = [];
      if (f === 0) southDoors.push({ at: w / 2 - 2.0, width: 4.0, bottom: 0, top: 3.0, glass: false });
      const southOps = makeWindows(w, 2.5, 5.2, 1.15, 3.0, southDoors.map(o => [o.at, o.at + o.width])).concat(southDoors);
      buildWall({ x, z: z1, len: w, height: wallH, thick: wallT, axis: "x", y0: fy, mat: wallMat, openings: southOps, cast: true });

      const northDoors = [];
      for (let s = 0; s < floors - 1; s++) {
        const sx = (s % 2 === 0) ? -w / 4 : w / 4;
        if (f === s || f === s + 1) northDoors.push({ at: sx + w / 2 - 1.15, width: 2.3, bottom: 0, top: 2.7, glass: false });
      }
      const northOps = makeWindows(w, 2.5, 5.2, 1.15, 3.0, northDoors.map(o => [o.at, o.at + o.width])).concat(northDoors);
      buildWall({ x, z: z0, len: w, height: wallH, thick: wallT, axis: "x", y0: fy, mat: wallMat, openings: northOps, cast: true });

      buildWall({ x: x0, z, len: d, height: wallH, thick: wallT, axis: "z", y0: fy, mat: wallMat, openings: makeWindows(d, 2.5, 5.2, 1.15, 3.0), cast: true });
      buildWall({ x: x1, z, len: d, height: wallH, thick: wallT, axis: "z", y0: fy, mat: wallMat, openings: makeWindows(d, 2.5, 5.2, 1.15, 3.0), cast: true });

      const pilStep = 6.5;
      const nPil = Math.floor(w / pilStep);
      for (let i = 1; i < nPil; i++) {
        const px = x0 + i * (w / nPil);
        box(B.solid, MAT.trim, px, fy + wallH / 2, z1 + 0.12, 0.55, wallH, 0.35);
        box(B.solid, MAT.trim, px, fy + wallH / 2, z0 - 0.12, 0.55, wallH, 0.35);
      }
      const nPilD = Math.floor(d / pilStep);
      for (let i = 1; i < nPilD; i++) {
        const pz = z0 + i * (d / nPilD);
        box(B.solid, MAT.trim, x0 - 0.12, fy + wallH / 2, pz, 0.35, wallH, 0.55);
        box(B.solid, MAT.trim, x1 + 0.12, fy + wallH / 2, pz, 0.35, wallH, 0.55);
      }
      box(B.solid, MAT.trim, x, fy + wallH - 0.15, z, w + 0.9, 0.35, d + 0.9);

      if (f === 0) {
        box(B.solid, MAT.trim, x, fy + 3.5, z1 + 2.2, 8.4, 0.4, 4.8);
        for (const sx of [-3.6, 3.6]) {
          cyl(B.solid, MAT.trim, x + sx, fy + 1.75, z1 + 4.2, 0.35, 3.5, 0, UNIT_CYL);
          addCollider2(x + sx - 0.4, x + sx + 0.4, z1 + 3.8, z1 + 4.6, 0, fy + 3.5, 0);
        }
        for (let i = 0; i < 3; i++) {
          box(B.solid, MAT.slab, x, fy - 0.15 - i * 0.15, z1 + 0.55 + i * 0.5, 7.0, 0.16, 0.5);
        }
        const tex = makeLabelTexture(title, subtitle);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), S({ map: tex, roughness: 0.65 }));
        sign.position.set(x, fy + 4.35, z1 + 0.24);
        scene.add(sign);
      }
    }

    for (let s = 0; s < floors - 1; s++) {
      const sx = x + ((s % 2 === 0) ? -w / 4 : w / 4);
      addExteriorStair(sx, z0, lv[s], lv[s + 1], s);
    }

    const topY = lv[floors - 1] + wallH;
    box(B.solid, roofMat, x, topY + 0.25, z, w + 0.7, 0.5, d + 0.7);
    const ph = 0.95;
    box(B.solid, MAT.trim, x, topY + 0.5 + ph / 2, z1 + 0.3, w + 0.7, ph, 0.35);
    box(B.solid, MAT.trim, x, topY + 0.5 + ph / 2, z0 - 0.3, w + 0.7, ph, 0.35);
    box(B.solid, MAT.trim, x1 + 0.3, topY + 0.5 + ph / 2, z, 0.35, ph, d + 0.7);
    box(B.solid, MAT.trim, x0 - 0.3, topY + 0.5 + ph / 2, z, 0.35, ph, d + 0.7);
    for (let i = 0; i < 3; i++) {
      const rx = x + (Math.random() - 0.5) * (w - 8), rz = z + (Math.random() - 0.5) * (d - 8);
      box(B.solid, MAT.metal, rx, topY + 1.1, rz, 2.2, 1.2, 1.6);
      cyl(B.solid, MAT.metal, rx, topY + 1.05, rz, 0.55, 0.1, 0, UNIT_CYL6);
    }
    if (floors > 1) {
      cyl(B.solid, MAT.metal, x + w * 0.28, topY + 2.0, z - d * 0.25, 1.5, 2.6, 0, UNIT_CYL);
      box(B.solid, MAT.metal, x + w * 0.28, topY + 0.8, z - d * 0.25, 3.2, 0.3, 3.2);
    }
  }

  /* ---------- PLACE BUILDINGS ---------- */
  const R_INNER = 70, R_OUTER = 150;
  const bisector = (k) => THREE.MathUtils.degToRad(22.5 + k * 45);
  const BUILDINGS = [
    { title: "SENATE BUILDING", subtitle: "Administration & Council", r: R_INNER, a: bisector(0), w: 34, d: 26, floors: 2, wallColor: 0xece6d8, roofColor: 0x5b636c, roomType: "office" },
    { title: "FACULTY OF SCIENCE", subtitle: "Physics · Chemistry · Biology", r: R_INNER, a: bisector(1), w: 32, d: 26, floors: 2, wallColor: 0xdfe5e0, roofColor: 0x566270, roomType: "lab" },
    { title: "FACULTY OF ENGINEERING", subtitle: "Civil · Mechanical · Electrical", r: R_INNER, a: bisector(2), w: 34, d: 26, floors: 2, wallColor: 0xd9dde3, roofColor: 0x4f5a66, roomType: "lab" },
    { title: "FACULTY OF LAW", subtitle: "Moot Court & Chambers", r: R_INNER, a: bisector(3), w: 30, d: 24, floors: 2, wallColor: 0xeee2d2, roofColor: 0x6a5548, roomType: "lecture" },
    { title: "FACULTY OF ARTS", subtitle: "Humanities & Languages", r: R_INNER, a: bisector(4), w: 30, d: 24, floors: 2, wallColor: 0xe9dfd4, roofColor: 0x6b5c4e, roomType: "classroom" },
    { title: "FACULTY OF SOCIAL SCIENCES", subtitle: "Economics · Sociology · Psychology", r: R_INNER, a: bisector(5), w: 32, d: 24, floors: 2, wallColor: 0xe3e6e8, roofColor: 0x5a6470, roomType: "classroom" },
    { title: "COLLEGE OF HEALTH SCIENCES", subtitle: "Medicine · Nursing · Pharmacy", r: R_INNER, a: bisector(6), w: 34, d: 26, floors: 2, wallColor: 0xeef2f0, roofColor: 0x52666d, roomType: "lab" },
    { title: "ICT & INNOVATION CENTRE", subtitle: "Computing · Research Labs", r: R_INNER, a: bisector(7), w: 30, d: 24, floors: 2, wallColor: 0xdde8ee, roofColor: 0x4a5a66, roomType: "office" },
    { title: "UNIVERSITY LIBRARY", subtitle: "Knowledge Resource Centre", r: R_OUTER, a: bisector(0), w: 46, d: 36, floors: 2, wallColor: 0xf0e9dc, roofColor: 0x6d5646, roomType: "study" },
    { title: "STUDENT UNION & CAFETERIA", subtitle: "Student Life Complex", r: R_OUTER, a: bisector(4), w: 44, d: 32, floors: 1, wallColor: 0xe4ded0, roofColor: 0x7a5c46, roomType: "cafeteria" }
  ];
  for (const b of BUILDINGS) {
    createBuilding({ ...b, x: Math.cos(b.a) * b.r, z: Math.sin(b.a) * b.r });
  }

  /* ---------- CAMPUS DRESSING ---------- */
  function insideBuilding(x, z, margin = 3) {
    for (const b of BUILDING_INFO) {
      if (Math.abs(x - b.x) < b.r + margin && Math.abs(z - b.z) < b.r + margin) return true;
    }
    return false;
  }
  function nearRoad(x, z, clearance = 8) {
    const r = Math.hypot(x, z);
    if (r < 36 && r > 10) return true;
    for (const R of RING_RADII) if (Math.abs(r - R) < clearance) return true;
    for (const a of RADIAL_ANGLES) {
      const d = Math.abs(x * Math.sin(a) - z * Math.cos(a));
      if (d < clearance && r > 30 && r < 240) return true;
    }
    return false;
  }

  let treeCount = 0;
  for (let i = 0; i < 700 && treeCount < 260; i++) {
    const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 195;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (nearRoad(x, z, 9) || insideBuilding(x, z, 5)) continue;
    const s = 0.75 + Math.random() * 0.7, th = 3.4 * s;
    cyl(B.solid, MAT.trunk, x, th / 2, z, 0.28 * s, th, 0, UNIT_CYL6);
    const leafMat = Math.random() > 0.55 ? MAT.leafA : (Math.random() > 0.5 ? MAT.leafB : MAT.leafC);
    sphere(B.solid, leafMat, x, th + 1.5 * s, z, 2.5 * s, 1.9 * s, 2.5 * s);
    sphere(B.solid, leafMat, x + 0.9 * s, th + 2.6 * s, z - 0.6 * s, 1.7 * s, 1.4 * s, 1.7 * s);
    sphere(B.solid, leafMat, x - 1.0 * s, th + 2.2 * s, z + 0.8 * s, 1.5 * s, 1.3 * s, 1.5 * s);
    addCollider2(x - 0.45, x + 0.45, z - 0.45, z + 0.45, 0, th, 0);
    treeCount++;
  }

  for (const a of RADIAL_ANGLES) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let r = 46; r < 232; r += 22) {
      const off = ROAD_W / 2 + 2.2;
      for (const sign of [-1, 1]) {
        const x = ca * r - sa * off * sign, z = sa * r + ca * off * sign;
        if (insideBuilding(x, z, 2)) continue;
        cyl(B.solid, MAT.darkMetal, x, 3.4, z, 0.13, 6.8, 0, UNIT_CYL6);
        box(B.solid, MAT.darkMetal, x + ca * 0.9, 6.85, z + sa * 0.9, 1.9 * Math.abs(ca) + 0.2, 0.18, 1.9 * Math.abs(sa) + 0.2, 0);
        box(B.detail, MAT.white, x + ca * 1.6, 6.68, z + sa * 1.6, 0.85, 0.16, 0.85);
        addCollider2(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, 6.8, 0);
      }
    }
  }

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = 38;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const F = makeFrame(x, 0, z, -a);
    F.box(B.detail, MAT.wood, 0, 0.48, 0, 2.4, 0.1, 0.62);
    F.box(B.detail, MAT.wood, 0, 0.78, -0.28, 2.4, 0.55, 0.09);
    F.box(B.detail, MAT.metal, -1.0, 0.24, 0, 0.1, 0.48, 0.55);
    F.box(B.detail, MAT.metal, 1.0, 0.24, 0, 0.1, 0.48, 0.55);
    addCollider2(x - 1.2, x + 1.2, z - 0.5, z + 0.5, 0, 0.85, 0);
  }

  {
    cyl(B.solid, MAT.concrete, 0, 0.6, 0, 3.4, 1.2, 0, UNIT_CYL);
    cyl(B.solid, MAT.trim, 0, 1.3, 0, 2.6, 0.3, 0, UNIT_CYL);
    box(B.solid, MAT.trim, 0, 6.0, 0, 1.6, 9.0, 1.6);
    box(B.solid, MAT.gold, 0, 10.6, 0, 1.9, 0.5, 1.9);
    cyl(B.solid, MAT.gold, 0, 11.9, 0, 0.5, 2.2, 0, new THREE.ConeGeometry(0.5, 1, 4));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      box(B.solid, MAT.gold, Math.cos(a) * 0.82, 5.2, Math.sin(a) * 0.82, 0.9, 1.6, 0.06, -a);
    }
    addCollider2(-3.5, 3.5, -3.5, 3.5, 0, 11, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, r = 9.5;
      sphere(B.detail, MAT.leafB, Math.cos(a) * r, 0.55, Math.sin(a) * r, 1.1, 0.6, 1.1);
      sphere(B.detail, MAT.leafA, Math.cos(a + 0.25) * r, 0.5, Math.sin(a + 0.25) * r, 0.85, 0.45, 0.85);
    }
  }

  {
    const SEG = 96, R = 240;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (Math.abs(x) < 20 && z > 0) continue;
      sphere(B.detail, MAT.leafC, x, 0.7, z, 2.4, 0.9, 2.4);
    }
  }

  B.solid.flush(40000);
  B.detail.flush(60000);
  B.flat.flush(60000);

  /* ---------- GAME GLUE ---------- */
  const world = {
    colliders,
    seats: [],
    uses: [],
    stairs,
    platforms: [],
    levelHeight: (l) => (l > 0 ? 0.1 + l * LEVEL_H : 0),
    bounds: { minX: -245, maxX: 245, minZ: -245, maxZ: 262 },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, world, {
    scene, x: 0, z: 214, yaw: Math.PI, level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "UNIPORT",
    title: "",
    subtitle: "",
    hint: "",
    isInterior: true,
    sceneId: "university",
    update: (dt) => { ctl.update(dt); },
    dispose: () => ctl.dispose(),
  };
}
