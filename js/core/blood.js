/* ════════════════════════════════════════════════════════════════
   blood.js — impact particles.

   Blood.spray(scene, x, y, z, { count, spread, color, gravity })
   Blood.splat(scene, x, z)     // ground stain, fades after 10s
   Blood.tick(dt)               // call every frame
   Blood.clear()                // on scene dispose

   Default colour is dark blood red; pass `color: 0xffcc5e`
   to re-use the same system for collision sparks.
   ════════════════════════════════════════════════════════════════ */

import * as THREE from "three";

const BLOOD_RED = 0xa81818;
let _particleGeom = null;
const UPV = new THREE.Vector3(0, 1, 0);
const _vv = new THREE.Vector3();

/* irregular blotch + satellite drops (a plain radial disc reads as a red coin) */
function blotchTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  const blob = (x, y, r, a) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, "rgba(110,10,10," + a + ")");
    rg.addColorStop(0.65, "rgba(90,8,8," + (a * 0.65) + ")");
    rg.addColorStop(1, "rgba(70,0,0,0)");
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  };
  blob(48, 48, 22 + Math.random() * 6, 0.8);
  for (let i = 0; i < 7; i++) {                                 /* lobes pushing out of the pool */
    const a = Math.random() * 6.2832, d = 14 + Math.random() * 14;
    blob(48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 6 + Math.random() * 9, 0.7);
  }
  for (let i = 0; i < 9; i++) {                                 /* flung droplets */
    const a = Math.random() * 6.2832, d = 28 + Math.random() * 16;
    blob(48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 1.5 + Math.random() * 3, 0.85);
  }
  return c;
}

