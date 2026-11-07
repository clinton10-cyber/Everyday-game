/* js/core/sfx.js
   Central audio gateway. Every sound in the game goes through here.

   • Fire-and-forget SFX:  Sfx.play("gunshot_pistol")
   • Spatial fade:         pass { x, z } and sound fades with distance
   • Voice lines:          Sfx.voice("greet_walker") — random variant
   • Respects Settings.sfxVolume and Settings.voiceEnabled
   • Fails silently if a file is missing — missing assets never break gameplay
*/

const BASE = "assets/audio/";

/* ── SFX registry ───────────────────────────────────────────────
   max: spatial falloff distance in world units (0 = no spatial fade) */
const SFX = {
  /* Weapon & combat */
  gunshot_pistol:    { file: "sfx/gunshot_pistol.mp3",  vol: 0.85, max: 6 },
  gunshot_sniper:    { file: "sfx/gunshot_sniper.mp3",  vol: 1.00, max: 6 },
  knife_slash:       { file: "sfx/knife_slash.mp3",     vol: 0.60, max: 3 },
  knife_hit_flesh:   { file: "sfx/flesh_hit.mp3",       vol: 0.75, max: 3 },
  reload_click:      { file: "sfx/reload_click.mp3",    vol: 0.55, max: 2 },
  punch_impact:      { file: "sfx/punch_impact.mp3",    vol: 0.70, max: 3 },
  body_fall:         { file: "sfx/body_fall.mp3",       vol: 0.65, max: 3 },

  /* Damage & player feedback */
  hurt_grunt:        { file: "sfx/hurt_grunt.mp3",      vol: 0.55, max: 2 },
  death_rattle:      { file: "sfx/death_rattle.mp3",    vol: 0.65, max: 2 },
  pickup_coin:       { file: "sfx/pickup_coin.mp3",     vol: 0.55, max: 0 },
  pickup_item:       { file: "sfx/pickup_item.mp3",     vol: 0.55, max: 0 },
  inventory_full:    { file: "sfx/inventory_full.mp3",  vol: 0.45, max: 0 },
  money_deposit:     { file: "sfx/money_deposit.mp3",   vol: 0.60, max: 0 },
  money_withdraw:    { file: "sfx/money_withdraw.mp3",  vol: 0.60, max: 0 },
  purchase_ok:       { file: "sfx/purchase_ok.mp3",     vol: 0.60, max: 0 },
  purchase_fail:     { file: "sfx/purchase_fail.mp3",   vol: 0.55, max: 0 },

  /* Vehicles */
  car_engine_start:  { file: "sfx/car_engine_start.mp3", vol: 0.75, max: 4 },
  car_engine_stop:   { file: "sfx/car_engine_stop.mp3",  vol: 0.65, max: 4 },
  car_horn:          { file: "sfx/car_horn.mp3",         vol: 0.70, max: 5 },
  car_crash_light:   { file: "sfx/car_crash_light.mp3",  vol: 0.80, max: 6 },
  car_crash_heavy:   { file: "sfx/car_crash_heavy.mp3",  vol: 0.95, max: 6 },
  car_door_open:     { file: "sfx/car_door_open.mp3",    vol: 0.55, max: 3 },
  car_door_close:    { file: "sfx/car_door_close.mp3",   vol: 0.60, max: 3 },
  car_skid:          { file: "sfx/car_skid.mp3",         vol: 0.70, max: 5 },
  police_siren:      { file: "sfx/police_siren.mp3",     vol: 0.65, max: 8 },
  bike_engine:       { file: "sfx/bike_engine.mp3",      vol: 0.60, max: 4 },

  /* Footsteps */
  step_concrete_1:   { file: "sfx/step_concrete_1.mp3", vol: 0.35, max: 2 },
  step_concrete_2:   { file: "sfx/step_concrete_2.mp3", vol: 0.35, max: 2 },
  step_concrete_3:   { file: "sfx/step_concrete_3.mp3", vol: 0.35, max: 2 },
  step_grass_1:      { file: "sfx/step_grass_1.mp3",    vol: 0.30, max: 2 },
  step_grass_2:      { file: "sfx/step_grass_2.mp3",    vol: 0.30, max: 2 },
  step_wood_1:       { file: "sfx/step_wood_1.mp3",     vol: 0.35, max: 2 },
  step_wood_2:       { file: "sfx/step_wood_2.mp3",     vol: 0.35, max: 2 },

  /* Doors & environment */
  door_open_wood:    { file: "sfx/door_open_wood.mp3",  vol: 0.60, max: 3 },
  door_close_wood:   { file: "sfx/door_close_wood.mp3", vol: 0.60, max: 3 },
  door_open_glass:   { file: "sfx/door_open_glass.mp3", vol: 0.55, max: 3 },
  door_knock:        { file: "sfx/door_knock.mp3",      vol: 0.55, max: 3 },
  drawer_open:       { file: "sfx/drawer_open.mp3",     vol: 0.55, max: 2 },
  drawer_close:      { file: "sfx/drawer_close.mp3",    vol: 0.55, max: 2 },
  fridge_open:       { file: "sfx/fridge_open.mp3",     vol: 0.60, max: 2 },
  fridge_close:      { file: "sfx/fridge_close.mp3",    vol: 0.60, max: 2 },
  water_running:     { file: "sfx/water_running.mp3",   vol: 0.55, max: 3 },
  toilet_flush:      { file: "sfx/toilet_flush.mp3",    vol: 0.55, max: 3 },
  shower_on:         { file: "sfx/shower_on.mp3",       vol: 0.55, max: 3 },
  stove_click:       { file: "sfx/stove_click.mp3",     vol: 0.50, max: 2 },
  sizzle_loop:       { file: "sfx/sizzle_loop.mp3",     vol: 0.45, max: 2, loop: true },
  tv_static:         { file: "sfx/tv_static.mp3",       vol: 0.35, max: 3, loop: true },
  bed_creak:         { file: "sfx/bed_creak.mp3",       vol: 0.55, max: 2 },
  doorbell:          { file: "sfx/doorbell.mp3",        vol: 0.70, max: 4 },

  /* UI */
  ui_tap:            { file: "sfx/ui_tap.mp3",          vol: 0.40, max: 0 },
  ui_open:           { file: "sfx/ui_open.mp3",         vol: 0.45, max: 0 },
  ui_close:          { file: "sfx/ui_close.mp3",        vol: 0.45, max: 0 },
  ui_error:          { file: "sfx/ui_error.mp3",        vol: 0.50, max: 0 },
  phone_open:        { file: "sfx/phone_open.mp3",      vol: 0.55, max: 0 },
  phone_close:       { file: "sfx/phone_close.mp3",     vol: 0.55, max: 0 },
  notification_ping: { file: "sfx/notification_ping.mp3", vol: 0.55, max: 0 },

  /* Crime & arrest */
  handcuff_click:    { file: "sfx/handcuff_click.mp3",  vol: 0.65, max: 0 },
  jail_door_slam:    { file: "sfx/jail_door_slam.mp3",  vol: 0.80, max: 5 },
  police_whistle:    { file: "sfx/police_whistle.mp3",  vol: 0.70, max: 6 },
  ransom_paid:       { file: "sfx/ransom_paid.mp3",     vol: 0.75, max: 0 },

  /* Weather & ambience (loop) */
  ambient_city_loop: { file: "sfx/ambient_city.mp3",    vol: 0.20, max: 0, loop: true },
  ambient_rain_loop: { file: "sfx/ambient_rain.mp3",    vol: 0.30, max: 0, loop: true },
  ambient_indoor:    { file: "sfx/ambient_indoor.mp3",  vol: 0.15, max: 0, loop: true },
  bird_chirp_1:      { file: "sfx/bird_chirp_1.mp3",    vol: 0.35, max: 8 },
  bird_chirp_2:      { file: "sfx/bird_chirp_2.mp3",    vol: 0.35, max: 8 },
  crowd_murmur:      { file: "sfx/crowd_murmur.mp3",    vol: 0.22, max: 0, loop: true },
  traffic_rumble:    { file: "sfx/traffic_rumble.mp3",  vol: 0.18, max: 0, loop: true },
};

