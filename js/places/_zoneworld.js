/* _zoneworld.js -- the SAME procedural Lagos ring-road layout the
   minimap (_minimapbuilder.js) draws: ring road, plaza, palms, street
   vendors, and 8 tap-to-enter buildings.
   Factored out so the walkable/driveable version of a place (zonewalk.js
   / zonedrive.js) looks EXACTLY like its minimap -- same geometry, same
   colours, same building positions -- just explorable on foot or by car
   instead of orbited from above.
   Rounded-rectangle ring road with real curbs, sidewalks, centre-lines,
   palm trees, street vendors,
   a central fountain plaza, and 8 tap-to-enter child buildings.
   Based on the user's "Lagos Ring Road" reference design. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { textLabel } from "../core/kit.js";

/* =========================================================================
   0.  utilities
   ========================================================================= */
const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

let _seed = 0x1a2b3c4d;
function rnd() {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
}
const rr = (a, b) => a + rnd() * (b - a);

const _m4 = new THREE.Matrix4();
const _qt = new THREE.Quaternion();
const _eu = new THREE.Euler();
const _v3 = new THREE.Vector3();
const _sc = new THREE.Vector3();

function xform(g, x=0,y=0,z=0, rx=0,ry=0,rz=0, sx=1,sy=1,sz=1) {
  _eu.set(rx, ry, rz);
  _qt.setFromEuler(_eu);
  _v3.set(x, y, z);
  _sc.set(sx, sy, sz);
  _m4.compose(_v3, _qt, _sc);
  g.applyMatrix4(_m4);
  return g;
}
function paint(g, hex) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i*3] = c.r; a[i*3+1] = c.g; a[i*3+2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function P(list) {
  const arr = new Array(list.length);
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    arr[i] = Array.isArray(it) ? paint(it[0], it[1]) : paint(it, 0xffffff);
  }
  const merged = mergeGeometries(arr, false);
  for (const g of arr) g.dispose();
  return merged;
}

/* =========================================================================
   1.  RingPath -- rounded-rectangle closed path with arc-length parameterisation
   ========================================================================= */
class RingPath {
  constructor(A, B, R) {
    this.A = A; this.B = B; this.R = R;
    const a = A - R, b = B - R;
    const hl = Math.PI * R * 0.5;
    this.segs = [
      { t:0, x0: -a, z0:  B, dx: 1, dz: 0, len: 2*a },
      { t:1, cx:  a, cz:  b, R, a0: Math.PI/2, dir: -1, len: hl },
      { t:0, x0:  A, z0:  b, dx: 0, dz:-1, len: 2*b },
      { t:1, cx:  a, cz: -b, R, a0: 0,         dir: -1, len: hl },
      { t:0, x0:  a, z0: -B, dx:-1, dz: 0, len: 2*a },
      { t:1, cx: -a, cz: -b, R, a0:-Math.PI/2, dir: -1, len: hl },
      { t:0, x0: -A, z0: -b, dx: 0, dz: 1, len: 2*b },
      { t:1, cx: -a, cz:  b, R, a0: Math.PI,   dir: -1, len: hl }
    ];
    this.cum = [0];
    let L = 0;
    for (const s of this.segs) { L += s.len; this.cum.push(L); }
    this.length = L;
  }
  at(s, out) {
    out = out || {};
    const L = this.length;
    s = s - Math.floor(s / L) * L;
    const segs = this.segs, cum = this.cum;
    let i = 0;
    while (i < segs.length - 1 && s >= cum[i + 1]) i++;
    const g = segs[i], u = s - cum[i];
    if (g.t === 0) {
      out.x = g.x0 + g.dx * u;
      out.z = g.z0 + g.dz * u;
      out.tx = g.dx; out.tz = g.dz;
      out.k = 0;
    } else {
      const th = g.a0 + g.dir * (u / g.R);
      const c = Math.cos(th), sn = Math.sin(th);
      out.x = g.cx + g.R * c;
      out.z = g.cz + g.R * sn;
      out.tx = -sn * g.dir;
      out.tz =  c * g.dir;
      out.k = 1 / g.R;
    }
    return out;
  }
}

/* =========================================================================
   2.  strip builder
   ========================================================================= */
