/* ════════════════════════════════════════════════════════════════
   sanity.js — the SANITY meter (0–100).

   High sanity value = unstable mind. It climbs with danger and
   calms down when you rest. Above ROGUE_AT the character sometimes
   goes rogue for a few seconds and stops obeying the controller:
     • "wander"   – runs off in a random direction
     • "inverted" – your stick / keys are reversed

   Rises:  taking damage · high police alert · weapon drawn · low HP
   Falls:  sitting · lying · praying · eating · meditating · standing
           still · slowly on its own

   Exposes window.__ph3d_sanity  { value, rogueActive, rogue(), … }
   HUD bar is drawn by the player-panel updater in index.html.
   ════════════════════════════════════════════════════════════════ */

const KEY = "ph3d_sanity_v1";
const ROGUE_AT = 85;        /* episodes can start from here */
const WARN_AT  = 70;        /* "your mind is slipping" toast */
const CALM_EMOTES = new Set(["pray", "eat", "meditate", "sit_ground", "lean_table"]);

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

let _v = 12;
try { const r = parseFloat(localStorage.getItem(KEY)); if (isFinite(r)) _v = clamp(r, 0, 100); } catch (e) {}

let _lastHp = null, _saveT = 0, _warnCd = 0;
let _ep = null;             /* current episode { mode, t, a, ax } */
let _epCd = 4;              /* seconds until an episode may start */
let _vig = null;

function _ensureVignette() {
  if (_vig || typeof document === "undefined") return;
  _vig = document.createElement("div");
  _vig.id = "sanity-vignette";
  document.body.appendChild(_vig);
}

export const Sanity = {
  get value() { return _v; },
  get rogueActive() { return !!_ep; },

  add(d) { _v = clamp(_v + d, 0, 100); },
  set(v) { _v = clamp(v, 0, 100); },

  /* Called every frame by the player controller with the player's
     own input (f = forward, s = strafe). Returns null normally, or
     { f, s, run } to override the input while a rogue episode runs. */
  rogue(dt, ctl, f, s) {
    this._drive(dt, ctl, f, s);
    if (!_ep) return null;
    _ep.t -= dt;
    if (_ep.t <= 0) { _ep = null; _v = Math.max(0, _v - 14); return null; }
    if (_ep.mode === "inverted") {
      const hasInput = Math.hypot(f, s) > 0.05;
      return hasInput ? { f: -f, s: -s, run: false }
                      : { f: 0, s: 0, run: false };
    }
    /* wander: slowly curving random heading */
    _ep.a += (Math.random() - 0.5) * 2.4 * dt;
    return { f: Math.cos(_ep.a), s: Math.sin(_ep.a), run: true };
  },

  _drive(dt, ctl, f, s) {
    const C = window.__ph3d_combat, Cr = window.__ph3d_crime;
    let rate = -0.25;                                   /* slow natural calm */

    if (C && typeof C.hp === "number") {
      if (_lastHp != null && C.hp < _lastHp) _v += (_lastHp - C.hp) * 0.6;   /* hurt */
      _lastHp = C.hp;
      if (C.hp / (C.maxHp || 100) < 0.3) rate += 0.45;
    }
    if (Cr && Cr.alert >= 40) rate += 0.7 * (Cr.alert / 100);
    try { if (ctl.weapons && ctl.weapons.isArmed && ctl.weapons.isArmed()) rate += 0.25; } catch (e) {}

    const st = ctl.state;
    const calmEmote = ctl._emoteTimer > 0 && CALM_EMOTES.has(ctl._emoteName);
    if (calmEmote || st === "sitting" || st === "seated" || st === "lying" || st === "kneel" || st === "bathing") rate -= 2.6;
    else if (Math.hypot(f, s) < 0.05) rate -= 0.5;

    _v = clamp(_v + rate * dt, 0, 100);

    /* warnings + episodes */
    _warnCd -= dt;
    if (_v >= WARN_AT && _warnCd <= 0 && !_ep) { toast("🧠 Your mind is slipping — sit down and calm yourself"); _warnCd = 25; }
    _epCd -= dt;
    if (!_ep && _v >= ROGUE_AT && _epCd <= 0 && (st === "standing" || st === "crouching")) {
      _ep = { mode: Math.random() < 0.55 ? "wander" : "inverted", t: 2 + Math.random() * 1.8, a: Math.random() * Math.PI * 2 };
      _epCd = 7 + Math.random() * 6;
      toast(_ep.mode === "wander" ? "😵 You lose control of your body!" : "😵 Your controls feel reversed!");
    }

    /* screen vignette */
    _ensureVignette();
    if (_vig) _vig.style.opacity = String(clamp((_v - 55) / 45, 0, 0.9) * (_ep ? 1 : 0.75));

    _saveT -= dt;
    if (_saveT <= 0) { _saveT = 5; try { localStorage.setItem(KEY, _v.toFixed(1)); } catch (e) {} }
  },
};

if (typeof window !== "undefined") window.__ph3d_sanity = Sanity;
