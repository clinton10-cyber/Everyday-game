/* ============================================================
   FlashPool - shared, permanent PointLights for muzzle / impact flashes.

   WHY: three.js compiles every lit material's shader for the exact number
   of lights in the scene. Adding or removing a PointLight at runtime
   changes that number, so ALL lit materials recompile on the next frame
   (a CPU/driver freeze that a fast GPU does not help). Creating a light
   per shot and removing it 100ms later meant two recompiles per effect.

   FIX: a few lights per scene are added ONCE and never removed. A flash
   just borrows one, sets position/colour/intensity, and fades it back to
   0. Light count stays constant, so nothing recompiles. Call
   FlashPool.prime(scene) when a scene loads so even the first shot is free.
   ============================================================ */
import * as THREE from "three";

const POOL_SIZE = 3;
const _pools = new WeakMap();   /* scene -> { lights: [{ light, until, base, life, t }], next } */

function poolFor(scene) {
  let p = _pools.get(scene);
  if (p) return p;
  p = { lights: [], next: 0 };
  for (let i = 0; i < POOL_SIZE; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 4, 2);
    light.userData.__flashPool = true;
    light.castShadow = false;
    scene.add(light);
    p.lights.push({ light, base: 0, life: 0, t: 0, active: false });
  }
  _pools.set(scene, p);
  return p;
}

let _last = 0, _raf = 0;
const _scenes = new Set();

function loop(now) {
  const dt = Math.min(0.1, (now - _last) / 1000); _last = now;
  let any = false;
  for (const scene of _scenes) {
    const p = _pools.get(scene);
    if (!p) { _scenes.delete(scene); continue; }
    let sceneActive = false;
    for (const s of p.lights) {
      if (!s.active) continue;
      s.t += dt;
      const k = 1 - s.t / s.life;
      if (k <= 0) { s.active = false; s.light.intensity = 0; }
      else { s.light.intensity = s.base * k; sceneActive = true; }
    }
    if (sceneActive) any = true; else _scenes.delete(scene);
  }
  _raf = any ? requestAnimationFrame(loop) : 0;
}

export const FlashPool = {
  /* add the pooled lights to a scene up front (one-time recompile at load, not mid-fight) */
  prime(scene) { if (scene) poolFor(scene); },

  /* flash at world position p; pos may be a Vector3 or {x,y,z} */
  fire(scene, pos, color, intensity, dist, life) {
    if (!scene) return;
    const p = poolFor(scene);
    /* prefer a free slot, otherwise steal the round-robin one */
    let s = p.lights.find((x) => !x.active);
    if (!s) { s = p.lights[p.next]; p.next = (p.next + 1) % p.lights.length; }
    s.active = true; s.t = 0; s.life = Math.max(0.02, life); s.base = intensity;
    s.light.color.set(color);
    s.light.distance = dist;
    s.light.position.set(pos.x, pos.y, pos.z);
    s.light.intensity = intensity;
    _scenes.add(scene);
    if (!_raf) { _last = performance.now(); _raf = requestAnimationFrame(loop); }
  },
};
