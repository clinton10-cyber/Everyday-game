/* ============================================================
   DayNight - REAL-TIME clock + moon + stars + night lighting.
   - hour follows the device's wall clock (0.0 .. 24.0).
     Set DayNight.realTime = false and DayNight.speed (hours per
     real second) for an accelerated clock, or DayNight.manualHour
     to pin the hour (handy for testing: __ph3d_daynight.manualHour = 2).
   - On OUTDOOR scenes it adds a star field + moon, tints the sky
     background / fog / sky domes, and scales the scene's own sun,
     hemisphere and ambient lights.
   - It blends *from the scene's own look*, so by day nothing changes,
     and it reads Weather's current tint so rain / harmattan still work.
   - Calls StreetLights.tick(hour) each frame (lamps on at dusk).
   Scenes can opt out with  scene.userData.__dnOptOut = true.
   ============================================================ */
import * as THREE from "three";

/* Routes that are always outdoors. */
const OPEN_ROUTES = new Set([
  "city", "drive", "walk", "zonewalk", "zonedrive", "minimap", "pleasurepark",
  "governorScene", "exterior",
]);
/* Places that load through the "interior" route (cur.isInterior is true for
   them) but are really open-air: they get the sky, moon and night lighting.
   Enclosed buildings (church, hospital, house, hotel, airport terminal ...)
   are NOT listed, so they keep their own lighting. "travel" is left out on
   purpose: it is already a stylised night-ride scene. */
const OPEN_PLACES = new Set([
  "university", "beach", "boropark", "citypark", "forest",
  "market", "village", "zoo", "vastcity", "vatican", "airport", "govhouse",
]);
function isOpenScene(cur) {
  const route = cur._routeName || "";
  if (OPEN_ROUTES.has(route)) return true;
  return route === "interior" && OPEN_PLACES.has(cur.sceneId);
}

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(lerp(ar, br, t)) << 16) |
         (Math.round(lerp(ag, bg, t)) << 8) |
          Math.round(lerp(ab, bb, t));
}

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _tint = new THREE.Color();

