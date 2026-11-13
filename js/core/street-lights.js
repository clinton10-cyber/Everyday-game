/* ============================================================
   StreetLights - lamps on at dusk, off at dawn.
   Two sources of lamps, both handled by autoFromScene(scene, camera):
   1. Any PointLight above 2.5 m already in the scene (register()).
   2. Lamp spots: scene.userData.__lampSpots = [Vector3 | {x,y,z}, ...]
      (_zoneworld.js publishes its streetlight heads this way). These
      are lit by a small POOL of PointLights that follow the nearest
      lamps to the camera, so 40 lamps cost 4 lights, not 40.
   Opt out with scene.userData.__streetLightsOptOut = true.
   ============================================================ */
import * as THREE from "three";

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const POOL_SIZE = 6;
const POOL_INTENSITY = 18;       /* physically-based point-light intensity */
const POOL_RANGE = 42;

export const StreetLights = {
  lamps: [],          /* { light, base } for real scene PointLights */
  glows: [],          /* night-glow groups (core/night-glow.js) found in the scene */
  on: false,
  _scene: null, _camera: null, _spots: null, _pool: null, _poolIn: false,

  register(light) {
    if (!light || !light.isPointLight) return;
    if (this.lamps.some((l) => l.light === light)) return;
    this.lamps.push({ light, base: light.intensity });
  },

  autoFromScene(scene, camera) {
    this.clear();
    this._scene = scene; this._camera = camera || null;
    if (!scene || scene.userData.__streetLightsOptOut) return;
    scene.traverse((o) => {
      if (o.isPointLight && o.position.y > 2.5) this.register(o);
      if (o.userData && o.userData.__nightGlow) this.glows.push(o);
    });
    const spots = scene.userData.__lampSpots;
    if (spots && spots.length) {
      this._spots = spots.map((s) => new THREE.Vector3(s.x, s.y, s.z));
      this._pool = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const l = new THREE.PointLight(0xffe2a8, 0, POOL_RANGE, 1.6);
        l.userData.__streetPool = true;
        this._pool.push(l);
      }
    }
  },

  clear() {
    if (this._pool && this._poolIn && this._scene) for (const l of this._pool) this._scene.remove(l);
    this.lamps.length = 0;
    this.glows.length = 0;
    this._spots = null; this._pool = null; this._poolIn = false;
    this.on = false;
  },

  /* amount: 0 by day, 1 from ~19:00 to ~05:00, ramps 17-19 and 5-7 */
  amount(hour) {
    return Math.max(0, Math.min(1, smoothstep(17, 19, hour) + (1 - smoothstep(5, 7, hour))));
  },

  tick(hour) {
    const amount = this.amount(hour);
    for (const l of this.lamps) l.light.intensity = l.base * amount;
    this.on = amount > 0.5;
    for (const g of this.glows) { if (g.userData.setNight) g.userData.setNight(amount); }

    if (!this._pool || !this._scene) return;
    /* add the pool only while it is needed: the shader recompile happens
       twice a day, not every frame, and daytime frames pay for no extra lights */
    if (amount > 0.02 && !this._poolIn) {
      for (const l of this._pool) this._scene.add(l);
      this._poolIn = true;
    } else if (amount <= 0.02 && this._poolIn) {
      for (const l of this._pool) this._scene.remove(l);
      this._poolIn = false;
    }
    if (!this._poolIn || !this._camera) return;

    const cp = this._camera.position, spots = this._spots;
    const best = [];                      /* nearest POOL_SIZE spots to the camera */
    for (let i = 0; i < spots.length; i++) {
      const dx = spots[i].x - cp.x, dz = spots[i].z - cp.z, d = dx * dx + dz * dz;
      if (best.length < POOL_SIZE) { best.push({ i, d }); best.sort((a, b) => a.d - b.d); }
      else if (d < best[best.length - 1].d) { best[best.length - 1] = { i, d }; best.sort((a, b) => a.d - b.d); }
    }
    for (let k = 0; k < this._pool.length; k++) {
      const l = this._pool[k], b = best[k];
      if (!b) { l.intensity = 0; continue; }
      l.position.copy(spots[b.i]);
      l.position.y -= 0.4;
      l.intensity = POOL_INTENSITY * amount;
    }
  },
};

if (typeof window !== "undefined") window.__ph3d_streetLights = StreetLights;
