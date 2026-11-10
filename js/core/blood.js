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

export const Blood = {
  _active: [],

  spray(scene, x, y, z, opts) {
    if (!scene) return;
    opts = opts || {};
    const count   = opts.count   || 20;
    const spread  = opts.spread  || 5;
    const color   = opts.color   != null ? opts.color : BLOOD_RED;
    const gravity = opts.gravity != null ? opts.gravity : -22;

    if (!_particleGeom) _particleGeom = new THREE.SphereGeometry(0.06, 4, 3);

    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    const group = new THREE.Group();
    group.position.set(x, y, z);
    scene.add(group);

    /* One InstancedMesh per burst instead of 20 individual meshes. */
    const inst = new THREE.InstancedMesh(_particleGeom, mat, count);
    inst.frustumCulled = false;
    const velocities = new Float32Array(count * 3);
    const positions  = new Float32Array(count * 3);
    const _m = new THREE.Matrix4();
    const _q = new THREE.Quaternion();
    const _p = new THREE.Vector3();
    const _s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      velocities[i * 3]     = Math.cos(a) * r;
      velocities[i * 3 + 1] = 3 + Math.random() * spread;
      velocities[i * 3 + 2] = Math.sin(a) * r;
      _p.set(0, 0, 0); _q.identity();
      _m.compose(_p, _q, _s);
      inst.setMatrixAt(i, _m);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    this._active.push({ scene, group, inst, velocities, positions, count, mat, gravity, elapsed: 0, ttl: 1.8, isSplat: false, _m, _q, _p, _s });
  },

  splat(scene, x, z) {
    if (!scene) return;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0,   "rgba(120,15,15,0.9)");
    grad.addColorStop(0.6, "rgba(100,10,10,0.5)");
    grad.addColorStop(1,   "rgba(80,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.02, z);
    scene.add(mesh);
    this._active.push({ scene, mesh, elapsed: 0, ttl: 10, isSplat: true });
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
        } else if (s.elapsed > s.ttl - 2) {
          s.mesh.material.opacity = (s.ttl - s.elapsed) / 2;
        }
        continue;
      }

      for (let j = 0; j < s.count; j++) {
        const j3 = j * 3;
        s.velocities[j3 + 1] += s.gravity * dt;
        s.positions[j3]     += s.velocities[j3]     * dt;
        s.positions[j3 + 1] += s.velocities[j3 + 1] * dt;
        s.positions[j3 + 2] += s.velocities[j3 + 2] * dt;
        if (s.positions[j3 + 1] < -0.02) {
          s.positions[j3 + 1] = -0.02;
          s.velocities[j3 + 1] = -s.velocities[j3 + 1] * 0.3;
          s.velocities[j3]     *= 0.7;
          s.velocities[j3 + 2] *= 0.7;
        }
        s._p.set(s.positions[j3], s.positions[j3 + 1], s.positions[j3 + 2]);
        s._m.compose(s._p, s._q, s._s);
        s.inst.setMatrixAt(j, s._m);
      }
      s.inst.instanceMatrix.needsUpdate = true;

      if (s.elapsed >= s.ttl) {
        if (s.group.parent) s.group.parent.remove(s.group);
        s.mat.dispose();
        list.splice(i, 1);
      } else if (s.elapsed > s.ttl - 0.6) {
        s.mat.opacity = (s.ttl - s.elapsed) / 0.6;
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