/* ── Voice registry ─────────────────────────────────────────────
   Each key maps to a list of file variants; Sfx.voice() picks one at random */
const VOICE = {
  /* NPC greetings by archetype */
  greet_walker:   { files: ["voice/greet_walker_1.mp3","voice/greet_walker_2.mp3","voice/greet_walker_3.mp3"], vol: 0.85 },
  greet_trader:   { files: ["voice/greet_trader_1.mp3","voice/greet_trader_2.mp3"], vol: 0.85 },
  greet_banker:   { files: ["voice/greet_banker_1.mp3","voice/greet_banker_2.mp3"], vol: 0.85 },
  greet_mechanic: { files: ["voice/greet_mechanic_1.mp3"], vol: 0.85 },
  greet_priest:   { files: ["voice/greet_priest_1.mp3"], vol: 0.85 },
  greet_doctor:   { files: ["voice/greet_doctor_1.mp3"], vol: 0.85 },
  greet_police:   { files: ["voice/greet_police_1.mp3","voice/greet_police_2.mp3"], vol: 0.90 },
  greet_taxi:     { files: ["voice/greet_taxi_1.mp3"], vol: 0.85 },
  greet_inmate:   { files: ["voice/greet_inmate_1.mp3","voice/greet_inmate_2.mp3"], vol: 0.85 },
  greet_warden:   { files: ["voice/greet_warden_1.mp3"], vol: 0.90 },

  /* Reactions */
  scream_short:   { files: ["voice/scream_1.mp3","voice/scream_2.mp3"], vol: 1.0 },
  scream_long:    { files: ["voice/scream_long_1.mp3"], vol: 1.0 },
  hurt:           { files: ["voice/hurt_1.mp3","voice/hurt_2.mp3","voice/hurt_3.mp3"], vol: 0.9 },
  death:          { files: ["voice/death_1.mp3","voice/death_2.mp3"], vol: 0.95 },
  hostage_grab:   { files: ["voice/hostage_grab_1.mp3"], vol: 1.0 },
  hostage_demand: { files: ["voice/hostage_demand_1.mp3"], vol: 0.9 },
  hostage_free:   { files: ["voice/hostage_free_1.mp3"], vol: 0.85 },

  /* Player (subtle, first-person) */
  player_hurt:      { files: ["voice/player_hurt_1.mp3","voice/player_hurt_2.mp3"], vol: 0.55 },
  player_exhausted: { files: ["voice/player_exhausted_1.mp3"], vol: 0.5 },

  /* Police */
  police_stop:   { files: ["voice/police_stop_1.mp3","voice/police_stop_2.mp3"], vol: 0.95 },
  police_arrest: { files: ["voice/police_arrest_1.mp3"], vol: 0.95 },
  police_radio:  { files: ["voice/police_radio_1.mp3","voice/police_radio_2.mp3"], vol: 0.85 },

  /* UI voice feedback */
  level_up:  { files: ["voice/level_up_1.mp3"], vol: 0.85 },
  job_start: { files: ["voice/job_start_1.mp3"], vol: 0.75 },
  job_done:  { files: ["voice/job_done_1.mp3"], vol: 0.85 },

  /* Ambient street life (no bubble text) */
  hawker_call:  { files: ["voice/hawker_call_1.mp3","voice/hawker_call_2.mp3"], vol: 0.8 },
  child_laugh:  { files: ["voice/child_laugh_1.mp3"], vol: 0.7 },
  crowd:        { files: ["voice/crowd_1.mp3","voice/crowd_2.mp3"], vol: 0.8 },
  crowd_chatter:{ files: ["voice/crowd_chatter_1.mp3","voice/crowd_chatter_2.mp3"], vol: 0.55 },
};

