/* js/core/weather.js — SEASONS + LIVE WEATHER for the open world.
   Nigerian climate calendar (auto, from the real date):
     Nov–Feb  HARMATTAN  dry dusty trade wind, golden-brown haze, cool mornings
     Mar–Apr  SUMMER     hot dry heat, bright white sun, clear sky, heat shimmer
     May–Oct  RAINY      grey sky, falling rain, wet ground, thunder flashes
   The player can lock any season from the phone's Weather app ("auto" follows the date). */
import * as THREE from "three";

const SEASONS = {
  summer: {
    id: "summer", label: "Summer", icon: "☀️", cond: "Hot & sunny",
    sky: 0x7fc4f5, fog: 0xf2ead2, fogNear: 420, fogFar: 1500, domeTint: 0xffffff,
    sunColor: 0xfff4d0, sunMul: 1.18, hemiMul: 1.08, ambMul: 1.0,
    temp: [29, 37], humidity: 48, wind: 8, walkMul: 1.0, rain: 0, dust: 0, shimmer: 1,
    blurb: "Dry heat. Clear skies, strong sun. Stay hydrated.",
  },
  harmattan: {
    id: "harmattan", label: "Harmattan", icon: "🌫️", cond: "Light haze",
    sky: 0xb9c4cc, fog: 0xcfd5d8, fogNear: 160, fogFar: 900, domeTint: 0xf2f4f6,
    sunColor: 0xfff6e6, sunMul: 0.95, hemiMul: 0.97, ambMul: 1.0,
    temp: [16, 30], humidity: 22, wind: 24, walkMul: 1.0, rain: 0, dust: 0, shimmer: 0,
    blurb: "Dry trade wind. Light haze. Cold mornings, warm afternoons.",
  },
  rainy: {
    id: "rainy", label: "Rainy Season", icon: "🌧️", cond: "Heavy rain",
    sky: 0x6f7d8c, fog: 0x7d8b99, fogNear: 60, fogFar: 640, domeTint: 0x9aa7b5,
    sunColor: 0xc9d6e4, sunMul: 0.45, hemiMul: 0.78, ambMul: 1.15,
    temp: [22, 28], humidity: 92, wind: 18, walkMul: 0.93, rain: 1, dust: 0, shimmer: 0,
    blurb: "Heavy showers and thunder. Wet ground — move carefully.",
  },
};
const ORDER = ["summer", "harmattan", "rainy"];

function seasonForDate(d) {
  const m = (d || new Date()).getMonth();           /* 0 = Jan */
  if (m >= 10 || m <= 1) return "harmattan";       /* Nov, Dec, Jan, Feb */
  if (m <= 3) return "summer";                      /* Mar, Apr */
  return "rainy";                                   /* May – Oct */
}

const RAIN_N = 1100, DUST_N = 450;

