/* js/core/audio.js -- living ambience engine (replaces the old music themes).

   No music tracks any more. The world is built from the Sound pack's
   ambience beds, layered and crossfaded by place, plus random one-shot
   "life" sounds (doors, bells, phones, cheers, tannoy...) panned around you.

   Beds (assets/audio/ambience/*.wav, seamless loops):
     yard  crowd  hall  quiet  canteen  bathroom

   Moods -> ONE bed per scene (never layered, so a scene has a single ambient style):
     open     yard   (a touch quieter at night)
     chase    crowd, alarm / buzzer / tannoy events
     indoor   hall
     lively   canteen (hotel / mansion / showroom / nightclub)
     prison   hall, doors / buzzers / jeers
     quiet    quiet (church, mosque, library, classroom...)
     bath     bathroom
     range    yard + echoing shots

   Public API (unchanged): init, startAmbient, stopAmbient, setScene,
   toggleMute, nextTrack, setMusicVolume(0..1), mood.   New: setRain(bool), life(). */

const DIR = "assets/audio/";
const BEDS = ["yard", "crowd", "hall", "quiet", "canteen", "bathroom"];

/* bed gains per mood (0..1) */
const MIX = {
  open:   { yard: 0.80 },
  chase:  { crowd: 0.55 },
  indoor: { hall: 0.70 },
  lively: { canteen: 0.75 },
  prison: { hall: 0.65 },
  quiet:  { quiet: 0.85 },
  bath:   { bathroom: 0.80 },
  range:  { yard: 0.55 },
};

/* one-shot life events per mood: [sfx key, volume, weight, rate?] */
const LIFE = {
  open: [
    ["bell", .30, 1], ["tannoy", .22, 1], ["phone_ring", .22, 2], ["world_door", .35, 3],
    ["cheer", .20, 1], ["basket", .30, 1], ["ball_bounce", .35, 2], ["bottle", .30, 2],
    ["trash", .30, 2], ["metal_clang", .25, 2], ["cane_tap", .25, 1], ["rock_knock", .22, 1],
    ["buzzer", .18, 1], ["door_knock", .25, 1], ["jeer", .14, 1], ["step_shuffle", .30, 2],
  ],
  chase: [
    ["alarm", .35, 3], ["buzzer", .30, 2], ["tannoy", .30, 2], ["metal_clang", .30, 2],
    ["ricochet", .25, 2], ["gunshot_pistol", .18, 1], ["police_whistle", .30, 2], ["world_door", .30, 2],
  ],
  indoor: [
    ["world_door", .35, 3], ["paper", .30, 3], ["computer_click", .35, 2], ["phone_ring", .28, 2],
    ["step_shuffle", .30, 3], ["trash", .22, 1], ["cane_tap", .22, 1], ["tannoy", .20, 1],
    ["bell", .20, 1], ["door_knock", .30, 1], ["metal_clang", .18, 1], ["phone_buzz", .25, 1],
  ],
  lively: [
    ["cheer", .30, 3], ["jeer", .18, 1], ["bottle", .35, 3], ["drink", .25, 2], ["cash", .28, 2],
    ["cigar", .20, 1], ["ball_bounce", .22, 1], ["basket", .22, 1], ["phone_ring", .20, 1],
    ["world_door", .25, 1], ["step_shuffle", .25, 2],
  ],
  prison: [
    ["world_door", .40, 3], ["buzzer", .35, 2], ["tannoy", .30, 2], ["metal_clang", .40, 3],
    ["jeer", .25, 2], ["cheer", .16, 1], ["alarm", .20, 1], ["step_shuffle", .30, 2],
    ["snore", .25, 1], ["cane_tap", .22, 1],
  ],
  quiet: [
    ["step_shuffle", .20, 3], ["paper", .22, 3], ["cane_tap", .18, 2], ["door_knock", .14, 1],
    ["bell", .16, 1], ["world_door", .18, 1],
  ],
  bath: [
    ["water_running", .30, 3], ["world_door", .20, 1], ["metal_clang", .18, 1], ["toilet_flush", .20, 1],
  ],
  range: [
    ["gunshot_pistol", .22, 3], ["gunshot_sniper", .18, 1], ["ricochet", .25, 2], ["reload_click", .20, 2],
    ["metal_clang", .25, 2], ["buzzer", .18, 1],
  ],
};