/* ── Transcripts of the recordings ───────────────────────────────
   assets/audio/voice/transcripts.json = { "police_stop_1.mp3": "Police! Stop right there!", ... }
   The words listed there are what is shown on screen when that file plays.
   Edit it with tools/voice_check.html (listen, fix the text, export). */
const _TRANS = {};
try {
  fetch(BASE + "voice/transcripts.json", { cache: "no-cache" })
    .then((r) => (r && r.ok ? r.json() : null))
    .then((j) => { if (j && typeof j === "object") Object.assign(_TRANS, j); })
    .catch(() => {});
} catch (_) {}

/* ── Runtime ─────────────────────────────────────────────────── */
const _pool = new Map();   // key → HTMLAudioElement (for loops)
const _last = new Map();   // key → timestamp (cooldown)

function _settings() {
  const S = window.__ph3d_settings;
  /* Settings.get(key) takes no default, so apply the fallback here. */
  return {
    get: (k, d) => {
      const v = S && S.get ? S.get(k) : undefined;
      return v === undefined ? d : v;
    },
  };
}

/* ── Spoken fallback ────────────────────────────────────────────
   When a voice mp3 is missing (or blocked) we speak a short line with the
   browser's built-in speech engine so voices are always audible. */
const SAY = {
  greet_walker: ["Good afternoon, oga.", "How far?", "No wahala."],
  greet_trader: ["Come buy! Fresh from the farm!", "Oga, I get the best price."],
  greet_banker: ["Bank is open. Walk in.", "Your money is safe with us."],
  greet_mechanic: ["Your car need servicing?"],
  greet_priest: ["God bless you, my child."],
  greet_doctor: ["Are you hurt? Let me have a look."],
  greet_police: ["Move along.", "Keep moving."],
  greet_taxi: ["Where you dey go? Enter!"],
  greet_inmate: ["You new here?", "Keep your head down."],
  greet_warden: ["No funny business."],
  scream_short: ["Aaah!", "Ahhh!"],
  scream_long: ["Aaaaaaah!"],
  hurt: ["Ow!", "Ah!", "Ugh!"],
  death: ["Aaargh...", "Uhh..."],
  hostage_grab: ["Let me go!"],
  hostage_demand: ["Pay the ransom!"],
  hostage_free: ["Thank you!"],
  player_hurt: ["Ugh!", "Argh!"],
  player_exhausted: ["Huff... huff..."],
  police_stop: ["Police! Stop right there!"],
  police_arrest: ["You are under arrest."],
  police_radio: ["Unit three, suspect spotted.", "Suspect is on foot. All units respond."],
  level_up: ["Level up!"],
  job_start: ["Job started."],
  job_done: ["Job complete."],
};