export const Weather = {
  SEASONS, ORDER,
  mode: "auto",                 /* "auto" | "summer" | "harmattan" | "rainy" */
  season: "summer",
  walkMul: 1,
  _ctx: null, _k: 1, _flash: 0, _nextFlash: 8, _t: 0,

  current() { return SEASONS[this.season]; },
  autoSeason() { return seasonForDate(new Date()); },

  /* Called once by the drive scene with the scene, camera and its lights/sky materials. */
  mount(three, camera, parts) {
    this.unmount();
    this._load();
    const c = this._ctx = {
      three, camera, sun: parts.sun, hemi: parts.hemi, amb: parts.amb,
      skyMats: parts.skyMats || [],
      base: {
        bg: three.background && three.background.clone(), fog: three.fog && three.fog.color.clone(),
        near: three.fog && three.fog.near, far: three.fog && three.fog.far,
        sun: parts.sun.intensity, sunCol: parts.sun.color.clone(),
        hemi: parts.hemi.intensity, amb: parts.amb ? parts.amb.intensity : 0.18,
      },
      rain: null, dust: null,
    };
    /* rain streaks (line segments) */
    const rg = new THREE.BufferGeometry();
    const rp = new Float32Array(RAIN_N * 6), rv = new Float32Array(RAIN_N);
    for (let i = 0; i < RAIN_N; i++) {
      const x = (Math.random() - 0.5) * 70, y = Math.random() * 40, z = (Math.random() - 0.5) * 70;
      rp.set([x, y, z, x, y - 1.1, z], i * 6); rv[i] = 26 + Math.random() * 14;
    }
    rg.setAttribute("position", new THREE.BufferAttribute(rp, 3));
    const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xcfe0f2, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    rain.frustumCulled = false; rain.visible = false; rain.userData.v = rv; three.add(rain); c.rain = rain;
    /* dust motes (points) */
    const dg = new THREE.BufferGeometry();
    const dp = new Float32Array(DUST_N * 3);
    for (let i = 0; i < DUST_N; i++) dp.set([(Math.random() - 0.5) * 80, Math.random() * 18, (Math.random() - 0.5) * 80], i * 3);
    dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xe9cf9c, size: 0.28, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    dust.frustumCulled = false; dust.visible = false; three.add(dust); c.dust = dust;
    this._k = 0;
    this.apply(true);
  },

  unmount() {
    const c = this._ctx; if (!c) return;
    try { c.three.remove(c.rain); c.three.remove(c.dust); c.rain.geometry.dispose(); c.dust.geometry.dispose(); } catch (e) {}
    try { window.__ph3d_sfx && window.__ph3d_sfx.stop("ambient_rain_loop"); } catch (e) {}
    this._ctx = null;
  },

  setMode(m) {
    if (m !== "auto" && !SEASONS[m]) return;
    this.mode = m;
    try { localStorage.setItem("ph3d_season", m); } catch (e) {}
    this._k = 0; this.apply(false);
    try { window.__ph3d_phone && window.__ph3d_phone._toast(SEASONS[this.season].icon + " " + SEASONS[this.season].label); } catch (e) {}
  },

  /* push the chosen season's look into the scene */
  apply(instant) {
    this.season = this.mode === "auto" ? this.autoSeason() : this.mode;
    const S = SEASONS[this.season], c = this._ctx; if (!c) return;
    this.walkMul = S.walkMul;
    c.target = S;
    if (c.rain) c.rain.visible = !!S.rain;
    if (c.dust) c.dust.visible = !!S.dust;
    try {
      const sfx = window.__ph3d_sfx;
      if (sfx) { if (S.rain) sfx.loop("ambient_rain_loop"); else sfx.stop("ambient_rain_loop"); }
    } catch (e) {}
    if (instant) { this._k = 1; this._blend(1); }
  },

  _blend(k) {
    const c = this._ctx, S = c && c.target; if (!c || !S) return;
    const B = c.base, tmp = new THREE.Color();
    if (c.three.fog) {
      c.three.fog.color.copy(B.fog).lerp(tmp.set(S.fog), k);
      c.three.fog.near = B.near + (S.fogNear - B.near) * k;
      c.three.fog.far = B.far + (S.fogFar - B.far) * k;
    }
    if (c.three.background) c.three.background.copy(B.bg).lerp(tmp.set(S.fog), k);
    c.sun.intensity = B.sun * (1 + (S.sunMul - 1) * k);
    c.sun.color.copy(B.sunCol).lerp(tmp.set(S.sunColor), k);
    c.hemi.intensity = B.hemi * (1 + (S.hemiMul - 1) * k);
    if (c.amb) c.amb.intensity = B.amb * (1 + (S.ambMul - 1) * k);
    for (const m of c.skyMats) m.color.set(0xffffff).lerp(tmp.set(S.domeTint), k);
  },

  /* 0..1 temperature curve through the day (peak ≈ 15:00) */
  _tempNow() {
    const S = this.current(), h = (window.__ph3d_daynight && window.__ph3d_daynight.hour) || 12;
    const f = Math.max(0, Math.cos(((h - 15) / 24) * Math.PI * 2)) * 0.5 + Math.cos(((h - 15) / 24) * Math.PI * 2) * 0.5;
    const k = Math.max(0, Math.min(1, (Math.cos(((h - 15) / 24) * Math.PI * 2) + 1) / 2));
    return Math.round(S.temp[0] + (S.temp[1] - S.temp[0]) * k);
  },

  /* for the phone Weather app */
  _load() {
    if (this._loaded) return; this._loaded = true;
    try { const m = localStorage.getItem("ph3d_season"); if (m === "auto" || SEASONS[m]) this.mode = m; } catch (e) {}
    this.season = this.mode === "auto" ? this.autoSeason() : this.mode;
    this.walkMul = SEASONS[this.season].walkMul;
  },

  info() {
    this._load();
    const S = this.current();
    return {
      season: S, temp: this._tempNow(), humidity: S.humidity, wind: S.wind,
      cond: S.cond, mode: this.mode, auto: this.autoSeason(),
    };
  },

  tick(dt) {
    const c = this._ctx; if (!c) return;
    this._t += dt;
    if (this._k < 1) { this._k = Math.min(1, this._k + dt * 0.6); this._blend(this._k); }
    const S = c.target, cam = c.camera;
    if (!S) return;
    /* RAIN: streaks fall around the camera and wrap */
    if (S.rain && c.rain) {
      const g = c.rain.geometry, p = g.attributes.position.array, v = c.rain.userData.v;
      c.rain.position.set(cam.position.x, cam.position.y - 6, cam.position.z);
      for (let i = 0; i < RAIN_N; i++) {
        const o = i * 6, d = v[i] * dt;
        p[o + 1] -= d; p[o + 4] -= d; p[o] -= 3 * dt; p[o + 3] -= 3 * dt;
        if (p[o + 1] < -6) {
          const x = (Math.random() - 0.5) * 70, z = (Math.random() - 0.5) * 70, y = 28 + Math.random() * 10;
          p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x - 0.15; p[o + 4] = y - 1.1; p[o + 5] = z;
        }
      }
      g.attributes.position.needsUpdate = true;
      /* thunder: brief white flash of the whole scene */
      this._nextFlash -= dt;
      if (this._nextFlash <= 0) { this._flash = 0.35; this._nextFlash = 9 + Math.random() * 14; }
      if (this._flash > 0) {
        this._flash -= dt;
        const f = Math.max(0, this._flash / 0.35), B = c.base;
        c.hemi.intensity = B.hemi * S.hemiMul + 2.2 * f * (Math.sin(this._t * 60) > -0.3 ? 1 : 0.3);
      } else c.hemi.intensity = c.base.hemi * S.hemiMul;
    }
    /* HARMATTAN dust drifting in the wind */
    if (S.dust && c.dust) {
      const g = c.dust.geometry, p = g.attributes.position.array;
      c.dust.position.set(cam.position.x, cam.position.y - 3, cam.position.z);
      for (let i = 0; i < DUST_N; i++) {
        const o = i * 3;
        p[o] += (6 + Math.sin(this._t + i) * 2) * dt; p[o + 1] += Math.sin(this._t * 0.7 + i * 1.3) * 0.4 * dt;
        if (p[o] > 40) p[o] = -40;
      }
      g.attributes.position.needsUpdate = true;
    }
  },
};
if (typeof window !== "undefined") window.__ph3d_weather = Weather;