export const DayNight = {
  hour: 8,              /* 0 = midnight, 12 = noon */
  speed: 0,             /* hours per real second, only used when realTime is false */
  realTime: true,
  manualHour: null,

  _sky: null,           /* { group, stars, moon, moonGlow, camFar } */
  _scene: null,

  KP: {
    night: {
      skyTop: 0x0a1830, skyBot: 0x152640, fogColor: 0x0e1a2e,
      sunColor: 0x8899cc, sunInt: 0.55,
      hemiSky: 0x2a3a5a, hemiGround: 0x0a1018, hemiInt: 0.80,
    },
    dawn: {
      skyTop: 0x1a3560, skyBot: 0xff9c60, fogColor: 0xd4805c,
      sunColor: 0xffb070, sunInt: 1.2,
      hemiSky: 0xc0d0f0, hemiGround: 0x4a3020, hemiInt: 0.85,
    },
    day: {
      skyTop: 0x1a5fa8, skyBot: 0xcfe8fa, fogColor: 0x9dc4e8,
      sunColor: 0xfff0d2, sunInt: 2.6,
      hemiSky: 0xcfe6ff, hemiGround: 0x3a5a3a, hemiInt: 1.15,
    },
    dusk: {
      skyTop: 0x3a2244, skyBot: 0xff7040, fogColor: 0xd06a30,
      sunColor: 0xff8050, sunInt: 1.0,
      hemiSky: 0x8050a0, hemiGround: 0x3a2010, hemiInt: 0.85,
    },
  },

  /* ======================================================== */
  tick(dt) {
    if (this.manualHour != null) {
      this.hour = this.manualHour;
    } else if (this.realTime) {
      const n = new Date();
      this.hour = n.getHours() + n.getMinutes() / 60 +
                  n.getSeconds() / 3600 + n.getMilliseconds() / 3600000;
    } else {
      this.hour += this.speed * dt;
      while (this.hour >= 24) this.hour -= 24;
      while (this.hour < 0) this.hour += 24;
    }
    try { this._paint(); } catch (e) { if (!this._warned) { this._warned = true; console.warn("[daynight]", e); } }
    const S = window.__ph3d_streetLights;
    if (S && S.tick) { try { S.tick(this.hour); } catch (e) {} }
  },

  /* 0 = full day, 1 = full night, smooth dawn/dusk */
  nightAmount() {
    const h = this.hour;
    if (h >= 19 || h < 5) return 1;
    if (h >= 17) return smoothstep(17, 19, h);
    if (h >= 5 && h < 7) return 1 - smoothstep(5, 7, h);
    return 0;
  },

  /* ------------- palette helpers (API unchanged) ------------- */
  palette() {
    const h = this.hour;
    if (h < 5)  return this._blend(this.KP.night, this.KP.night, 1);
    if (h < 7)  return this._blend(this.KP.night, this.KP.dawn,  (h - 5) / 2);
    if (h < 9)  return this._blend(this.KP.dawn,  this.KP.day,   (h - 7) / 2);
    if (h < 16) return this._blend(this.KP.day,   this.KP.day,   1);
    if (h < 18) return this._blend(this.KP.day,   this.KP.dusk,  (h - 16) / 2);
    if (h < 20) return this._blend(this.KP.dusk,  this.KP.night, (h - 18) / 2);
    return this._blend(this.KP.night, this.KP.night, 1);
  },
  _lerp: lerp,
  _lerpColor: lerpColor,
  _blend(a, b, t) {
    return {
      skyTop:     lerpColor(a.skyTop,     b.skyTop,     t),
      skyBot:     lerpColor(a.skyBot,     b.skyBot,     t),
      fogColor:   lerpColor(a.fogColor,   b.fogColor,   t),
      sunColor:   lerpColor(a.sunColor,   b.sunColor,   t),
      sunInt:     lerp(a.sunInt,  b.sunInt,  t),
      hemiSky:    lerpColor(a.hemiSky,    b.hemiSky,    t),
      hemiGround: lerpColor(a.hemiGround, b.hemiGround, t),
      hemiInt:    lerp(a.hemiInt, b.hemiInt, t),
    };
  },
  label() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return (((h + 11) % 12) + 1) + ":" + String(m).padStart(2, "0") + (h < 12 ? " AM" : " PM");
  },

  /* ======================================================== */
  /* Weather (rain / harmattan) blends the scene's sky + lights on its own.
     Read its current state so we layer on top of it instead of undoing it. */
  _wx(scene) {
    const W = window.__ph3d_weather, c = W && W._ctx;
    if (!c || c.three !== scene || !c.target) return null;
    return { c, S: c.target, k: W._k == null ? 1 : W._k };
  },

  _paint() {
    const router = window.__ph3d_router;
    if (!router || !router.current) return;
    const cur = router.current;
    const scene = cur.three;
    if (!scene || !isOpenScene(cur)) return;
    if (scene.userData.__dnOptOut) return;

    if (scene !== this._scene) {
      this._scene = scene;
      this._buildSky(scene, cur.camera);
      const SL = window.__ph3d_streetLights;
      if (SL && SL.autoFromScene) SL.autoFromScene(scene, cur.camera);
    }

    const pal = this.palette();
    const night = this.nightAmount();
    /* 0 by day (scene looks exactly as authored) .. 1 at dusk/night */
    const w = clamp01(1 - (pal.sunInt - 1.0) / 1.6);
    const wx = this._wx(scene);

    /* ---- moon + stars ---- */
    const cam = cur.camera, sky = this._sky;
    if (sky && cam) {
      sky.group.position.copy(cam.position);
      sky.stars.rotation.y += 0.00015;
      sky.stars.material.opacity = smoothstep(0.35, 0.85, night) * 0.95;

      /* moon rises on the -x side at 18:00, peaks 00:00, sets on the +x side at 06:00 */
      let mh = this.hour; if (mh < 18) mh += 24;
      const a = ((mh - 18) / 12) * Math.PI;
      const dist = sky.dist;
      sky.moon.position.set(-Math.cos(a) * dist,
                            Math.sin(a) * dist * 0.7 + dist * 0.05,
                            -dist * 0.55);
      sky.moonGlow.position.copy(sky.moon.position);
      const vis = smoothstep(0.3, 0.75, night);
      sky.moon.material.opacity = vis;
      sky.moonGlow.material.opacity = vis * 0.28;
      sky.group.visible = vis > 0.001 || sky.stars.material.opacity > 0.001;
    }

    /* ---- background + fog: scene's own colour -> night/dusk colour ---- */
    const U = scene.userData;
    if (!U.__dnBase) {
      U.__dnBase = {
        bg:  scene.background && scene.background.isColor ? scene.background.clone() : null,
        fog: scene.fog && scene.fog.color ? scene.fog.color.clone() : null,
      };
    }
    const tgt = _c2.setHex(pal.fogColor);
    const baseCol = (stored, wxBase) => {
      _c.copy(wxBase || stored);
      if (wx && wxBase) _c.lerp(_c2.clone().setHex(wx.S.fog), wx.k);
      return _c;
    };
    if (scene.background && scene.background.isColor && U.__dnBase.bg) {
      scene.background.copy(baseCol(U.__dnBase.bg, wx && wx.c.base.bg)).lerp(tgt, w);
    }
    if (scene.fog && scene.fog.color && U.__dnBase.fog) {
      scene.fog.color.copy(baseCol(U.__dnBase.fog, wx && wx.c.base.fog)).lerp(tgt, w);
    }

    /* ---- sky domes: every big inside-out sphere (any scene) gets tinted ---- */
    {
      const warm = _c2.setHex(pal.fogColor).multiplyScalar(1.25);
      warm.r = Math.min(1, warm.r); warm.g = Math.min(1, warm.g); warm.b = Math.min(1, warm.b);
      const mix = _tint.set(0xffffff).lerp(warm, w);
      const wxMats = wx && wx.c.skyMats ? wx.c.skyMats : null;
      for (const d of this._getDomes(scene)) {
        const isWx = wxMats && wxMats.indexOf(d.mat) >= 0;
        for (const t of d.targets) {
          if (isWx && t.isColorProp) {                     /* Weather owns these: layer on its tint */
            t.col.copy(_c.set(0xffffff).lerp(_c2.setHex(wx.S.domeTint), wx.k)).multiply(mix);
          } else {
            t.col.copy(t.base).multiply(mix);
          }
        }
      }
    }

    /* ---- scene lights ---- */
    const L = this._getSceneLights(scene);
    const sunF = pal.sunInt / 2.6;
    const hemiF = pal.hemiInt / 1.15;
    const ambF = 0.65 + 0.35 * sunF;      /* ambient never drops to 0 */
    const mulOf = (light, kind) => {
      if (!wx) return { base: null, mul: 1 };
      const c = wx.c, S = wx.S, k = wx.k;
      if (kind === "sun"  && light === c.sun)  return { base: c.base.sun,  mul: 1 + (S.sunMul  - 1) * k };
      if (kind === "hemi" && light === c.hemi) return { base: c.base.hemi, mul: 1 + (S.hemiMul - 1) * k };
      if (kind === "amb"  && light === c.amb)  return { base: c.base.amb,  mul: 1 + (S.ambMul  - 1) * k };
      return { base: null, mul: 1 };
    };
    for (const e of L.dir) {
      const m = mulOf(e.light, "sun");
      e.light.intensity = (m.base != null ? m.base : e.base) * m.mul * sunF;
      if (e.main) {                                   /* only recolour the key light */
        _c.copy(e.color);
        if (m.base != null) _c.lerp(_c2.clone().setHex(wx.S.sunColor), wx.k);
        e.light.color.copy(_c).lerp(_c2.setHex(pal.sunColor), w);
      }
    }
    for (const e of L.hemi) {
      const m = mulOf(e.light, "hemi");
      e.light.intensity = (m.base != null ? m.base : e.base) * m.mul * hemiF;
      e.light.color.copy(e.color).lerp(_c2.setHex(pal.hemiSky), w);
      if (e.light.groundColor && e.ground) e.light.groundColor.copy(e.ground).lerp(_c2.setHex(pal.hemiGround), w);
    }
    for (const e of L.amb) {
      const m = mulOf(e.light, "amb");
      e.light.intensity = (m.base != null ? m.base : e.base) * m.mul * ambF;
    }
  },

  /* cache lights + their authored values once per scene */
  _getSceneLights(scene) {
    if (scene.userData.__dnLights) return scene.userData.__dnLights;
    const dir = [], hemi = [], amb = [];
    scene.traverse((o) => {
      if (o.isDirectionalLight && o.position.y > 8) dir.push({ light: o, base: o.intensity, color: o.color.clone(), main: false });
      else if (o.isHemisphereLight) hemi.push({ light: o, base: o.intensity, color: o.color.clone(), ground: o.groundColor ? o.groundColor.clone() : null });
      else if (o.isAmbientLight)    amb.push({ light: o, base: o.intensity });
    });
    let best = null;
    for (const e of dir) if (!best || e.base > best.base) best = e;
    if (best) best.main = true;
    const L = { dir, hemi, amb };
    scene.userData.__dnLights = L;
    return L;
  },

  /* find the scene's sky domes once: big inside-out spheres. Handles plain
     materials (.color) and shader skies (any Color uniform, e.g. topColor). */
  _getDomes(scene) {
    if (scene.userData.__dnDomes) return scene.userData.__dnDomes;
    const out = [];
    scene.traverse((o) => {
      if (!o.isMesh || o.name === "__nightSky" || (o.parent && o.parent.name === "__nightSky")) return;
      const g = o.geometry, m = o.material;
      if (!g || g.type !== "SphereGeometry" || !m || Array.isArray(m)) return;
      if (m.side !== THREE.BackSide || !g.parameters || g.parameters.radius < 150) return;
      const targets = [];
      if (m.isShaderMaterial && m.uniforms) {
        for (const k in m.uniforms) {
          const v = m.uniforms[k].value;
          if (v && v.isColor) targets.push({ col: v, base: v.clone(), isColorProp: false });
        }
      } else if (m.color) {
        targets.push({ col: m.color, base: m.color.clone(), isColorProp: true });
      }
      if (targets.length) out.push({ mat: m, radius: g.parameters.radius, targets });
    });
    scene.userData.__dnDomes = out;
    return out;
  },

  /* ======================================================== */
  _buildSky(scene, camera) {
    const old = this._sky;
    if (old) {
      if (old.group.parent) old.group.parent.remove(old.group);
      old.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    const far = (camera && camera.far > 200) ? camera.far : 1600;
    /* keep stars + moon INSIDE the smallest sky dome, or the dome hides them */
    let cap = Infinity;
    for (const d of this._getDomes(scene)) if (d.radius < cap) cap = d.radius;
    const starR = Math.min(far * 0.45, 900, cap * 0.85);
    const dist = Math.min(far * 0.6, cap * 0.85);

    const group = new THREE.Group();
    group.name = "__nightSky";
    group.userData.isNightSky = true;
    group.visible = false;

    const N = 1200;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = starR * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(starR * Math.cos(ph)) * 0.8 + starR * 0.03;   /* upper hemisphere only */
      pos[i * 3 + 2] = starR * Math.sin(ph) * Math.sin(th);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xffffff, size: 2, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    stars.frustumCulled = false;
    stars.renderOrder = -900;
    group.add(stars);

    const mr = dist * 0.04;                         /* ~2.3 degrees across, like a big moon */
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(mr, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xf4f0dc, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    moon.frustumCulled = false; moon.renderOrder = -899;
    group.add(moon);

    const moonGlow = new THREE.Mesh(
      new THREE.SphereGeometry(mr * 1.7, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    moonGlow.frustumCulled = false; moonGlow.renderOrder = -898;
    group.add(moonGlow);

    scene.add(group);
    this._sky = { group, stars, moon, moonGlow, dist };
  },
};