/* ── Voice picking ───────────────────────────────────────────────
   Each speaker (an NPC id, "player", ...) always gets the same voice, chosen
   from the device's English voices to fit their gender, so a character
   doesn't change voice from line to line. */
let _voices = null;
function _loadVoices() {
  try {
    const ss = window.speechSynthesis; if (!ss) return [];
    const all = ss.getVoices() || [];
    if (all.length) _voices = all.filter(v => /^en/i.test(v.lang));
    if (!_voices && ss.addEventListener && !_loadVoices._hooked) {
      _loadVoices._hooked = true;
      ss.addEventListener("voiceschanged", () => { _voices = null; });
    }
  } catch (_) {}
  return _voices || [];
}
const _FEM = /female|woman|zira|samantha|susan|karen|moira|tessa|fiona|hazel|victoria|kate|serena|allison|ava|joanna|salli|amy|emma|libby|sonia|natasha|aria|jenny/i;
const _MAL = /\bmale\b|david|mark|daniel|alex|george|fred|james|oliver|ryan|guy|davis|tom|lee|rishi|thomas|arthur|brian|eric/i;
function _hash(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const ROLE_PITCH = { police: 0.8, warden: 0.75, priest: 0.85, trader: 1.05, taxi: 0.95, doctor: 1.0, banker: 1.0, mechanic: 0.9, inmate: 0.9 };
function _pickVoice(who, gender) {
  const vs = _loadVoices(); if (!vs.length) return null;
  const want = gender === "feminine" ? _FEM : gender === "masculine" ? _MAL : null;
  const pool = want ? vs.filter(v => want.test(v.name)) : [];
  const list = pool.length ? pool : vs;
  const nig = list.filter(v => /NG|nigeria/i.test(v.lang + v.name));
  const choices = nig.length ? nig : list;
  return choices[_hash(who) % choices.length];
}

/* Device speech is flaky on phones: speak() right after cancel() is silently
   dropped, utterances get garbage-collected before they start, and some phones
   have no voices at all. So: keep a reference, wait a beat after cancel(), watch
   whether the line actually STARTED, and remember if the engine is dead. */
let _ttsFail = 0, _ttsOk = false, _keepU = null;
function _canSpeak() {
  try {
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === "undefined") return false;
    if (_ttsOk) return true;
    if (_ttsFail >= 2) return false;
    return true;               /* untested yet: assume it works until it proves otherwise */
  } catch (_) { return false; }
}

