/* ============================================================
   DayNight - 24-hour cycle for the city + world scenes.
   Advances in real time. Palette returns the current sky/sun.
   ============================================================ */
export const DayNight = {
  hour: 8,
  speed: 24 / 180,   /* full 24h cycle in 180 real seconds */

  tick(dt) {
    this.hour += this.speed * dt;
    if (this.hour >= 24) this.hour -= 24;
  },

  /* Returns interpolated colours + intensities for the current hour */
  palette() {
    const h = this.hour;
    /* Keypoints: 0 = midnight, 6 = sunrise, 12 = noon, 18 = sunset, 24 = midnight */
    if (h < 5)   return this._blend(this.KP.night, this.KP.night, 1);
    if (h < 7)   return this._blend(this.KP.night, this.KP.dawn, (h - 5) / 2);
    if (h < 9)   return this._blend(this.KP.dawn, this.KP.day, (h - 7) / 2);
    if (h < 16)  return this._blend(this.KP.day, this.KP.day, 1);
    if (h < 18)  return this._blend(this.KP.day, this.KP.dusk, (h - 16) / 2);
    if (h < 20)  return this._blend(this.KP.dusk, this.KP.night, (h - 18) / 2);
    return this._blend(this.KP.night, this.KP.night, 1);
  },

  KP: {
    night: {
      skyTop: 0x060a18, skyBot: 0x0d1420, fogColor: 0x0a0d16,
      sunColor: 0x2a3550, sunInt: 0.15,
      hemiSky: 0x2a3550, hemiGround: 0x0a0d16, hemiInt: 0.35,
    },
    dawn: {
      skyTop: 0x1a3560, skyBot: 0xff9c60, fogColor: 0xd4805c,
      sunColor: 0xffb070, sunInt: 1.2,
      hemiSky: 0xc0d0f0, hemiGround: 0x4a3020, hemiInt: 0.7,
    },
    day: {
      skyTop: 0x1a5fa8, skyBot: 0xcfe8fa, fogColor: 0x9dc4e8,
      sunColor: 0xfff0d2, sunInt: 2.6,
      hemiSky: 0xcfe6ff, hemiGround: 0x3a5a3a, hemiInt: 1.15,
    },
    dusk: {
      skyTop: 0x3a2244, skyBot: 0xff7040, fogColor: 0xd06a30,
      sunColor: 0xff8050, sunInt: 1.0,
      hemiSky: 0x8050a0, hemiGround: 0x3a2010, hemiInt: 0.6,
    },
  },

  _lerp(a, b, t) { return a + (b - a) * t; },
  _lerpColor(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(this._lerp(ar, br, t));
    const g = Math.round(this._lerp(ag, bg, t));
    const bl = Math.round(this._lerp(ab, bb, t));
    return (r << 16) | (g << 8) | bl;
  },
  _blend(a, b, t) {
    return {
      skyTop:      this._lerpColor(a.skyTop, b.skyTop, t),
      skyBot:      this._lerpColor(a.skyBot, b.skyBot, t),
      fogColor:    this._lerpColor(a.fogColor, b.fogColor, t),
      sunColor:    this._lerpColor(a.sunColor, b.sunColor, t),
      sunInt:      this._lerp(a.sunInt, b.sunInt, t),
      hemiSky:     this._lerpColor(a.hemiSky, b.hemiSky, t),
      hemiGround:  this._lerpColor(a.hemiGround, b.hemiGround, t),
      hemiInt:     this._lerp(a.hemiInt, b.hemiInt, t),
    };
  },

  label() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    const ampm = h < 12 ? "AM" : "PM";
    const hh = ((h + 11) % 12) + 1;
    return hh + ":" + String(m).padStart(2, "0") + " " + ampm;
  },
};

