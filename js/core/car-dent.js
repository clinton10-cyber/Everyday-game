/* ════════════════════════════════════════════════════════════════
   car-dent.js — real body damage: the metal is pressed IN where the force hit.

   How a dent is made (all on the car's actual meshes):
     1. find the surface point the force reaches (a ray from the side the hit came from),
     2. split the triangles around it (they are low-poly) so the metal can crumple smoothly,
     3. push every vertex inside the dent radius along the force direction, deepest at the
        centre, fading to zero at the rim, with a ragged crumple noise,
     4. scuff the paint there (vertex colours) and rebuild the shading normals.
   Wheels are never dented. Hits accumulate. repair() puts the factory body back.

   API
     CarDent.hit(root, forceDir{x,z}, frac)      – a normal hit; frac = damage / max-hp (0..1+)
     CarDent.dentAt(root, point, dir, opts)      – a dent at a world point, pressed along dir
     CarDent.crush(root, forceDir, power)        – wreck: heavy crumpling front/back/sides/roof
     CarDent.repair(root)                        – restore the original undamaged body
     CarDent.release(root)                       – free the saved originals (car removed)
   ════════════════════════════════════════════════════════════════ */
import * as THREE from "three";

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _box = new THREE.Box3(), _ray = new THREE.Raycaster();
const MAX_TRIS = 16000;           /* per-mesh safety cap after splitting */
const MAX_DENTS = 18;             /* per car */

/* ── cheap smooth value noise, [-1,1] ── */
function h3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const n = L(
    L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
  return n * 2 - 1;
}

/* ── which meshes may be dented ── */
function wheelSet(root) {
  const s = new Set();
  const list = (root.userData && root.userData.wheels) || [];
  for (const w of list) if (w && w.isObject3D) s.add(w);
  root.traverse((o) => { if (o.userData && o.userData.wheels) for (const w of o.userData.wheels) if (w && w.isObject3D) s.add(w); });
  return s;
}
function isWheel(mesh, root, wheels) {
  for (let o = mesh; o && o !== root.parent; o = o.parent) {
    if (wheels.has(o)) return true;
    if (/wheel|tyre|tire|rim|hub/i.test(o.name || "")) return true;
    if (o === root) break;
  }
  return false;
}
function dentables(root) {
  const wheels = wheelSet(root), out = [];
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry || !m.geometry.attributes || !m.geometry.attributes.position) return;
    if (isWheel(m, root, wheels)) return;
    out.push(m);
  });
  return out;
}
function carDims(root) {
  if (root.userData._dentDims) return root.userData._dentDims;
  const q = root.quaternion.clone(), p = root.position.clone();      /* measure un-rotated so a tumbling car can't skew it */
  root.quaternion.identity(); root.position.set(0, 0, 0); root.updateMatrixWorld(true);
  _box.setFromObject(root);
  const sz = _box.getSize(new THREE.Vector3());
  root.quaternion.copy(q); root.position.copy(p); root.updateMatrixWorld(true);
  const d = { L: Math.max(sz.x, sz.z, 3), W: Math.min(sz.x, sz.z), H: Math.max(sz.y, 1) };
  root.userData._dentDims = d;
  return d;
}
function carLength(root) { return carDims(root).L; }

/* ── first dent on a mesh: keep the pristine geometry + material, work on copies ── */
function prepMesh(mesh) {
  if (mesh.userData._dd) return mesh.geometry;
  const orig = mesh.geometry, origMat = mesh.material;
  const g = orig.clone();
  if (!g.index) {                                              /* give un-indexed meshes a trivial index so they can be split */
    const n = g.attributes.position.count, ix = new Uint32Array(n);
    for (let i = 0; i < n; i++) ix[i] = i;
    g.setIndex(new THREE.BufferAttribute(ix, 1));
  }
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3).fill(1);                 /* white = paint unchanged */
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const clones = [];
  const cm = (m) => { const c = m.clone(); if ("vertexColors" in c) c.vertexColors = true; c.needsUpdate = true; clones.push(c); return c; };
  mesh.material = Array.isArray(origMat) ? origMat.map(cm) : cm(origMat);
  mesh.geometry = g;
  mesh.userData._dd = { orig, origMat, clones };
  return g;
}