export const Blood = {
  _active: [],

  /* opts: { count, spread, color, gravity,
             dir:{x,y,z}  — bullet direction: droplets fan out along it (exit spray) instead of a fountain
             back:true    — spray the opposite way (entry mist toward the shooter)
             floorY       — WORLD height of the floor the droplets land on (default: 0, or the origin for low bursts) } */
  spray(scene, x, y, z, opts) {
    if (!scene) return;
    opts = opts || {};
    const count   = opts.count   || 20;
    const spread  = opts.spread  || 5;
    const color   = opts.color   != null ? opts.color : BLOOD_RED;
    const gravity = opts.gravity != null ? opts.gravity : -22;
    const isBlood = opts.color == null;

    if (!_particleGeom) _particleGeom = new THREE.SphereGeometry(1, 6, 4);

    /* droplets settle on the FLOOR, not at the height they were born (they used to hang in mid-air as solid balls) */
    const floor = opts.floorY != null ? opts.floorY - y : (y > 0.3 ? -y : -0.02);

    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isBlood ? 0.82 : 1, depthWrite: false });
    const group = new THREE.Group();
    group.position.set(x, y, z);
    scene.add(group);

    /* One InstancedMesh per burst instead of 20 individual meshes. */
    const inst = new THREE.InstancedMesh(_particleGeom, mat, count);
    inst.frustumCulled = false;
    const velocities = new Float32Array(count * 3);
    const positions  = new Float32Array(count * 3);
    const sizes      = new Float32Array(count);
    const landed     = new Uint8Array(count);
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _p = new THREE.Vector3();
    const _s = new THREE.Vector3(1, 1, 1);

    let dx = 0, dy = 0, dz = 0, directed = false;
    if (opts.dir) {
      const l = Math.hypot(opts.dir.x, opts.dir.y || 0, opts.dir.z) || 1;
      const sg = opts.back ? -1 : 1;
      dx = (opts.dir.x / l) * sg; dy = ((opts.dir.y || 0) / l) * sg; dz = (opts.dir.z / l) * sg; directed = true;
    }
    for (let i = 0; i < count; i++) {
      if (directed) {                                            /* cone along the bullet, fast core, slow edges */
        const sp = (0.35 + Math.random() * 0.65) * spread * 1.3;
        const cone = 0.45;
        velocities[i * 3]     = (dx + (Math.random() - 0.5) * cone) * sp;
        velocities[i * 3 + 1] = (dy + (Math.random() - 0.35) * cone) * sp + Math.random() * 1.2;
        velocities[i * 3 + 2] = (dz + (Math.random() - 0.5) * cone) * sp;
      } else {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        velocities[i * 3]     = Math.cos(a) * r;
        velocities[i * 3 + 1] = 3 + Math.random() * spread;
        velocities[i * 3 + 2] = Math.sin(a) * r;
      }
      sizes[i] = isBlood ? 0.014 + Math.random() * Math.random() * 0.04 : 0.010 + Math.random() * 0.014;   /* sparks: tiny hot specks */   /* mostly fine drops, a few fat ones */
      _p.set(0, 0, 0); _q.identity(); _s.setScalar(sizes[i]);
      _m.compose(_p, _q, _s);
      inst.setMatrixAt(i, _m);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    this._active.push({ scene, group, inst, velocities, positions, sizes, landed, count, mat, gravity, floor, isBlood, elapsed: 0, ttl: isBlood ? 2.4 : 1.2, isSplat: false, _m, _q, _p, _s });
  },

  /* ground stain. y = world floor height (defaults to 0), size multiplier optional. It spreads out, then dries and fades. */
  splat(scene, x, z, y, size) {
    if (!scene) return;
    const tex = new THREE.CanvasTexture(blotchTexture());
    tex.colorSpace = THREE.SRGBColorSpace;
    const sz = (size || 1) * (1.1 + Math.random() * 0.9);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sz, sz),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * 6.2832;
    mesh.position.set(x, (y || 0) + 0.02, z);
    mesh.scale.setScalar(0.25);
    scene.add(mesh);
    this._active.push({ scene, mesh, elapsed: 0, ttl: 14, isSplat: true });
  },

  tick(dt) {
    const list = this._active;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.elapsed += dt;

      if (s.isSplat) {
        if (s.elapsed >= s.ttl) {
          if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
          s.mesh.geometry.dispose();
          if (s.mesh.material.map) s.mesh.material.map.dispose();
          s.mesh.material.dispose();
          list.splice(i, 1);
        } else {
          const grow = Math.min(1, s.elapsed / 0.9);                /* the pool spreads out */
          s.mesh.scale.setScalar(0.25 + 0.75 * (1 - Math.pow(1 - grow, 3)));
          if (s.elapsed > s.ttl - 3) s.mesh.material.opacity = 0.85 * (s.ttl - s.elapsed) / 3;
        }
        continue;
      }

      const fadeK = s.elapsed > s.ttl - 0.8 ? Math.max(0.001, (s.ttl - s.elapsed) / 0.8) : 1;   /* shrink away instead of popping out */
      for (let j = 0; j < s.count; j++) {
        const j3 = j * 3;
        const r = s.sizes[j];
        if (s.landed[j]) {                                          /* a stain on the floor: stays put, flat */
          s._p.set(s.positions[j3], s.floor + 0.012, s.positions[j3 + 2]);
          s._q.identity(); s._s.set(r * 2.2 * fadeK, r * 0.12, r * 2.2 * fadeK);
          s._m.compose(s._p, s._q, s._s); s.inst.setMatrixAt(j, s._m);
          continue;
        }
        s.velocities[j3 + 1] += s.gravity * dt;
        s.positions[j3]     += s.velocities[j3]     * dt;
        s.positions[j3 + 1] += s.velocities[j3 + 1] * dt;
        s.positions[j3 + 2] += s.velocities[j3 + 2] * dt;
        if (s.positions[j3 + 1] <= s.floor) {
          s.positions[j3 + 1] = s.floor;
          if (s.isBlood) { s.landed[j] = 1; }                       /* blood sticks; sparks still bounce */
          else { s.velocities[j3 + 1] = -s.velocities[j3 + 1] * 0.3; s.velocities[j3] *= 0.7; s.velocities[j3 + 2] *= 0.7; }
        }
        s._p.set(s.positions[j3], s.positions[j3 + 1], s.positions[j3 + 2]);
        /* a droplet in flight is a streak along its velocity, not a ball */
        const vx = s.velocities[j3], vy = s.velocities[j3 + 1], vz = s.velocities[j3 + 2];
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (sp > 0.5) { _vv.set(vx / sp, vy / sp, vz / sp); s._q.setFromUnitVectors(UPV, _vv); } else s._q.identity();
        const stretch = 1 + Math.min(3.2, sp * 0.2);
        s._s.set(r * fadeK, r * stretch * fadeK, r * fadeK);
        s._m.compose(s._p, s._q, s._s);
        s.inst.setMatrixAt(j, s._m);
      }
      s.inst.instanceMatrix.needsUpdate = true;

      if (s.elapsed >= s.ttl) {
        if (s.group.parent) s.group.parent.remove(s.group);
        s.mat.dispose();
        list.splice(i, 1);
      }
    }
  },

  clear() {
    for (const s of this._active) {
      if (s.group && s.group.parent) s.group.parent.remove(s.group);
      if (s.mesh && s.mesh.parent) s.mesh.parent.remove(s.mesh);
      if (s.mat) s.mat.dispose();
    }
    this._active.length = 0;
  },
};
