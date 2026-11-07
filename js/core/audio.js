/* js/core/audio.js -- adaptive background music.

   Four original tracks live in assets/audio/music/ (made by tools/gen_music.py):
     theme    open world (city / drive / walk / outdoors)
     chill    soft afro-pop for ordinary interiors
     night    amapiano for upscale / nightlife venues (hotel, mansion, showroom)
     chase    tense track while police are dispatched or a Hunt is running
   Quiet places (church, mosque, hospital, prison, classrooms ...) are silent.

   Music is chosen by mood and crossfaded — never cut. A scene can force the
   open-world theme with `allowMusic: true`.

   Public API (unchanged): init, startAmbient, stopAmbient, setScene,
   toggleMute, nextTrack.  New: setMusicVolume(0..1), mood. */

const DIRS = ["assets/audio/music/", "assets/music/"];

const TRACKS = {
  theme: { file: "theme.mp3",           gain: 0.45 },
  chill: { file: "chill_interior.mp3",  gain: 0.45, fallback: "theme" },
  night: { file: "night_amapiano.mp3",  gain: 0.45, fallback: "theme" },
  chase: { file: "chase_tense.mp3",     gain: 0.50, fallback: "theme" },
};

const OPEN_SCENES = new Set(["city", "drive", "walk", "zonewalk", "zonedrive", "travel", "pleasurepark", "exterior"]);
const QUIET_IDS   = new Set(["church", "mosque", "vatican", "hospital", "medical", "statejail", "prison",
                             "prisonScene", "classroom", "computerlab", "library", "lecture", "airplane", "range"]);
const NIGHT_IDS   = new Set(["hotel", "mansion", "showroom", "nightclub"]);

const FADE_SECONDS = 1.6;

function userVol() {
  try {
    const S = window.__ph3d_settings;
    const v = S && S.get ? S.get("musicVolume") : undefined;
    return v === undefined ? 0.6 : v;
  } catch (e) { return 0.6; }
}

export const AudioSystem = {
  ctx: null,
  muted: false,

  _els: {},            /* mood → HTMLAudioElement */
  _dirIdx: {},         /* mood → index into DIRS being tried */
  _missing: new Set(), /* moods whose file could not be loaded */
  _vol: {},            /* mood → current faded volume (0..1 of its target) */
  _mood: null,         /* mood we are fading toward (null = silence) */
  _scene: "city", _sceneObj: null,
  _musicStarted: false, _musicWanted: true,
  _timer: null, _poll: null, _userVol: null,

  /* back-compat: settings.js touches musicEl.volume directly */
  get musicEl() { return this._els[this._mood] || this._els.theme || null; },
  musicTracks: [{ id: "theme", title: "Original afrobeat theme" }],

  init() {
    if (this.ctx) return;
    try { const Ctx = window.AudioContext || window.webkitAudioContext; this.ctx = new Ctx(); } catch (e) {}
    /* re-evaluate every second: police dispatch / hunt can change at any time */
    if (!this._poll) this._poll = setInterval(() => this._refresh(), 1000);
  },

  /* ── mood selection ─────────────────────────────────────── */
  _pickMood() {
    const name = this._scene, obj = this._sceneObj;
    const id = (obj && obj.sceneId) || name;
    if (QUIET_IDS.has(id) || QUIET_IDS.has(name)) return null;
    const open = OPEN_SCENES.has(name) || (obj && obj.allowMusic === true) || (obj && obj.isInterior === false);
    if (open) {
      const pol = window.__ph3d_police, hunt = window.__ph3d_hunt;
      if ((pol && pol.dispatched) || (hunt && hunt.active)) return "chase";
      return "theme";
    }
    if (NIGHT_IDS.has(id)) return "night";
    return "chill";
  },

  _resolve(mood) {                 /* follow fallbacks for missing files */
    let m = mood;
    while (m && this._missing.has(m)) m = TRACKS[m].fallback || null;
    return m;
  },

  _el(mood) {
    if (this._els[mood]) return this._els[mood];
    const t = TRACKS[mood]; if (!t) return null;
    const i = this._dirIdx[mood] || 0;
    const el = new Audio(DIRS[i] + t.file);
    el.loop = true; el.preload = "auto"; el.volume = 0;
    el.addEventListener("error", () => {
      const n = (this._dirIdx[mood] || 0) + 1;
      if (n < DIRS.length) {                       /* try the other folder */
        this._dirIdx[mood] = n; el.src = DIRS[n] + t.file; el.load();
        if (this._musicStarted) el.play().catch(() => {});
        return;
      }
      console.warn("[audio] music file missing: " + t.file + " (looked in " + DIRS.join(", ") + ")");
      this._missing.add(mood); delete this._els[mood]; this._refresh();
    });
    this._els[mood] = el; this._vol[mood] = 0;
    return el;
  },

  /* ── apply the chosen mood: start it, then let the fader run ── */
  _refresh() {
    if (!this._musicStarted) return;
    const want = (this._musicWanted && !this.muted) ? this._resolve(this._pickMood()) : null;
    if (want !== this._mood) this._mood = want;
    if (want) {
      const el = this._el(want);
      if (el && el.paused) { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
    }
    if (!this._timer) this._timer = setInterval(() => this._tick(), 50);
  },

  _tick() {
    const step = 0.05 / FADE_SECONDS;
    let busy = false;
    const master = this._userVol != null ? this._userVol : userVol();
    for (const mood of Object.keys(this._els)) {
      const el = this._els[mood]; if (!el) continue;
      const target = (mood === this._mood) ? 1 : 0;
      let v = this._vol[mood] || 0;
      if (v < target) v = Math.min(target, v + step); else if (v > target) v = Math.max(target, v - step);
      this._vol[mood] = v;
      try { el.volume = Math.max(0, Math.min(1, v * TRACKS[mood].gain * master * 1.6)); } catch (e) {}
      if (v === 0 && target === 0 && !el.paused) { try { el.pause(); } catch (e) {} }
      if (v !== target) busy = true;
    }
    if (!busy) { clearInterval(this._timer); this._timer = null; }
  },

  /* ── public API ─────────────────────────────────────────── */
  startAmbient() { this._musicStarted = true; this._musicWanted = true; this._refresh(); },
  stopAmbient()  { this._musicWanted = false; this._refresh(); },

  /* Called by the router after every scene change. */
  setScene(sceneName, sceneObj) {
    this._scene = sceneName; this._sceneObj = sceneObj || null;
    this._refresh();
  },

  setMusicVolume(v) {
    this._userVol = Math.max(0, Math.min(1, v));
    if (!this._timer) this._timer = setInterval(() => this._tick(), 50);
  },

  nextTrack() { /* moods are chosen automatically; kept for compatibility */ },

  /* Mute silences music and speech. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && window.speechSynthesis) window.speechSynthesis.cancel();
    this._refresh();
    return this.muted;
  },

  get mood() { return this._mood; },
};