/* ── split triangles that touch the dent so the surface can bend ── */
function subdivide(geo, M, hit, Rs, target) {
  const names = Object.keys(geo.attributes);
  const A = {};
  for (const n of names) {
    const a = geo.attributes[n];
    if (a.isInterleavedBufferAttribute) continue;
    A[n] = { arr: Array.from(a.array), size: a.itemSize, norm: a.normalized, ctor: a.array.constructor };
  }
  const P = A.position.arr;
  let idx = Array.from(geo.index.array);
  let tris = idx.length / 3, did = false;
  const wp = (i, o) => o.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(M);
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
  for (let pass = 0; pass < 4; pass++) {
    const cache = new Map(), out = [];
    let split = false;
    const mid = (a, b) => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a;
      let m = cache.get(key);
      if (m !== undefined) return m;
      m = P.length / 3;
      for (const n in A) { const at = A[n]; for (let k = 0; k < at.size; k++) at.arr.push((at.arr[a * at.size + k] + at.arr[b * at.size + k]) * 0.5); }
      cache.set(key, m);
      return m;
    };
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
      wp(i0, p0); wp(i1, p1); wp(i2, p2);
      const e = Math.max(p0.distanceTo(p1), p1.distanceTo(p2), p2.distanceTo(p0));
      _c.copy(p0).add(p1).add(p2).multiplyScalar(1 / 3);
      if (e > target && tris < MAX_TRIS && _c.distanceTo(hit) < Rs + e * 0.6) {
        const a = mid(i0, i1), b = mid(i1, i2), c = mid(i2, i0);
        out.push(i0, a, c, a, i1, b, c, b, i2, a, b, c);
        tris += 3; split = true;
      } else out.push(i0, i1, i2);
    }
    idx = out;
    if (!split) break;
    did = true;
  }
  if (!did) return false;
  for (const n in A) { const at = A[n]; geo.setAttribute(n, new THREE.BufferAttribute(new at.ctor(at.arr), at.size, at.norm)); }
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.boundingSphere = null; geo.boundingBox = null;
  return true;
}

/* ── press the metal in ── */
function deform(mesh, hit, dir, R, depth) {
  const geo = mesh.geometry, M = mesh.matrixWorld;
  const inv = M.clone().invert();
  const pos = geo.attributes.position, col = geo.attributes.color, nor = geo.attributes.normal;
  const nm = new THREE.Matrix3().getNormalMatrix(M);
  const n = pos.count;
  const moved = new Uint8Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    _w.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
    const d = _w.distanceTo(hit);
    if (d >= R) continue;
    /* only the metal that FACES the force is pressed in — panels on the far side (floor, other door) are untouched */
    let face = 1;
    if (nor) {
      _v.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(nm).normalize();
      const f = -_v.dot(dir);                                      /* 1 = facing the incoming force, -1 = facing away */
      face = f <= -0.05 ? 0 : f >= 0.45 ? 1 : (f + 0.05) / 0.5;
      face = face * face * (3 - 2 * face);
      if (face <= 0) continue;
    }
    const t = 1 - d / R, s0 = (t * t * (3 - 2 * t)) * face, s = Math.pow(s0, 0.62);   /* steep walls, flat-ish floor */
    if (s0 < 0.004) continue;
    const nz = noise(_w.x * 3.7, _w.y * 3.7, _w.z * 3.7);
    const nz2 = noise(_w.x * 9.1 + 5, _w.y * 9.1, _w.z * 9.1);
    const ridge = 1 - Math.abs(noise(_w.x * 5.3 + 11, _w.y * 5.3, _w.z * 5.3));    /* 1 on a crease line, 0 between them */
    const crease = Math.pow(ridge, 3);                             /* sharp fold lines radiating through the dent */
    const dd = depth * s * (0.8 + 0.22 * nz + 0.32 * crease);     /* ragged, creased crater */
    _d.copy(dir).multiplyScalar(dd);
    _v.copy(hit).sub(_w).multiplyScalar(0.16 * s * (dd / depth));  /* the sheet gathers towards the impact */
    _d.add(_v);
    _d.x += nz2 * 0.05 * depth * s; _d.y += nz * 0.05 * depth * s; _d.z -= nz2 * 0.05 * depth * s;
    _w.add(_d).applyMatrix4(inv);
    pos.setXYZ(i, _w.x, _w.y, _w.z);
    if (col) {                                                    /* scuffed, darker paint at the centre of the dent */
      const k = 1 - Math.min(0.85, 0.62 * s * (0.8 + 0.2 * nz2) + 0.35 * crease * s);
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
    moved[i] = 1; any = true;
  }
  CarDent.stats.meshes++; CarDent.stats.moved += moved.reduce((a, b) => a + b, 0);
  if (!any) return;
  pos.needsUpdate = true; if (col) col.needsUpdate = true;
  smoothMovedNormals(geo, moved);
  geo.boundingSphere = null; geo.boundingBox = null;
}