function stripGeo(path, offA, yA, offB, yB, N) {
  const pos = [], nor = [], uv = [], idx = [];
  const p = {};
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * path.length;
    path.at(s, p);
    const rx = -p.tz, rz = p.tx;
    const ax = p.x + rx * offA, az = p.z + rz * offA;
    const bx = p.x + rx * offB, bz = p.z + rz * offB;
    pos.push(ax, yA, az, bx, yB, bz);
    const dxv = bx - ax, dyv = yB - yA, dzv = bz - az;
    let nx = dyv * p.tz - dzv * 0;
    let ny = dzv * p.tx - dxv * p.tz;
    let nz = dxv * 0 - dyv * p.tx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nor.push(nx/nl, ny/nl, nz/nl, nx/nl, ny/nl, nz/nl);
    uv.push(0, i/N, 1, i/N);
  }
  for (let i = 0; i < N; i++) {
    const a = i*2, b = a+1, c = a+2, d = a+3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* =========================================================================
   4.  buildMinimap
   ========================================================================= */

export function buildZoneWorld(scene, meta, children, onTap) {
  console.log("[minimap] " + meta.id + " \u00B7 " + children.length + " children");

  const SKY = 0xa9c9e8;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 180, 520);

  scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x4a4436, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.45);
  sun.position.set(85, 130, 55);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8fb0ff, 0.30);
  fill.position.set(-70, 45, -60);
  scene.add(fill);

  const MAT = {
    world:   new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true,
              side: THREE.DoubleSide })
  };

  /* --- ground --- */
  const worldParts = [];
  const W = (g, c) => worldParts.push([g, c]);
  W(xform(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI/2), 0, -0.08, 0), 0x6f7a4e);

  /* --- ring road --- */
  const ROAD_HALF = 4.5;
  const SIDEWALK = 3.5;
  const RING = new RingPath(48, 36, 14);
  const L = RING.length;
  const NSEG = 300;

  W(stripGeo(RING, -ROAD_HALF, 0.02, ROAD_HALF, 0.02, NSEG), 0x2f3033);
  W(stripGeo(RING,  ROAD_HALF, 0.02,  ROAD_HALF, 0.16, NSEG), 0x9a9a92);
  W(stripGeo(RING,  ROAD_HALF, 0.16,  ROAD_HALF + SIDEWALK, 0.16, NSEG), 0xa8a89e);
  W(stripGeo(RING, -ROAD_HALF, 0.16, -ROAD_HALF, 0.02, NSEG), 0x9a9a92);
  W(stripGeo(RING, -ROAD_HALF - SIDEWALK, 0.16, -ROAD_HALF, 0.16, NSEG), 0xa8a89e);

  W(stripGeo(RING, -0.20, 0.03, -0.10, 0.03, NSEG), 0xd9b32a);
  W(stripGeo(RING,  0.10, 0.03,  0.20, 0.03, NSEG), 0xd9b32a);

  for (let s = 0; s < L; s += 9) {
    const p = RING.at(s);
    const rx = -p.tz, rz = p.tx;
    const ry = Math.atan2(p.tx, p.tz);
    for (const off of [-2.2, 2.2]) {
      const g = new THREE.BoxGeometry(0.16, 0.02, 3.2);
      xform(g, p.x + rx*off, 0.03, p.z + rz*off, 0, ry, 0);
      W(g, 0xdedbcc);
    }
  }

  /* --- central plaza + fountain --- */
  W(xform(new THREE.CylinderGeometry(9.5, 10, 0.3, 28), 0, 0.15, 0), 0xa8a89e);
  W(xform(new THREE.CylinderGeometry(7.8, 7.8, 0.12, 28), 0, 0.34, 0), 0xc8bfa8);
  W(xform(new THREE.CylinderGeometry(3.6, 3.8, 0.95, 22), 0, 0.90, 0), 0xcfcac0);
  W(xform(new THREE.CylinderGeometry(3.2, 3.2, 0.15, 22), 0, 1.45, 0), 0x5fa8c8);
  W(xform(new THREE.SphereGeometry(0.95, 14, 10), 0, 1.95, 0), 0x9ac8e0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    W(xform(new THREE.CylinderGeometry(0.09, 0.09, 1.25, 6),
      Math.cos(a) * 2.3, 1.75, Math.sin(a) * 2.3), 0x9ac8e0);
  }
  /* plaza lamps */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const lx = Math.cos(a) * 8.5, lz = Math.sin(a) * 8.5;
    W(xform(new THREE.CylinderGeometry(0.10, 0.13, 3.4, 8), lx, 1.7, lz), 0x2a2e34);
    W(xform(new THREE.SphereGeometry(0.2, 10, 8), lx, 3.55, lz), 0xfff0c8);
  }

  /* --- palm trees along the outer verge --- */
  for (let i = 0; i < 34; i++) {
    const s = rnd() * L;
    const side = rnd() < 0.55 ? 1 : -1;
    const p = RING.at(s);
    const rx = -p.tz, rz = p.tx;
    const d = side * rr(ROAD_HALF + SIDEWALK + 3, ROAD_HALF + SIDEWALK + 8);
    const x = p.x + rx * d, z = p.z + rz * d;
    const h = rr(5, 9);
    W(xform(new THREE.CylinderGeometry(0.20, 0.32, h, 6), x, h/2 + 0.16, z), 0x6b5340);
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * TAU + rnd();
      W(xform(new THREE.ConeGeometry(0.55, 3.2, 4),
        x + Math.cos(a) * 0.9, h + 0.55 + 0.16, z + Math.sin(a) * 0.9,
        Math.cos(a) * 1.15, 0, -Math.sin(a) * 1.15), 0x3f7d3a);
    }
  }

  /* --- streetlights along both sidewalks ------------------------------------
     Same design as the Streetlight model (dark plinth + tapered pole, chrome
     bands, curved arm, hooded lamp with a glowing lens). Built from plain
     geometry and merged into the world mesh, so the whole row costs no extra
     draw calls and no per-pole lights (mobile friendly). A pale pool under each
     lamp stands in for the light on the pavement. */
  {
    const up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _d = new THREE.Vector3(), _mid = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
    const rod = (a, b, r, hex) => {                       /* cylinder between two points */
      _d.subVectors(b, a); const len = _d.length(); _mid.addVectors(a, b).multiplyScalar(0.5);
      _q.setFromUnitVectors(up, _d.normalize());
      const g = new THREE.CylinderGeometry(r, r, len, 8);
      g.applyMatrix4(_m4.compose(_mid, _q, _one));
      W(g, hex);
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const SPACING = 24, SIDE_OFF = ROAD_HALF + 1.15, TOP = 0.16;
    for (let s0 = 6; s0 < L - 2; s0 += SPACING) {
      for (const side of [1, -1]) {
        const sPos = s0 + (side < 0 ? SPACING / 2 : 0);          /* stagger left / right */
        const p = RING.at(sPos);
        const rx = -p.tz, rz = p.tx;                              /* road normal */
        const x = p.x + rx * side * SIDE_OFF, z = p.z + rz * side * SIDE_OFF;
        const ax = -rx * side, az = -rz * side;                   /* arm leans out over the road */
        const at = (h, o) => V(x + ax * (o || 0), h, z + az * (o || 0));
        W(xform(new THREE.CylinderGeometry(0.41, 0.47, 0.2, 14), x, TOP + 0.1, z), 0x0a0a0c);          /* plinth */
        W(xform(new THREE.CylinderGeometry(0.27, 0.31, 0.5, 14), x, TOP + 0.45, z), 0x121216);          /* pedestal */
        W(xform(new THREE.CylinderGeometry(0.075, 0.125, 5.0, 12), x, 3.4, z), 0x16161a);               /* tapered pole */
        for (const by of [1.8, 3.2, 4.6, 5.8]) W(xform(new THREE.CylinderGeometry(0.105, 0.108, 0.07, 12), x, by, z), 0x5a5a66); /* chrome bands */
        const arm = [at(5.95, 0), at(6.35, 0.15), at(6.55, 0.65), at(6.5, 1.25), at(6.4, 1.65)];
        for (let i = 0; i < arm.length - 1; i++) rod(arm[i], arm[i + 1], 0.055, 0x16161a);              /* curved arm */
        const hx = x + ax * 1.65, hz = z + az * 1.65;
        W(xform(new THREE.CylinderGeometry(0.13, 0.38, 0.3, 8), hx, 6.25, hz), 0x121216);                /* hood */
        W(xform(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 8), hx, 6.43, hz), 0x2a2a30);               /* cap */
        W(xform(new THREE.ConeGeometry(0.045, 0.14, 8), hx, 6.53, hz), 0x2a2a30);                        /* finial */
        W(xform(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 16), hx, 6.08, hz), 0xfff2cc);              /* glowing lens */
        W(xform(new THREE.CircleGeometry(2.3, 20).rotateX(-Math.PI / 2), hx, TOP + 0.012, hz), 0xb7b3a0);/* pool of light */
      }
    }
  }

  /* --- street vendors with umbrellas along the sidewalks --- */
  function vendorParts(kind, x, z, ry) {
    const parts = [];
    const B = (w,h,d, lx,ly,lz, c, rx=0,ryy=0,rz=0) =>
      parts.push([xform(new THREE.BoxGeometry(w,h,d), lx, ly, lz, rx, ryy, rz), c]);
    const C = (rt,rb,h,seg, lx,ly,lz, c, rx=0,ryy=0,rz=0) =>
      parts.push([xform(new THREE.CylinderGeometry(rt,rb,h,seg), lx, ly, lz, rx, ryy, rz), c]);
    const Cone = (r,h,seg, lx,ly,lz, c) =>
      parts.push([xform(new THREE.ConeGeometry(r,h,seg), lx, ly, lz), c]);
    const Sph = (r, lx,ly,lz, c) =>
      parts.push([xform(new THREE.SphereGeometry(r, 7, 5), lx, ly, lz), c]);

    const WOOD = 0x8a6a42, MET = 0x9aa0a6, SKIN = 0x6b4a33, DARK = 0x2b2b33;
    const UMBS = [0xd0392b, 0x2f8f5b, 0xe0a41c, 0x2b6fd0];
    const SHIRTS = [0x2f7d4f, 0xc0392b, 0x2b6fd0, 0xe0a41c];
    const UMB = UMBS[(rnd()*4)|0];
    const SHIRT = SHIRTS[(rnd()*4)|0];

    /* table */
    B(1.55, 0.08, 0.82, 0, 0.88, 0, WOOD);
    for (const sx of [-1,1]) for (const sz of [-1,1])
      B(0.08, 0.80, 0.08, sx*0.70, 0.44, sz*0.33, WOOD);
    /* umbrella */
    C(0.035, 0.035, 2.30, 6, 0, 1.70, -0.42, MET);
    Cone(1.30, 0.55, 8, 0, 3.0, -0.42, UMB);
    /* vendor figure */
    B(0.36, 0.82, 0.28, 0, 0.45, -1.02, DARK);
    B(0.46, 0.62, 0.30, 0, 1.14, -1.02, SHIRT);
    Sph(0.145, 0, 1.60, -1.02, SKIN);
    B(0.11, 0.50, 0.11,  0.30, 1.22, -0.86, SHIRT);
    B(0.11, 0.50, 0.11, -0.30, 1.22, -0.86, SHIRT);

    /* goods */
    if (kind === 'suya') {
      B(1.00, 0.10, 0.50, 0, 0.96, 0, 0x2a2a2a);
      B(1.00, 0.06, 0.50, 0, 0.94, 0, 0x8a2a12);
      for (let i = 0; i < 7; i++)
        B(0.035, 0.035, 0.80, -0.40 + i*0.13, 1.06, 0, 0x6b3a1e);
    } else if (kind === 'akara') {
      C(0.36, 0.34, 0.14, 12, 0, 0.98, 0, 0x30302f);
      C(0.30, 0.30, 0.04, 12, 0, 1.04, 0, 0x9a6a20);
      for (let i = 0; i < 5; i++)
        Sph(0.07, rr(-0.2, 0.2), 1.06, rr(-0.2, 0.2), 0xc99a3a);
    } else if (kind === 'corn') {
      B(0.90, 0.08, 0.55, 0, 0.94, 0, 0x2a2a2a);
      for (let i = 0; i < 8; i++)
        C(0.055, 0.055, 0.42, 6, rr(-0.36, 0.36), 1.02, rr(-0.16, 0.16),
          0xe0c040, 0, 0, Math.PI/2);
    } else {
      for (let s = 0; s < 3; s++)
        for (let i = 0; i < 4; i++)
          B(0.20, 0.09, 0.26, -0.45 + i*0.30, 0.95 + s*0.10, s*0.16 - 0.16, 0xbfe3f0);
    }
    return { parts, ry };
  }

  const vendorKinds = ['suya', 'akara', 'corn', 'pure'];
  for (let i = 0; i < 10; i++) {
    const s = (i / 10) * L + rr(-10, 10);
    const side = rnd() < 0.55 ? 1 : -1;
    const p = RING.at(s);
    const rx = -p.tz, rz = p.tx;
    const d = side * rr(ROAD_HALF + SIDEWALK * 0.6, ROAD_HALF + SIDEWALK + 1.5);
    const x = p.x + rx * d, z = p.z + rz * d;
    const ry = Math.atan2(-rx * side, -rz * side) + rr(-0.35, 0.35);
    const { parts } = vendorParts(vendorKinds[(rnd() * vendorKinds.length) | 0], x, z, ry);
    for (const p2 of parts) {
      p2[0].applyMatrix4(new THREE.Matrix4().makeRotationY(ry));
      p2[0].translate(x, 0, z);
      worldParts.push(p2);
    }
  }

  /* --- merge ALL static world into one mesh --- */
  {
    const merged = P(worldParts);
    const mesh = new THREE.Mesh(merged, MAT.world);
    mesh.frustumCulled = false;
    scene.add(mesh);
    worldParts.length = 0;
  }

  /* =====================================================================
     BUILDINGS -- one per child, at segment midpoints on the outer verge
     ===================================================================== */
  const SEG_MIDS = [];
  {
    let cum = 0;
    for (const seg of RING.segs) {
      SEG_MIDS.push(cum + seg.len / 2);
      cum += seg.len;
    }
  }

  const BUILDING_OFFSET = 17;
  const buildingGroups = [];
  const buildingColliders = [];
  const buildingGates = [];

  for (let i = 0; i < children.length && i < 8; i++) {
    const child = children[i];
    const sMid = SEG_MIDS[i];
    const p = RING.at(sMid);
    const nx = -p.tz, nz = p.tx;
    /* push the building outward until its footprint clears the ring road */
    let off = BUILDING_OFFSET, bx = p.x + nx * off, bz = p.z + nz * off;
    for (let guard = 0; guard < 12; guard++) {
      let minD = Infinity;
      for (let sc = 0; sc < L; sc += 2) {
        const q = RING.at(sc), dd = Math.hypot(q.x - bx, q.z - bz);
        if (dd < minD) minD = dd;
      }
      if (minD >= ROAD_HALF + 9) break;      /* 7.5 half-footprint + padding */
      off += 2; bx = p.x + nx * off; bz = p.z + nz * off;
    }
    const ry = Math.atan2(nx, nz);

    const colHex = (child.color != null) ? child.color : 0xd0d0d0;
    const roofHex = new THREE.Color(colHex).multiplyScalar(0.55).getHex();
    const parts = [];
    const B = (w,h,d, lx,ly,lz, c, rx=0,ryy=0,rz=0) =>
      parts.push([xform(new THREE.BoxGeometry(w,h,d), lx, ly, lz, rx, ryy, rz), c]);
    const C = (rt,rb,h,seg, lx,ly,lz, c) =>
      parts.push([xform(new THREE.CylinderGeometry(rt,rb,h,seg), lx, ly, lz), c]);

    /* paved compound */
    B(15, 0.14, 15, 0, 0.07, 0, 0x5a5a56);
    /* low fence wall */
    const FH = 0.9, FW = 0.16;
    B(15, FH, FW, 0, FH/2 + 0.14, -7.4, 0xb0a890);
    B(FW, FH, 15, -7.4, FH/2 + 0.14, 0, 0xb0a890);
    B(FW, FH, 15,  7.4, FH/2 + 0.14, 0, 0xb0a890);
    /* front wall with gate gap (facing road = local -z) */
    B(5.0, FH, FW, -5.0, FH/2 + 0.14,  7.4, 0xb0a890);
    B(5.0, FH, FW,  5.0, FH/2 + 0.14,  7.4, 0xb0a890);
    /* gate posts */
    B(0.6, 1.6, 0.6, -2.6, 0.94, 7.4, 0x8a7a6a);
    B(0.6, 1.6, 0.6,  2.6, 0.94, 7.4, 0x8a7a6a);
    /* gate lanterns */
    B(0.35, 0.35, 0.35, -2.6, 1.85, 7.4, 0xffe8a0);
    B(0.35, 0.35, 0.35,  2.6, 1.85, 7.4, 0xffe8a0);

    /* main building */
    const bw = 8, bh = 5.5, bd = 8;
    B(bw, bh, bd, 0, bh/2 + 0.14, -1.5, colHex);
    /* roof slab */
    B(bw + 0.8, 0.3, bd + 0.8, 0, bh + 0.30, -1.5, roofHex);
    /* roof hut (very Lagos) */
    B(2.6, 1.8, 2.6, 0.5, bh + 1.4, -1.5, 0x8a6b4a);
    /* front canopy */
    B(bw * 0.7, 0.2, 1.5, 0, 3.4, 1.8, roofHex);
    B(0.2, 3.4, 0.2, -bw*0.3, 1.7, 2.4, 0xe0d8c8);
    B(0.2, 3.4, 0.2,  bw*0.3, 1.7, 2.4, 0xe0d8c8);
    /* windows (glowing) */
    const winMat = 0xffe8a8;
    const winPos = [
      [-bw/2 - 0.01, 2.2, -1.5, 'x'],
      [ bw/2 + 0.01, 2.2, -1.5, 'x'],
      [0, 2.2, -bd/2 - 1.5 - 0.01, 'z'],
      [0, 4.2, -bd/2 - 1.5 - 0.01, 'z']
    ];
    for (const wp of winPos) {
      if (wp[3] === 'x') {
        for (let k = -1; k <= 1; k++) {
          B(0.06, 1.0, 0.8, wp[0], wp[1], wp[2] + k * 2.2, winMat);
        }
      } else {
        for (let k = -1; k <= 1; k++) {
          B(0.8, 1.0, 0.06, wp[0] + k * 2.2, wp[1], wp[2], winMat);
        }
      }
    }
    /* a small palm inside the compound */
    C(0.18, 0.26, 4.5, 6, -5, 2.5 + 0.14, -5, 0x6b5340);
    for (let f = 0; f < 5; f++) {
      const a = (f / 5) * TAU;
      parts.push([xform(new THREE.ConeGeometry(0.45, 2.6, 4),
        -5 + Math.cos(a) * 0.75, 4.9 + 0.14, -5 + Math.sin(a) * 0.75,
        Math.cos(a) * 1.15, 0, -Math.sin(a) * 1.15), 0x3f7d3a]);
    }

    /* merge this building into one mesh */
    const mergedGeo = P(parts);
    const mesh = new THREE.Mesh(mergedGeo, MAT.world);
    const group = new THREE.Group();
    group.position.set(bx, 0, bz);
    group.rotation.y = ry;
    group.add(mesh);

    /* big tap target floating above */
    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 22),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.rotation.x = -Math.PI / 2;
    hit.position.set(0, 6, 0);
    group.add(hit);

    /* floating nameplate */
    const lbl = textLabel(child.name, child.sub || "");
    lbl.position.set(0, 10, 0);
    lbl.scale.multiplyScalar(0.75);
    group.add(lbl);

    /* pulsing base ring to advertise "tap me" */
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.18, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x5ee0ff, transparent: true, opacity: 0.7 })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.25, 0);
    group.add(ringMesh);

    const tapFn = (e) => { try { onTap(child); } catch (err) { console.warn(err); } };
    mesh.userData.tap = tapFn;
    hit.userData.tap = tapFn;

    scene.add(group);
    buildingGroups.push({ group, ringMesh, phase: i * 0.4, child });

    /* ---- walk/drive support: a world-space collider for the main
       building box, and a gate point just outside the compound where
       the "ENTER" prompt should fire (local (0, +7.4) = the gate gap
       in the front wall, rotated/translated into world space). ---- */
    {
      const cC = Math.cos(ry), sN = Math.sin(ry);
      const toWorld = (lx, lz) => ({ x: bx + lx * cC + lz * sN, z: bz - lx * sN + lz * cC });
      const bCenter = toWorld(0, -1.5);               // local centre of the 8x8 building box
      const half = 4.4;                                 // (8/2)+0.4 pad
      const ex = half * Math.abs(cC) + half * Math.abs(sN);
      const ez = half * Math.abs(sN) + half * Math.abs(cC);
      buildingColliders.push({
        minX: bCenter.x - ex, maxX: bCenter.x + ex,
        minZ: bCenter.z - ez, maxZ: bCenter.z + ez,
        y0: 0, y1: 6, level: 0,
      });
      const gateW = toWorld(0, 9.0);                    // just outside the front gate
      buildingGates.push({
        id: child.id, name: child.name, sub: child.sub || "",
        x: gateW.x, z: gateW.z, yaw: ry + Math.PI, child,
      });
    }
  }

  /* =====================================================================
     RETURN
     ===================================================================== */
  let simTime = 0;

  return {
    RING, L,
    buildingGroups, buildingColliders, buildingGates,
    update: (dt) => {
      simTime += dt;
      for (const bg of buildingGroups) {
        const pulse = 0.55 + Math.sin(simTime * 2 + bg.phase) * 0.25;
        bg.ringMesh.material.opacity = pulse;
        bg.ringMesh.scale.setScalar(1 + Math.sin(simTime * 2 + bg.phase) * 0.04);
      }
    },
    dispose: () => {
      try { scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const list = Array.isArray(o.material) ? o.material : [o.material];
          list.forEach(m => m.dispose());
        }
      }); } catch (e) {}
    },
  };
}

