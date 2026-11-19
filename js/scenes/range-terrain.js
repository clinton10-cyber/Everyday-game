/* js/scenes/range-terrain.js — open-field "Vast Terrain" arena for the Tactical Range.
   Rolling hills (flat at both spawn zones), scattered cover with AABB colliders sitting ON the ground
   (footprints are sunk into slopes, never floating), a treeline and boundary walls.
   Returns the same shape as buildArena() in shootingrange.js plus groundAt(x,z). */
import * as THREE from "three";

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeTerrainHeight(W, D) {
  const flat = [{ x: 0, z: D / 2 - 8, r: 12 }, { x: 0, z: -(D / 2 - 6), r: 20 }];
  const hills = [{ x: -26, z: 6, r: 15, a: 3.4 }, { x: 28, z: -12, r: 13, a: 2.8 }, { x: 4, z: -2, r: 10, a: 1.8 }];
  return function h(x, z) {
    let v = Math.sin(x * 0.055) * Math.cos(z * 0.048) * 1.5 + Math.sin(x * 0.13 + 1.7) * 0.4 + Math.cos(z * 0.11 - 0.6) * 0.35
          + Math.sin((x * 0.6 + z * 0.8) * 0.04) * 0.9;
    for (const hl of hills) { const d2 = (x - hl.x) ** 2 + (z - hl.z) ** 2; v += hl.a * Math.exp(-d2 / (2 * (hl.r / 2) ** 2)); }
    let f = 1;
    for (const zn of flat) f = Math.min(f, sstep(zn.r, zn.r + 14, Math.hypot(x - zn.x, z - zn.z)));
    return v * f;
  };
}