/* fresh shading normals for the moved vertices only (welded by position so the dent shades smoothly) */
function smoothMovedNormals(geo, moved) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index.array;
  if (!nor) { geo.computeVertexNormals(); return; }
  const acc = new Map();
  const key = (i) => Math.round(pos.getX(i) * 1500) + "," + Math.round(pos.getY(i) * 1500) + "," + Math.round(pos.getZ(i) * 1500);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
    if (!(moved[i0] || moved[i1] || moved[i2])) continue;
    a.set(pos.getX(i0), pos.getY(i0), pos.getZ(i0));
    b.set(pos.getX(i1), pos.getY(i1), pos.getZ(i1));
    c.set(pos.getX(i2), pos.getY(i2), pos.getZ(i2));
    b.sub(a); c.sub(a); b.cross(c);                               /* area-weighted face normal */
    for (const i of [i0, i1, i2]) {
      const k = key(i);
      const e = acc.get(k);
      if (e) { e.x += b.x; e.y += b.y; e.z += b.z; } else acc.set(k, b.clone());
    }
  }
  for (let i = 0; i < pos.count; i++) {
    if (!moved[i]) continue;
    const e = acc.get(key(i));
    if (!e || e.lengthSq() < 1e-12) continue;
    e.normalize();
    nor.setXYZ(i, e.x, e.y, e.z);
  }
  nor.needsUpdate = true;
}

/* ── where does a force reach the car's surface? ── */
function pickSurface(root, origin, dir, meshes) {
  _ray.set(origin, dir); _ray.far = 60;
  const hits = _ray.intersectObjects(meshes, false);
  return hits.length ? hits[0].point.clone() : null;
}

function applyDent(root, hit, dir, R, depth) {
  root.updateMatrixWorld(true);
  const L = carLength(root);
  const target = Math.max(0.16, L * 0.04);
  for (const m of dentables(root)) {
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    _c.copy(g.boundingSphere.center).applyMatrix4(m.matrixWorld);
    const sc = Math.max(m.matrixWorld.getMaxScaleOnAxis(), 1e-3);
    if (_c.distanceTo(hit) > g.boundingSphere.radius * sc + R * 1.3) continue;
    const geo = prepMesh(m);
    m.updateMatrixWorld(true);
    subdivide(geo, m.matrixWorld, hit, R * 1.3, target);
    deform(m, hit, dir, R, depth);
  }
}