function _speak(text, vol, opts = {}) {
  try {
    const ss = window.speechSynthesis;
    if (!ss || !text || !_canSpeak()) return;
    const wasBusy = !!(opts.interrupt || ss.speaking || ss.pending);
    if (wasBusy) ss.cancel();                                         /* newest line wins */
    const u = new SpeechSynthesisUtterance(text);
    _keepU = u;                                                       /* stop early garbage collection */
    u.volume = Math.max(0.05, Math.min(1, vol));
    const who = opts.who || opts.role || "anon";
    const h = _hash(who);
    const jitter = ((h % 100) / 100 - 0.5) * 0.2;          /* ±0.1, stable per speaker */
    const g = opts.gender;
    const basePitch = g === "feminine" ? 1.25 : g === "masculine" ? 0.85 : 1.0;
    const v = _pickVoice(who, g);
    if (v) { u.voice = v; u.lang = v.lang; }
    u.pitch = opts.pitch || Math.max(0.5, Math.min(1.8, basePitch * (ROLE_PITCH[opts.role] || 1) + jitter));
    u.rate  = opts.rate  || (0.95 + (h % 7) * 0.02);
    let started = false;
    u.onstart = () => { started = true; _ttsOk = true; _ttsFail = 0; };
    u.onerror = () => { if (!started) _ttsFail++; };
    setTimeout(() => { if (!started && _keepU === u && !(ss.speaking)) _ttsFail++; }, 3000);
    const go = () => { try { ss.resume && ss.resume(); ss.speak(u); } catch (_) {} };
    if (wasBusy) setTimeout(go, 80); else go();
  } catch (_) {}
}

function _playerPos() {
  /* Open world: the drive scene knows where you are (car or on foot).
     Inside buildings the drive scene is torn down, so use the walk controller —
     otherwise every interior voice was measured from (0,0), judged "too far
     away" and silently skipped. */
  try {
    const d = window.__ph3d_drive;
    if (d && d.getPos) { const p = d.getPos(); if (p) return p; }
  } catch (_) {}
  const wc = window.__ph3d_walkCtrl;
  if (wc && wc.pos) return { x: wc.pos.x, z: wc.pos.z };
  return { x: 0, z: 0 };
}