export function buildTerrainArena(three, W, D) {
  const colliders = [], coverBoxes = [], mats = [], geos = [];
  const M = (c, r = 0.95, extra = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r }, extra)); mats.push(m); return m; };
  const G = (g) => { geos.push(g); return g; };
  const h = makeTerrainHeight(W, D);
  const rng = mulberry32(20261118);

  /* ── ground mesh (extends past the play area so the edge never shows) ── */
  {
    const EW = W + 80, ED = D + 80, SEG = 110;
    const g = G(new THREE.PlaneGeometry(EW, ED, SEG, SEG)); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(0x4f7a35), cB = new THREE.Color(0x78984f), cD = new THREE.Color(0x6d5738), cR = new THREE.Color(0x8a857b), t = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = h(x, z); pos.setY(i, y);
      const sl = Math.hypot(h(x + 1.5, z) - h(x - 1.5, z), h(x, z + 1.5) - h(x, z - 1.5)) / 3;
      const n = (Math.sin(x * 1.7) * Math.cos(z * 1.3) + 1) / 2;
      t.copy(cA).lerp(cB, n * 0.8); t.lerp(cD, sstep(0.18, 0.5, sl)); t.lerp(cR, sstep(0.5, 0.9, sl));
      if (Math.hypot(x, z - (D / 2 - 8)) < 12 || Math.hypot(x, z + (D / 2 - 6)) < 18) t.lerp(cD, 0.55);   /* worn dirt at the spawn pads */
      col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, M(0xffffff, 1, { vertexColors: true, flatShading: true })); three.add(m);
  }

  /* ── props ── */
  const placed = [];
  const clear = (x, z, r) => { for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < r + p.r) return false; return true; };
  const inSpawn = (x, z) => z > D / 2 - 16 && Math.abs(x) < 22 || z < -(D / 2 - 12);
  /* a solid prop: mesh sunk into the slope, collider top flat at (highest ground under it + height) */
  function solid(x, z, w, hh, d, color, cover, shape) {
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]].map(([dx, dz]) => h(x + dx, z + dz));
    const lo = Math.min(...corners), hi = Math.max(...corners), top = hi + hh, bottom = lo - 0.25;
    let mesh;
    if (shape === "rock") {
      mesh = new THREE.Mesh(G(new THREE.IcosahedronGeometry(1, 0)), M(color, 1, { flatShading: true }));
      mesh.scale.set(w / 2 * 1.08, (top - bottom) / 2, d / 2 * 1.08); mesh.position.set(x, (top + bottom) / 2, z); mesh.rotation.y = rng() * 6;
    } else {
      mesh = new THREE.Mesh(G(new THREE.BoxGeometry(w, top - bottom, d)), M(color, 0.9));
      mesh.position.set(x, (top + bottom) / 2, z);
    }
    mesh.castShadow = false; three.add(mesh);
    const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y0: lo, y1: top, level: 0 };
    colliders.push(c); if (cover && hh >= 1.6) coverBoxes.push(c);
    placed.push({ x, z, r: Math.max(w, d) / 2 + 1.2 });
    return c;
  }
  const px = () => (rng() - 0.5) * (W - 10), pz = () => (rng() - 0.5) * (D - 10);
  const tryProp = (fn, n, spacing) => { let made = 0, guard = 0; while (made < n && guard++ < n * 40) { const x = px(), z = pz(); if (inSpawn(x, z) || !clear(x, z, spacing)) continue; fn(x, z); made++; } };

  tryProp((x, z) => { const s = 2.2 + rng() * 2; solid(x, z, s, 1.8 + rng() * 1.6, s * (0.7 + rng() * 0.5), [0x8a857b, 0x77726a, 0x948f84][(rng() * 3) | 0], true, "rock"); }, 26, 5);
  tryProp((x, z) => { const w = 1.6 + rng() * 0.8; solid(x, z, w, 1.9, w, 0x8a6a45, true, "box"); solid(x + w * 0.9, z + 0.2, w * 0.9, 0.95, w * 0.9, 0x7a5a3a, false, "box"); }, 12, 5);
  tryProp((x, z) => { const long = 5 + rng() * 3, along = rng() < 0.5; solid(x, z, along ? long : 0.55, 2.3, along ? 0.55 : long, 0x9a9a94, true, "box"); }, 12, 6);
  tryProp((x, z) => { const along = rng() < 0.5; solid(x, z, along ? 3.6 : 1, 0.95, along ? 1 : 3.6, 0xb59a6a, false, "box"); }, 12, 4);
  tryProp((x, z) => {                                                                                   /* small huts */
    const c = solid(x, z, 7, 3.2, 5.4, 0xb8ad98, true, "box");
    const roof = new THREE.Mesh(G(new THREE.BoxGeometry(7.6, 0.3, 6)), M(0x6a4a3a)); roof.position.set(x, c.y1 + 0.15, z); three.add(roof);
  }, 4, 10);
  tryProp((x, z) => {                                                                                   /* trees: thin collider, not cover */
    const base = h(x, z), s = 0.9 + rng() * 0.7;
    const trunk = new THREE.Mesh(G(new THREE.CylinderGeometry(0.2 * s, 0.32 * s, 3.4 * s, 6)), M(0x6b4f34)); trunk.position.set(x, base + 1.6 * s, z); three.add(trunk);
    const cone = new THREE.Mesh(G(new THREE.ConeGeometry(1.7 * s, 5 * s, 7)), M(0x3f6b31, 1, { flatShading: true })); cone.position.set(x, base + 5 * s, z); three.add(cone);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, y0: base, y1: base + 5, level: 0 });
    placed.push({ x, z, r: 2.2 });
  }, 40, 5);

  /* ── treeline outside the boundary + invisible boundary walls ── */
  {
    const n = 150, im = new THREE.InstancedMesh(G(new THREE.ConeGeometry(2, 7, 6)), M(0x2f5a2a, 1, { flatShading: true }), n), m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = rng() * 4, side = a | 0, u = (a - side - 0.5);
      const off = 4 + rng() * 22, x = side < 2 ? u * (W + 40) : (side === 2 ? -1 : 1) * (W / 2 + off), z = side < 2 ? (side === 0 ? -1 : 1) * (D / 2 + off) : u * (D + 40);
      const s = 0.8 + rng() * 1.1;
      m4.compose(new THREE.Vector3(x, h(x, z) + 3 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m4);
    }
    im.frustumCulled = false; three.add(im);
    const T = 0.6, top = 60;
    colliders.push({ minX: -W / 2 - T, maxX: W / 2 + T, minZ: -D / 2 - T, maxZ: -D / 2, y0: -20, y1: top, level: 0 });
    colliders.push({ minX: -W / 2 - T, maxX: W / 2 + T, minZ: D / 2, maxZ: D / 2 + T, y0: -20, y1: top, level: 0 });
    colliders.push({ minX: -W / 2 - T, maxX: -W / 2, minZ: -D / 2, maxZ: D / 2, y0: -20, y1: top, level: 0 });
    colliders.push({ minX: W / 2, maxX: W / 2 + T, minZ: -D / 2, maxZ: D / 2, y0: -20, y1: top, level: 0 });
  }
  return { colliders, coverBoxes, mats, geos, groundAt: h };
}