export const CarDent = {
  stats: { meshes: 0, moved: 0, hits: [] },
  /* a dent at world point `hit`, pressed along unit vector `dir`. opts: { depth, radius } in metres */
  dentAt(root, hit, dir, opts) {
    if (!root) return false;
    opts = opts || {};
    root.userData._dents = (root.userData._dents || 0) + 1;
    if (root.userData._dents > MAX_DENTS) return false;
    const L = carLength(root);
    const R = opts.radius || L * 0.2;
    const depth = Math.min(opts.depth || L * 0.08, L * 0.16, carDims(root).H * 0.4);   /* never deeper than the body is tall */
    _d.copy(dir).normalize();
    CarDent.stats.hits.push({ x: +hit.x.toFixed(2), y: +hit.y.toFixed(2), z: +hit.z.toFixed(2), R: +R.toFixed(2), depth: +depth.toFixed(3), L: +L.toFixed(2) });
    applyDent(root, hit.clone(), _d.clone(), R, depth);
    return true;
  },

  /* force pushing on the car along world direction {x,z} (e.g. the other car's travel direction).
     frac = damage / max-hp. The dent lands on the side the force came from. */
  hit(root, force, frac, opts) {
    if (!root) return false;
    try {
      opts = opts || {};
      root.updateMatrixWorld(true);
      const L = carLength(root);
      const f = new THREE.Vector3(force ? force.x : rnd(-1, 1), 0, force ? force.z : rnd(-1, 1));
      if (f.lengthSq() < 1e-8) f.set(rnd(-1, 1), 0, rnd(-1, 1));
      f.normalize();
      const k = clamp(0.35 + (frac || 0.3) * 1.3, 0.35, 1.4);
      const count = opts.count || (k > 0.95 ? 2 : 1);
      _box.setFromObject(root);
      const size = _box.getSize(new THREE.Vector3()), ctr = _box.getCenter(new THREE.Vector3());
      const meshes = dentables(root);
      for (let n = 0; n < count; n++) {
        const side = new THREE.Vector3(-f.z, 0, f.x).multiplyScalar(rnd(-0.32, 0.32) * Math.min(size.x, size.z) * (n ? 1.6 : 1));
        const o = ctr.clone().addScaledVector(f, -L).add(side);
        o.y = _box.min.y + size.y * rnd(0.42, 0.68);
        const dir = f.clone(); dir.y = -0.08;
        let p = pickSurface(root, o, dir.clone().normalize(), meshes);
        if (!p) p = ctr.clone().addScaledVector(f, -L * 0.4).add(side);
        this.dentAt(root, p, f, { depth: L * 0.052 * k * (n ? 0.75 : 1), radius: L * 0.19 * (0.8 + 0.3 * k) });
      }
      return true;
    } catch (e) { console.warn("[car-dent] hit", e); return false; }
  },

  /* wreck: crumpled from several sides + a caved-in roof */
  crush(root, force, power) {
    if (!root) return;
    try {
      root.updateMatrixWorld(true);
      const L = carLength(root), pw = clamp(power == null ? 1 : power, 0.4, 1.3);
      this.hit(root, force, 1.2 * pw, { count: 2 });
      for (let i = 0; i < 3; i++) this.hit(root, { x: rnd(-1, 1), z: rnd(-1, 1) }, 0.7 * pw, { count: 1 });
      _box.setFromObject(root);
      const size = _box.getSize(new THREE.Vector3()), ctr = _box.getCenter(new THREE.Vector3());
      const meshes = dentables(root);
      const o = new THREE.Vector3(ctr.x + rnd(-0.4, 0.4), _box.max.y + 3, ctr.z + rnd(-0.8, 0.8));
      const p = pickSurface(root, o, new THREE.Vector3(0, -1, 0), meshes);
      if (p) this.dentAt(root, p, new THREE.Vector3(0, -1, 0), { depth: L * 0.06 * pw, radius: L * 0.24 });
    } catch (e) { console.warn("[car-dent] crush", e); }
  },

  /* put the undamaged body back */
  repair(root) {
    if (!root) return;
    root.traverse((m) => {
      const dd = m.userData && m.userData._dd;
      if (!dd) return;
      try { m.geometry.dispose(); dd.clones.forEach((c) => c.dispose()); } catch (e) {}
      m.geometry = dd.orig; m.material = dd.origMat;
      delete m.userData._dd;
    });
    root.userData._dents = 0;
  },

  /* the car is being removed for good: free the saved pristine geometry */
  release(root) {
    if (!root) return;
    root.traverse((m) => {
      const dd = m.userData && m.userData._dd;
      if (!dd) return;
      try { dd.orig.dispose(); dd.clones.forEach((c) => c.dispose()); } catch (e) {}
    });
  },
};

if (typeof window !== "undefined") window.__ph3d_cardent = CarDent;