export const Sfx = {

  /* ── play(key, opts?)
     One-shot or looped SFX.
     opts: { x, z, vol, rate, loop } */
  play(key, opts = {}) {
    const def = SFX[key];
    if (!def) return null;

    const masterVol = _settings().get("sfxVolume", 0.8);
    if (masterVol <= 0) return null;

    /* Cooldown — don't stack identical sounds faster than 40 ms */
    const now = performance.now();
    if (!def.loop && now - (_last.get(key) || 0) < 40) return null;
    _last.set(key, now);

    /* Spatial fade */
    let spatial = 1;
    if (opts.x != null && opts.z != null && def.max > 0) {
      const p = _playerPos();
      const d = Math.hypot(p.x - opts.x, p.z - opts.z);
      spatial = Math.max(0, 1 - d / def.max);
      if (spatial <= 0.02) return null;
    }

    const a = new Audio(BASE + def.file);
    a.volume = Math.min(1, (opts.vol != null ? opts.vol : def.vol) * masterVol * spatial);
    a.playbackRate = opts.rate || 1;
    if (opts.loop) {
      a.loop = true;
      _pool.set(key, a);
    }
    a.play().catch(() => {});
    return a;
  },

  /* ── voice(key, opts?)
     Play a random variant from a voice group.
     Requires Settings.voiceEnabled = true. */
  voice(key, opts = {}) {
    const def = VOICE[key];
    if (!def) return null;
    /* NPC / player voice lines have their own switch (default ON).
       "voiceEnabled" is the multiplayer microphone toggle — a different thing. */
    if (!_settings().get("npcVoice", true)) return null;

    const masterVol = _settings().get("sfxVolume", 0.8);
    if (masterVol <= 0) return null;

    /* Cooldown per group: 800 ms */
    const now = performance.now();
    const ck = "voice:" + key;
    if (now - (_last.get(ck) || 0) < 800) return null;
    _last.set(ck, now);

    /* Spatial fade */
    let spatial = 1;
    if (opts.x != null && opts.z != null) {
      const p = _playerPos();
      const d = Math.hypot(p.x - opts.x, p.z - opts.z);
      spatial = Math.max(0, 1 - d / (opts.maxRange || 12));
      if (spatial <= 0.03) return null;
    }

    const list = Array.isArray(def.files) ? def.files : [def.files];
    const lines = SAY[key] || [];
    /* ONE index picks the recording AND its transcript, so the clip that plays
       and the words in SAY[] (and any on-screen text) are always the same line.
       Recordings are expected in the same order as the SAY[] lines. */
    const i = Math.floor(Math.random() * list.length);
    const file = list[i];
    const base = String(file).split("/").pop();
    const text = opts.text || _TRANS[base] || (i < lines.length ? lines[i] : "");
    this.lastText = text;                      /* callers show this in toasts/bubbles */

    const vol = Math.min(1, (opts.vol != null ? opts.vol : def.vol) * masterVol * spatial);
    /* A line that is also shown on screen must be SPOKEN EXACTLY as shown —
       a pre-recorded clip can't match arbitrary text, so speak it. */
    if (opts.text) { _speak(opts.text, vol, opts); return null; }
    const sp    = { pitch: opts.pitch, rate: opts.rate, who: opts.who, role: opts.role, gender: opts.gender };
    let fell = false;
    const fallback = () => { if (fell) return; fell = true; _speak(text, vol, sp); };

    const a = new Audio(BASE + file);
    a.volume = vol;
    a.addEventListener("error", fallback);
    a.play().catch(fallback);
    return a;
  },

  /* true while the device speech engine seems to work (false once it fails twice) */
  canSpeak() { return _canSpeak(); },

  /* ── voiceText(key, opts?)
     Same as voice() but RETURNS the exact words being spoken, so the caller can
     show them on screen. Use: const t = Sfx.voiceText("police_stop"); toast(t); */
  voiceText(key, opts = {}) {
    this.lastText = "";
    this.voice(key, opts);
    return this.lastText || "";
  },

  /* ── speakText(text, opts?)
     Speak arbitrary on-screen text (job toasts, win banners…) exactly as shown.
     Emoji are dropped and ₦ amounts are read as "N naira". */
  speakText(text, opts = {}) {
    const clean = String(text || "")
      .replace(/₦\s*([\d,\.]+)/g, "$1 naira")
      .replace(/\+(\d)/g, "plus $1")
      .replace(/[·•|]/g, ",")
      .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, "")
      .replace(/\s+/g, " ").trim();
    if (clean) this.say(clean, opts);
    return clean;
  },

  /* ── say(text, opts?)
     Say a line that is also shown on screen (speech bubble).
       opts.file  — a recording in assets/audio/voice/ (e.g. "walker_01.mp3").
                    If it is missing or blocked, the SAME text is spoken instead.
       opts.who / role / gender — pick a stable voice for the speaker.
       opts.x / z / maxRange    — distance fade.
     Only one line plays at a time: a new line stops the previous one. */
  say(text, opts = {}) {
    if (!_settings().get("npcVoice", true)) return;
    const masterVol = _settings().get("sfxVolume", 0.8);
    if (masterVol <= 0) return;
    let spatial = 1;
    if (opts.x != null && opts.z != null) {
      const p = _playerPos();
      const d = Math.hypot(p.x - opts.x, p.z - opts.z);
      spatial = Math.max(0, 1 - d / (opts.maxRange || 12));
      if (spatial <= 0.03) return;
    }
    const vol = Math.min(1, (opts.vol != null ? opts.vol : 0.9) * masterVol * spatial);
    /* stop whatever line was playing */
    try { if (this._lineEl) { this._lineEl.pause(); this._lineEl = null; } } catch (_) {}
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}

    const speakIt = () => _speak(text, vol, Object.assign({ interrupt: true }, opts));
    if (!opts.file) { speakIt(); return; }

    let fell = false;
    const fallback = () => { if (fell) return; fell = true; if (this._lineEl === a) this._lineEl = null; speakIt(); };
    const a = new Audio(BASE + "voice/" + opts.file);
    a.volume = vol;
    a.addEventListener("error", fallback);
    this._lineEl = a;
    const pr = a.play();
    if (pr && pr.catch) pr.catch(fallback);
  },

  /* ── loop / stop / stopAll ── */
  loop(key, opts = {}) {
    this.stop(key);
    return this.play(key, { ...opts, loop: true });
  },
  stop(key) {
    const a = _pool.get(key);
    if (a) { try { a.pause(); } catch (_) {} _pool.delete(key); }
  },
  stopAll() {
    for (const k of _pool.keys()) this.stop(k);
  },

  /* ── switchAmbience(key)
     Fades out the current ambient loops and starts a new one. */
  switchAmbience(key) {
    const AMBIENCE_KEYS = new Set(["ambient_city_loop","ambient_rain_loop","ambient_indoor","crowd_murmur","traffic_rumble"]);
    for (const [k, a] of _pool) {
      if (!AMBIENCE_KEYS.has(k) || k === key) continue;
      let v = a.volume;
      const fade = setInterval(() => {
        v *= 0.85;
        if (v < 0.01) { clearInterval(fade); try { a.pause(); } catch (_) {} _pool.delete(k); }
        else a.volume = v;
      }, 60);
    }
    if (key) this.loop(key);
  },

  /* ── Convenience wrappers ── */

  footsteps(surface, x, z) {
    const variants = {
      concrete: ["step_concrete_1","step_concrete_2","step_concrete_3"],
      grass:    ["step_grass_1","step_grass_2"],
      wood:     ["step_wood_1","step_wood_2"],
    };
    const pool = variants[surface] || variants.concrete;
    const key  = pool[Math.floor(Math.random() * pool.length)];
    this.play(key, { x, z, rate: 0.92 + Math.random() * 0.16 });
  },

  gunshot(type, x, z) {
    this.play(type === "sniper" ? "gunshot_sniper" : "gunshot_pistol", { x, z, vol: 0.95 });
  },

  hit()     { this.play("hurt_grunt",   { vol: 0.55 }); },
  uiTap()   { this.play("ui_tap"); },
  uiOpen()  { this.play("ui_open"); },
  uiClose() { this.play("ui_close"); },
  uiError() { this.play("ui_error"); },
};

window.__ph3d_sfx = Sfx;