const OPEN_SCENES = new Set(["city", "drive", "walk", "zonewalk", "zonedrive", "travel", "pleasurepark", "exterior"]);
const QUIET_IDS   = /church|mosque|vatican|classroom|computerlab|library|lecture|medical|hospital|airplane/i;
const PRISON_IDS  = /prison|jail/i;
const LIVELY_IDS  = /hotel|mansion|showroom|nightclub|restaurant|canteen|bar\b|club|market/i;
const BATH_IDS    = /bath|restroom|toilet|washroom/i;
const RANGE_IDS   = /range|shooting/i;

const FADE = 2.0;   /* seconds, bed crossfade */

function userVol() {
  try {
    const S = window.__ph3d_settings;
    const v = S && S.get ? S.get("musicVolume") : undefined;
    return v === undefined ? 0.3 : v;
  } catch (e) { return 0.3; }
}
function sfxVol() {
  try {
    const S = window.__ph3d_settings;
    const v = S && S.get ? S.get("sfxVolume") : undefined;
    return v === undefined ? 0.4 : v;
  } catch (e) { return 0.4; }
}

export const AudioSystem = {
  ctx: null, master: null,
  muted: false,

  _buf: {},          /* bed name -> AudioBuffer */
  _loading: {},      /* bed name -> Promise */
  _src: {},          /* bed name -> { node, gain } */
  _target: {},       /* bed name -> target gain */
  _cur: {},          /* bed name -> current gain */
  _mood: null,
  _scene: "city", _sceneObj: null,
  _started: false, _wanted: true,
  _userVol: null,
  _timer: null, _poll: null, _lifeT: null,
  _rain: false, _rainGain: null, _rainSrc: null, _rainT: null,
  _lifeBuf: {},      /* sfx file -> AudioBuffer (decoded on demand) */

  /* back-compat shims (settings / old callers) */
  get musicEl() { return null; },
  musicTracks: [{ id: "ambience", title: "Living ambience" }],
  get mood() { return this._mood; },

  init() {
    if (this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;   /* was 1 — ambience was too loud/noisy */
      this.master.connect(this.ctx.destination);
    } catch (e) { console.warn("[audio] WebAudio unavailable", e); }
    if (!this._poll) this._poll = setInterval(() => this._refresh(), 1000);
  },

  /* ── mood selection ─────────────────────────────────────── */
  _pickMood() {
    const name = this._scene, obj = this._sceneObj;
    const id = String((obj && obj.sceneId) || name || "");
    const pol = window.__ph3d_police, hunt = window.__ph3d_hunt;
    if (BATH_IDS.test(id)) return "bath";
    if (RANGE_IDS.test(id) || name === "range") return "range";
    if (PRISON_IDS.test(id)) return "prison";
    const open = OPEN_SCENES.has(name) || (obj && obj.allowMusic === true) || (obj && obj.isInterior === false);
    if (open) {
      if ((pol && pol.dispatched) || (hunt && hunt.active)) return "chase";
      return "open";
    }
    if (QUIET_IDS.test(id)) return "quiet";
    if (LIVELY_IDS.test(id)) return "lively";
    return "indoor";
  },

  /* ── buffers ────────────────────────────────────────────── */
  _decode(url) {
    return fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
      .then(ab => new Promise((res, rej) => { const p = this.ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); }));
  },
  _load(name) {
    if (this._buf[name]) return Promise.resolve(this._buf[name]);
    if (this._failed && this._failed[name]) return Promise.resolve(null);
    if (this._loading[name]) return this._loading[name];
    /* try the ambience wav first, then fall back to an sfx mp3 of the same name */
    const urls = [DIR + "ambience/" + name + ".wav", DIR + "sfx/" + name + ".mp3"];
    const attempt = (i) => this._decode(urls[i]).catch(e => (i + 1 < urls.length) ? attempt(i + 1) : Promise.reject(e));
    this._loading[name] = attempt(0)
      .then(b => { this._buf[name] = b; return b; })
      .catch(e => {
        /* remember the failure so we never retry (no console spam, no fetch loop) */
        (this._failed || (this._failed = {}))[name] = true;
        this._loading[name] = null;
        return null;
      });
    return this._loading[name];
  },
  _startBed(name) {
    if (this._src[name] || !this.ctx) return;
    const b = this._buf[name]; if (!b) { this._load(name).then(r => { if (r) this._refresh(); }); return; }
    const node = this.ctx.createBufferSource(); node.buffer = b; node.loop = true;
    node.loopStart = 0; node.loopEnd = b.duration;
    node.playbackRate.value = 1;
    const gain = this.ctx.createGain(); gain.gain.value = 0;
    node.connect(gain); gain.connect(this.master);
    /* start at a random offset so repeated visits never sound identical */
    try { node.start(0, Math.random() * b.duration); } catch (e) { return; }
    this._src[name] = { node, gain }; this._cur[name] = 0;
  },
  _stopBed(name) {
    const s = this._src[name]; if (!s) return;
    try { s.node.stop(); s.node.disconnect(); s.gain.disconnect(); } catch (e) {}
    delete this._src[name]; this._cur[name] = 0;
  },

  /* ── apply the chosen mood ──────────────────────────────── */
  _refresh() {
    if (!this._started || !this.ctx) return;
    if (this.ctx.state === "suspended") { try { this.ctx.resume(); } catch (e) {} }
    const want = (this._wanted && !this.muted) ? this._pickMood() : null;
    if (want !== this._mood) { this._mood = want; this._scheduleLife(true); }
    const mix = want ? this._mixFor(want) : {};
    for (const n of BEDS) this._target[n] = mix[n] || 0;
    for (const n of BEDS) {
      if (this._target[n] > 0) this._startBed(n);
    }
    if (!this._timer) this._timer = setInterval(() => this._tick(), 50);
  },

  _mixFor(mood) {
    const m = Object.assign({}, MIX[mood] || {});
    /* day / night: same single bed, just a little softer at night */
    try {
      const h = (window.__ph3d_daynight && window.__ph3d_daynight.hour);
      if (h != null && mood === "open" && (h >= 21 || h < 5)) m.yard *= 0.75;
    } catch (e) {}
    return m;
  },

  _tick() {
    const step = 0.05 / FADE;
    const master = this._userVol != null ? this._userVol : userVol();
    let busy = false;
    for (const n of BEDS) {
      const s = this._src[n];
      const tgt = this.muted ? 0 : (this._target[n] || 0) * master * 1.5;
      let v = this._cur[n] || 0;
      if (v < tgt) v = Math.min(tgt, v + step * 1.2); else if (v > tgt) v = Math.max(tgt, v - step * 1.2);
      this._cur[n] = v;
      if (s) { try { s.gain.gain.value = v; } catch (e) {} }
      if (s && v === 0 && tgt === 0) this._stopBed(n);
      if (Math.abs(v - tgt) > 0.001) busy = true;
    }
    if (this._rainGain) {
      const rt = (this._rain && !this.muted) ? 0.5 * master * 1.5 : 0;
      let rv = this._rainGain.gain.value;
      rv += Math.sign(rt - rv) * Math.min(Math.abs(rt - rv), step * 1.2);
      this._rainGain.gain.value = rv;
      if (Math.abs(rv - rt) > 0.001) busy = true;
      else if (rt === 0 && this._rainSrc) { try { this._rainSrc.stop(); } catch (e) {} this._rainSrc = null; this._rainGain = null; clearInterval(this._rainT); this._rainT = null; }
    }
    if (!busy) { clearInterval(this._timer); this._timer = null; }
  },

  /* ── life: random one-shots so the world is never still ──── */
  _scheduleLife(soon) {
    clearTimeout(this._lifeT);
    if (!this._started || !this._mood) return;
    const m = this._mood;
    const base = m === "chase" ? 2500 : m === "quiet" ? 9000 : m === "lively" || m === "open" ? 3500 : 5000;
    const wait = (soon ? 1200 : 0) + base * (0.5 + Math.random() * 1.4);
    this._lifeT = setTimeout(() => { this.life(); this._scheduleLife(false); }, wait);
  },

  life(mood) {
    const m = mood || this._mood; const list = LIFE[m];
    if (!list || this.muted || !this.ctx) return;
    let tot = 0; for (const e of list) tot += e[2];
    let r = Math.random() * tot, pick = list[0];
    for (const e of list) { r -= e[2]; if (r <= 0) { pick = e; break; } }
    let [key, vol] = pick;
    /* helpers that expand to a random variant */
    const R = (a) => a[Math.floor(Math.random() * a.length)];
    let file, rate = 0.9 + Math.random() * 0.25;
    switch (key) {
      case "world_door":   file = R(["world_door01", "world_door02", "world_door03"]); break;
      case "step_shuffle": file = R(["movement_shuffle01", "movement_shuffle02", "movement_shuffle03"]); rate = 1; break;
      case "paper":        file = "paper"; break;
      case "cash":         file = "cash"; break;
      case "drink":        file = "props_drink"; break;
      case "cigar":        file = "props_cigar"; break;
      case "computer_click": file = "computer"; break;
      case "phone_ring":   file = "world_ring"; break;
      case "phone_buzz":   file = "props_phone"; break;
      case "alarm":        file = "world_alarm"; break;
      case "buzzer":       file = "world_buzzer"; break;
      case "tannoy":       file = "world_tanoy"; break;
      case "bell":         file = "world_bell"; break;
      case "basket":       file = "world_basket"; break;
      case "ball_bounce":  file = "props_ball"; break;
      case "bottle":       file = "props_bottle"; break;
      case "trash":        file = "trash"; break;
      case "metal_clang":  file = "props_metal"; break;
      case "cane_tap":     file = "props_cane"; break;
      case "rock_knock":   file = "props_rock"; break;
      case "door_knock":   file = "props_wood"; break;
      case "cheer":        file = "cheer"; break;
      case "jeer":         file = "jeer"; break;
      case "snore":        file = "pain_snoring"; break;
      case "ricochet":     file = R(["props_ricochet01", "props_ricochet02", "props_ricochet03"]); break;
      case "gunshot_pistol": file = R(["props_shot01", "props_shot02"]); rate = 0.8; break;
      case "gunshot_sniper": file = "props_shot02"; rate = 0.7; break;
      case "police_whistle": file = "world_buzzer"; rate = 1.6; break;
      case "reload_click": file = "props_reload"; break;
      case "water_running": file = R(["movement_splash01", "props_splash"]); break;
      case "toilet_flush": file = "movement_splash02"; rate = 0.8; break;
      default: return;
    }
    this._oneShot(file, vol, rate);
  },

  /* decode-on-demand one-shot with a random stereo position and a touch of distance */
  _oneShot(file, vol, rate) {
    const url = DIR + "sfx/" + file + ".mp3";
    const play = (buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate || 1;
      const g = this.ctx.createGain(); g.gain.value = vol * sfxVol() * 0.6;
      let last = g;
      try {
        const pan = this.ctx.createStereoPanner(); pan.pan.value = (Math.random() * 2 - 1) * 0.85;
        const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400 + Math.random() * 5000;
        src.connect(lp); lp.connect(g); g.connect(pan); last = pan;
      } catch (e) { src.connect(g); }
      last.connect(this.master);
      src.start();
    };
    if (this._lifeBuf[file]) { play(this._lifeBuf[file]); return; }
    this._decode(url).then(b => { this._lifeBuf[file] = b; play(b); }).catch(() => {});
  },

  /* ── rain: the pack's crowd noise, high-passed into a hiss, plus drops ── */
  setRain(on) {
    this._rain = !!on;
    if (!this.ctx || !this._started) { if (on) this._rainWant = true; return; }
    if (on) this._startRain();
    if (!this._timer) this._timer = setInterval(() => this._tick(), 50);
  },
  _startRain() {
    if (this._rainSrc || !this.ctx) return;
    this._load("crowd").then(b => {
      if (!b || this._rainSrc || !this._rain) return;
      const src = this.ctx.createBufferSource(); src.buffer = b; src.loop = true; src.playbackRate.value = 1.6;
      const hp = this.ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2600;
      const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 9000;
      const g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.master);
      src.start(0, Math.random() * b.duration);
      this._rainSrc = src; this._rainGain = g;
      this._rainT = setInterval(() => {
        if (!this._rain || this.muted) return;
        if (Math.random() < 0.7) this._oneShot(Math.random() < 0.5 ? "movement_splash01" : "movement_splash02", 0.05 + Math.random() * 0.05, 1.8 + Math.random() * 0.8);
      }, 260);
      if (!this._timer) this._timer = setInterval(() => this._tick(), 50);
    });
  },

  /* ── public API ─────────────────────────────────────────── */
  startAmbient() {
    this.init();
    this._started = true; this._wanted = true;
    if (this.ctx && this.ctx.state === "suspended") { try { this.ctx.resume(); } catch (e) {} }
    /* preload every bed in the background so mood changes are instant */
    BEDS.forEach(n => this._load(n));
    this._refresh();
    this._scheduleLife(true);
    if (this._rain || this._rainWant) { this._rain = true; this._startRain(); }
  },
  stopAmbient() { this._wanted = false; this._refresh(); },

  setScene(sceneName, sceneObj) {
    this._scene = sceneName; this._sceneObj = sceneObj || null;
    this._refresh();
  },

  setMusicVolume(v) {
    this._userVol = Math.max(0, Math.min(1, v));
    if (!this._timer) this._timer = setInterval(() => this._tick(), 50);
  },

  nextTrack() { /* ambience is chosen automatically */ },

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && window.speechSynthesis) window.speechSynthesis.cancel();
    this._refresh();
    if (!this._timer) this._timer = setInterval(() => this._tick(), 50);
    return this.muted;
  },
};
