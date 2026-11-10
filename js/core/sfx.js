/* js/core/sfx.js
   Central audio gateway. Every sound in the game goes through here.

   • Fire-and-forget SFX:  Sfx.play("gunshot_pistol")
   • Spatial fade:         pass { x, z } and sound fades with distance
   • Voice lines:          Sfx.voice("greet_walker") — random variant
   • Respects Settings.sfxVolume and Settings.voiceEnabled
   • Fails silently if a file is missing — missing assets never break gameplay
*/

const BASE = "assets/audio/";

/* ── SFX registry — every sound comes from the Sound pack (assets/audio/sfx) ──
   file  : one clip       files : random variant each play
   rate  : playback speed  layer : { file, vol, rate, delay } second clip mixed on top
   max   : spatial falloff distance in world units (0 = no spatial fade) */
const f = (n) => "sfx/" + n + ".mp3";
const SFX = {
  /* Weapon & combat */
  gunshot_pistol:    { files: [f("props_shot01"), f("props_shot02")], vol: 0.85, max: 7, layer: { file: f("props_ricochet01"), vol: 0.25, delay: 0.12 } },
  gunshot_sniper:    { file: f("props_shot02"),  vol: 1.00, rate: 0.82, max: 8, layer: { file: f("props_ricochet03"), vol: 0.35, delay: 0.25 } },
  knife_slash:       { files: [f("props_blade"), f("movement_swing")], vol: 0.65, max: 3 },
  knife_hit_flesh:   { files: [f("props_stab"), f("props_bleed")], vol: 0.75, max: 3 },
  flesh_hit:         { files: [f("movement_impact03"), f("movement_impact06")], vol: 0.7, max: 3 },
  reload_click:      { file: f("props_reload"),  vol: 0.6,  max: 2 },
  punch_impact:      { files: [f("movement_impact01"), f("movement_impact02"), f("movement_impact04"), f("movement_impact05")], vol: 0.75, max: 3 },
  body_fall:         { files: [f("movement_fall"), f("movement_thud")], vol: 0.7, max: 3 },
  axe_hit:           { file: f("props_axe"),     vol: 0.7,  max: 3 },
  explosion:         { file: f("props_explosion"), vol: 1.0, max: 14 },
  ricochet:          { files: [f("props_ricochet01"), f("props_ricochet02"), f("props_ricochet03")], vol: 0.5, max: 6 },
  laser:             { file: f("props_laser"),   vol: 0.5,  max: 6 },
  mine_click:        { file: f("props_mine"),    vol: 0.6,  max: 4 },
  syringe:           { file: f("props_syringe"), vol: 0.5,  max: 2 },

  /* Damage & player feedback */
  hurt_grunt:        { files: [f("pain_pain01"), f("pain_pain03"), f("pain_pain04"), f("pain_pain06"), f("pain_pain07"), f("pain_pain08")], vol: 0.6, max: 3 },
  death_rattle:      { file: f("pain_death"),    vol: 0.7,  max: 4 },
  pickup_coin:       { file: f("cash"),          vol: 0.55, max: 0 },
  pickup_item:       { files: [f("paper"), f("props_generic")], vol: 0.55, max: 0 },
  inventory_full:    { file: f("cancel"),        vol: 0.45, max: 0 },
  money_deposit:     { file: f("cash"),          vol: 0.65, max: 0 },
  money_withdraw:    { file: f("cash"),          vol: 0.65, rate: 1.12, max: 0 },
  purchase_ok:       { file: f("confirm"),       vol: 0.6,  max: 0, layer: { file: f("cash"), vol: 0.4, delay: 0.15 } },
  purchase_fail:     { file: f("cancel"),        vol: 0.55, max: 0 },
  camera_shot:       { file: f("camera"),        vol: 0.6,  max: 0 },
  eat:               { file: f("props_eat"),     vol: 0.55, max: 0 },
  drink:             { file: f("props_drink"),   vol: 0.55, max: 0 },
  cigar:             { file: f("props_cigar"),   vol: 0.5,  max: 0 },
  computer_click:    { file: f("computer"),      vol: 0.5,  max: 0 },
  trash:             { file: f("trash"),         vol: 0.5,  max: 3 },
  cheer:             { file: f("cheer"),         vol: 0.55, max: 0 },
  jeer:              { file: f("jeer"),          vol: 0.55, max: 0 },
  snore:             { file: f("pain_snoring"),  vol: 0.4,  max: 3 },
  choke:             { file: f("pain_choke"),    vol: 0.5,  max: 3 },

  /* Dropping / throwing objects */
  drop_soft:         { files: [f("movement_thud"), f("props_generic")], vol: 0.55, max: 6 },
  drop_wood:         { files: [f("props_wood"), f("movement_thud")], vol: 0.6, max: 6 },
  drop_metal:        { files: [f("props_metal"), f("props_rock")], vol: 0.6, max: 8 },
  drop_glass:        { file: f("props_bottle"), vol: 0.55, max: 8 },
  drop_ball:         { file: f("props_ball"),   vol: 0.6,  max: 8 },
  drop_paper:        { file: f("paper"),        vol: 0.5,  max: 4 },
  drop_cash:         { file: f("cash"),         vol: 0.5,  max: 4 },
  throw_whoosh:      { file: f("movement_swing"), vol: 0.55, max: 6 },

  /* Vehicles (the pack has no engines — built from its closest sounds) */
  car_engine_start:  { file: f("props_blaze"),   vol: 0.8,  rate: 0.55, max: 5, layer: { file: f("world_door02"), vol: 0.35, delay: 0 } },
  car_engine_stop:   { file: f("props_blaze"),   vol: 0.55, rate: 0.40, max: 5 },
  car_horn:          { file: f("world_buzzer"),  vol: 0.7,  rate: 0.78, max: 8 },
  car_crash_light:   { files: [f("movement_impact03"), f("movement_impact06")], vol: 0.85, max: 8, layer: { file: f("props_metal"), vol: 0.5, delay: 0.02 } },
  car_crash_heavy:   { file: f("movement_impact06"), vol: 1.0, rate: 0.8, max: 10, layer: { file: f("props_explosion"), vol: 0.45, rate: 1.4, delay: 0.04 } },
  car_door_open:     { file: f("world_door01"),  vol: 0.55, max: 4 },
  car_door_close:    { file: f("world_door02"),  vol: 0.6,  rate: 1.15, max: 4 },
  car_skid:          { file: f("props_ricochet02"), vol: 0.6, rate: 0.55, max: 7 },
  police_siren:      { file: f("world_alarm"),   vol: 0.55, max: 10, loop: true },
  bike_engine:       { file: f("props_blaze"),   vol: 0.6,  rate: 0.7, max: 5 },

  /* Footsteps */
  step_concrete_1:   { file: f("movement_step01"), vol: 0.40, max: 3 },
  step_concrete_2:   { file: f("movement_step02"), vol: 0.40, max: 3 },
  step_concrete_3:   { file: f("movement_step03"), vol: 0.40, max: 3 },
  step_grass_1:      { file: f("movement_shuffle01"), vol: 0.35, rate: 1.25, max: 3 },
  step_grass_2:      { file: f("movement_shuffle03"), vol: 0.35, rate: 1.25, max: 3 },
  step_wood_1:       { file: f("movement_step04"), vol: 0.42, rate: 0.9, max: 3 },
  step_wood_2:       { file: f("movement_step02"), vol: 0.42, rate: 0.82, max: 3 },

  /* Doors & environment */
  door_open_wood:    { file: f("world_door01"),  vol: 0.6,  max: 4 },
  door_close_wood:   { file: f("world_door02"),  vol: 0.6,  max: 4 },
  door_open_glass:   { file: f("world_door03"),  vol: 0.55, max: 4 },
  door_knock:        { file: f("props_wood"),    vol: 0.6,  max: 4 },
  drawer_open:       { file: f("movement_shuffle02"), vol: 0.55, max: 2 },
  drawer_close:      { file: f("movement_thud"), vol: 0.55, max: 2 },
  fridge_open:       { file: f("world_door03"),  vol: 0.5,  rate: 1.2, max: 2 },
  fridge_close:      { file: f("world_door02"),  vol: 0.5,  rate: 1.3, max: 2 },
  water_running:     { file: f("movement_splash01"), vol: 0.5, max: 3 },
  toilet_flush:      { file: f("movement_splash02"), vol: 0.55, rate: 0.8, max: 3 },
  shower_on:         { file: f("props_splash"),  vol: 0.5,  max: 3 },
  stove_click:       { file: f("props_mine"),    vol: 0.55, max: 2 },
  sizzle_loop:       { file: f("props_blaze"),   vol: 0.35, rate: 1.4, max: 3, loop: true },
  tv_static:         { file: "ambience/quiet.wav", vol: 0.25, max: 4, loop: true },
  bed_creak:         { file: f("movement_shuffle03"), vol: 0.55, rate: 0.7, max: 2 },
  doorbell:          { file: f("world_bell"),    vol: 0.6,  rate: 1.3, max: 5 },
  phone_ring:        { file: f("world_ring"),    vol: 0.55, max: 4 },
  phone_buzz:        { file: f("props_phone"),   vol: 0.5,  max: 3 },
  tannoy:            { file: f("world_tanoy"),   vol: 0.5,  max: 14 },
  bell:              { file: f("world_bell"),    vol: 0.45, max: 18 },
  alarm:             { file: f("world_alarm"),   vol: 0.5,  max: 14 },
  buzzer:            { file: f("world_buzzer"),  vol: 0.5,  max: 10 },
  bottle:            { file: f("props_bottle"),  vol: 0.5,  max: 6 },
  cane_tap:          { file: f("props_cane"),    vol: 0.45, max: 5 },
  ball_bounce:       { file: f("props_ball"),    vol: 0.5,  max: 8 },
  basket:            { file: f("world_basket"),  vol: 0.5,  max: 10 },
  metal_clang:       { file: f("props_metal"),   vol: 0.5,  max: 8 },
  rock_knock:        { file: f("props_rock"),    vol: 0.5,  max: 6 },

  /* UI */
  ui_tap:            { file: f("browse"),        vol: 0.45, max: 0 },
  ui_open:           { file: f("select"),        vol: 0.5,  max: 0 },
  ui_close:          { file: f("select"),        vol: 0.45, rate: 0.8, max: 0 },
  ui_error:          { file: f("cancel"),        vol: 0.5,  max: 0 },
  phone_open:        { file: f("browse"),        vol: 0.55, rate: 1.2, max: 0 },
  phone_close:       { file: f("select"),        vol: 0.5,  rate: 0.75, max: 0 },
  notification_ping: { file: f("confirm"),       vol: 0.45, rate: 1.35, max: 0 },

  /* Crime & arrest */
  handcuff_click:    { file: f("props_metal"),   vol: 0.65, rate: 1.3, max: 0 },
  jail_door_slam:    { file: f("world_door03"),  vol: 0.9,  rate: 0.7, max: 8, layer: { file: f("props_metal"), vol: 0.6, rate: 0.8, delay: 0.05 } },
  police_whistle:    { file: f("world_buzzer"),  vol: 0.6,  rate: 1.6, max: 8 },
  ransom_paid:       { file: f("cash"),          vol: 0.75, max: 0, layer: { file: f("cheer"), vol: 0.3, delay: 0.3 } },

  /* Ambience beds are handled by js/core/audio.js — these keys stay valid but
     simply forward there, so older calls (weather, scenes) keep working. */
  ambient_city_loop: { bed: true }, ambient_indoor: { bed: true }, traffic_rumble: { bed: true },
  ambient_rain_loop: { bed: "rain" },
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
  scream_short:   { files: ["sfx/pain_agony01.mp3","sfx/pain_agony02.mp3"], vol: 1.0 },
  scream_long:    { files: ["sfx/pain_agony03.mp3"], vol: 1.0 },
  hurt:           { files: ["sfx/pain_pain02.mp3","sfx/pain_pain05.mp3","sfx/pain_pain07.mp3"], vol: 0.9 },
  death:          { files: ["sfx/pain_death.mp3","sfx/pain_agony02.mp3"], vol: 0.95 },
  hostage_grab:   { files: ["voice/hostage_grab_1.mp3"], vol: 1.0 },
  hostage_demand: { files: ["voice/hostage_demand_1.mp3"], vol: 0.9 },
  hostage_free:   { files: ["voice/hostage_free_1.mp3"], vol: 0.85 },

  /* Player (subtle, first-person) */
  player_hurt:      { files: ["sfx/pain_pain01.mp3","sfx/pain_pain04.mp3","sfx/pain_pain06.mp3"], vol: 0.6 },
  player_exhausted: { files: ["sfx/pain_choke.mp3"], vol: 0.5 },

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
  crowd:        { files: ["sfx/cheer.mp3","sfx/jeer.mp3"], vol: 0.8 },
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
let _stepT = 0.2, _lieT = 0, _snoreT = 0;

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

/* global trim: the old mix was too loud and busy */
const SFX_TRIM = 0.5;

export const Sfx = {

  /* ── play(key, opts?)
     One-shot or looped SFX.
     opts: { x, z, vol, rate, loop } */
  play(key, opts = {}) {
    const def = SFX[key];
    if (!def) return null;

    /* ambience beds belong to the AudioSystem (js/core/audio.js) */
    if (def.bed) {
      const A = window.__ph3d_audio;
      if (def.bed === "rain" && A && A.setRain) A.setRain(true);
      return null;
    }

    const masterVol = (_settings().get("sfxVolume", 0.4) * SFX_TRIM);
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

    const baseRate = (opts.rate || 1) * (def.rate || 1);
    const vol0 = (opts.vol != null ? opts.vol : def.vol) * masterVol * spatial;
    const pick = def.files ? def.files[Math.floor(Math.random() * def.files.length)] : def.file;
    const a = new Audio(BASE + pick);
    a.volume = Math.min(1, vol0);
    a.playbackRate = baseRate;
    if (opts.loop || def.loop) { a.loop = true; _pool.set(key, a); }
    a.play().catch(() => {});

    if (def.layer) {
      const L = def.layer;
      const go = () => {
        const b = new Audio(BASE + L.file);
        b.volume = Math.min(1, (L.vol != null ? L.vol : 0.5) * masterVol * spatial);
        b.playbackRate = (L.rate || 1) * (opts.rate || 1);
        b.play().catch(() => {});
      };
      if (L.delay) setTimeout(go, L.delay * 1000); else go();
    }
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

    const masterVol = (_settings().get("sfxVolume", 0.4) * SFX_TRIM);
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
    if (/^sfx\//.test(file)) {                       /* pack sounds: vary pitch per speaker */
      const g = opts.gender === "feminine" ? 1.22 : opts.gender === "masculine" ? 0.92 : 1;
      a.playbackRate = g * (0.94 + Math.random() * 0.14);
    }
    a.addEventListener("error", fallback);
    a.play().catch(fallback);
    return a;
  },

  /* ── pain(kind, opts?)  — body-reaction voices from the Pain sounds.
     kind: light | medium | heavy | death | choke | cry | snore
     opts: { x, z, gender, vol, maxRange }  — gender shifts the pitch so men and
     women sound different; every call gets a little random pitch variation. */
  pain(kind, opts = {}) {
    if (!_settings().get("npcVoice", true)) return null;
    const masterVol = (_settings().get("sfxVolume", 0.4) * SFX_TRIM);
    if (masterVol <= 0) return null;
    const P = (...n) => n.map(x => "sfx/pain_" + x + ".mp3");
    const SETS = {
      light:  { files: P("pain01", "pain03", "pain06", "pain07", "pain08"), vol: 0.6 },
      medium: { files: P("pain02", "pain04", "pain05"), vol: 0.75 },
      heavy:  { files: P("agony01", "agony02", "agony03"), vol: 0.9 },
      death:  { files: P("death"), vol: 0.9 },
      choke:  { files: P("choke"), vol: 0.6 },
      cry:    { files: P("breakdown"), vol: 0.45 },
      snore:  { files: P("snoring"), vol: 0.4 },
    };
    const def = SETS[kind] || SETS.light;
    const ck = "pain:" + kind + ":" + (opts.who || "");
    const now = performance.now();
    if (now - (_last.get(ck) || 0) < (kind === "light" ? 250 : 600)) return null;
    _last.set(ck, now);
    let spatial = 1;
    if (opts.x != null && opts.z != null) {
      const p = _playerPos();
      const d = Math.hypot(p.x - opts.x, p.z - opts.z);
      spatial = Math.max(0, 1 - d / (opts.maxRange || 25));
      if (spatial <= 0.03) return null;
    }
    const g = opts.gender === "feminine" ? 1.22 : opts.gender === "masculine" ? 0.92 : 1;
    const rate = g * (0.94 + Math.random() * 0.14);
    const vol = Math.min(1, (opts.vol != null ? opts.vol : def.vol) * masterVol * spatial);
    const mk = (file, v, r) => { const x = new Audio(BASE + file); x.volume = Math.min(1, v); x.playbackRate = r; return x; };

    /* DEATH = one connected sound: the cry of pain flows straight into the death rattle
       (same voice, same pitch) instead of a lone rattle with no pain before it. */
    if (kind === "death") {
      const cry = mk(P("agony01", "agony02", "agony03")[Math.floor(Math.random() * 3)], vol, rate);
      const end = mk("sfx/pain_death.mp3", vol, rate * 0.97);
      let fired = false;
      const next = () => { if (fired) return; fired = true; end.play().catch(() => {}); };
      cry.addEventListener("ended", next);
      cry.addEventListener("error", next);
      /* start the rattle slightly before the cry ends so there is no silent gap */
      cry.addEventListener("timeupdate", () => {
        if (cry.duration && isFinite(cry.duration) && cry.currentTime >= cry.duration - 0.12) next();
      });
      cry.play().catch(next);
      return cry;
    }

    const a = mk(def.files[Math.floor(Math.random() * def.files.length)], vol, rate);
    a.play().catch(() => {});
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
    const masterVol = (_settings().get("sfxVolume", 0.4) * SFX_TRIM);
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
    const d = SFX[key];
    if (d && d.bed) return this.play(key, opts);
    this.stop(key);
    return this.play(key, { ...opts, loop: true });
  },
  stop(key) {
    if (key === "ambient_rain_loop") { const A = window.__ph3d_audio; if (A && A.setRain) A.setRain(false); return; }
    const a = _pool.get(key);
    if (a) { try { a.pause(); } catch (_) {} _pool.delete(key); }
  },
  stopAll() {
    for (const k of _pool.keys()) this.stop(k);
  },

  /* ── switchAmbience(key)
     Fades out the current ambient loops and starts a new one. */
  switchAmbience(key) {
    const AMBIENCE_KEYS = new Set(["tv_static"]);
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

  /* Footsteps driven by the movement code: call every frame while on foot.
     Picks the surface from the current scene; run = faster cadence. */
  stepTick(dt, moving, running, surface) {
    if (!moving) { _stepT = 0.18; return; }
    _stepT -= dt;
    if (_stepT > 0) return;
    _stepT = running ? 0.30 : 0.46;
    let s = surface;
    if (!s) {
      const r = window.__ph3d_router, cur = r && r.current;
      const id = String((cur && cur.sceneId) || "");
      const open = !cur || cur.isInterior === false || /^(city|drive|walk|zonewalk|zonedrive)$/.test(id) || !id;
      if (open) s = Math.random() < 0.3 ? "grass" : "concrete";
      else s = /house|mansion|hotel|govhouse|governor|church|vatican|home|apartment/i.test(id) ? "wood" : "concrete";
    }
    const p = _playerPos();
    this.footsteps(s, p.x, p.z);
  },

  /* Object drop / throw sound, picked from the item's type or name. */
  dropSound(item, x, z, thrown) {
    const t = String((item && (item.type || item.id || item.label)) || "").toLowerCase();
    let key = "drop_soft";
    if (/gun|pistol|rifle|knife|cleaver|axe|blade|metal|tool|wrench|key|phone|laptop|can\b|pot|pan/.test(t)) key = "drop_metal";
    else if (/bottle|glass|water|drink|juice|beer|soda|jar|cup/.test(t)) key = "drop_glass";
    else if (/ball|football|soccer/.test(t)) key = "drop_ball";
    else if (/cash|coin|money|naira|gem/.test(t)) key = "drop_cash";
    else if (/paper|book|note|card|doc|letter|photo/.test(t)) key = "drop_paper";
    else if (/wood|chair|stick|plank|box|crate|table|bat/.test(t)) key = "drop_wood";
    const o = { x, z };
    if (thrown) { this.play("throw_whoosh", o); setTimeout(() => this.play(key, Object.assign({ vol: 0.8 }, o)), 380); }
    else setTimeout(() => this.play(key, o), 120);
  },

  /* Sleeping: while the player is lying down, bed creak then slow snoring. */
  sleepTick(dt, lying) {
    if (!lying) { _lieT = 0; _snoreT = 0; return; }
    if (_lieT === 0) this.play("bed_creak");
    _lieT += dt;
    if (_lieT < 1.5) return;
    _snoreT -= dt;
    if (_snoreT <= 0) { _snoreT = 3.2 + Math.random() * 1.2; try { this.pain("snore", { vol: 0.35 }); } catch (_) {} }
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

/* Soft UI tick on every menu / phone / panel button (touch-control buttons excluded). */
try {
  document.addEventListener("click", (e) => {
    const b = e.target && e.target.closest && e.target.closest("button, [role=button]");
    if (!b) return;
    const tag = (b.id || "") + " " + (b.className && b.className.baseVal === undefined ? b.className : "");
    if (/drive|walk|joy|horn|fire|aim|jump|run|jet|touch|ctrl|action/i.test(tag)) return;
    Sfx.play("ui_tap");
  }, true);
} catch (_) {}

