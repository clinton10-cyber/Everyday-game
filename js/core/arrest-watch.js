/* arrest-watch.js — "police are on top of you" countdown.
   Any police car within RADIUS of the player starts a 10 s countdown.
   Out of range for ESCAPE_GRACE seconds cancels it. At 0 → onArrest().
   While counting, the player's top speed is capped (speedMultiplier()). */

import { Sfx } from "./sfx.js";
const RADIUS         = 6.0;
const ESCAPE_GRACE   = 1.5;
const COUNTDOWN_SECS = 10;
const SLOW_FACTOR    = 0.20;

let _opts = null, _counting = false, _remaining = 0, _outTimer = 0;
let _hud = null, _hudText = null, _hudBar = null;

function _buildHud() {
  if (_hud && document.body.contains(_hud)) return;
  _hud = document.createElement("div");
  _hud.id = "ph3d-arrest-hud";
  Object.assign(_hud.style, {
    position: "fixed", left: "50%",
    top: "calc(env(safe-area-inset-top, 0px) + 120px)",
    transform: "translateX(-50%)", zIndex: "29", minWidth: "220px",
    padding: "14px 22px 16px", borderRadius: "18px",
    background: "rgba(120,10,10,.94)", border: "1px solid rgba(255,120,120,.55)",
    color: "#fff5f5", font: "800 13px Inter, system-ui, sans-serif",
    letterSpacing: ".05em", textAlign: "center",
    boxShadow: "0 12px 30px rgba(0,0,0,.6), 0 0 0 2px rgba(255,60,60,.15)",
    opacity: "0", transition: "opacity .25s", pointerEvents: "none",
  });
  _hud.innerHTML = `
    <div style="font-size:10px;letter-spacing:.28em;color:#ffb0b0;text-transform:uppercase;margin-bottom:6px">SURRENDER OR RUN</div>
    <div style="display:flex;align-items:baseline;justify-content:center;gap:8px">
      <span style="font-size:12px;opacity:.8">Arrest in</span>
      <span id="ph3d-arrest-t" style="font-size:26px;font-weight:900;font-variant-numeric:tabular-nums">10.0</span>
      <span style="font-size:12px;opacity:.8">s</span>
    </div>
    <div style="height:4px;margin-top:10px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden">
      <div id="ph3d-arrest-bar" style="height:100%;width:100%;background:#ff5c5c;transition:width .1s linear"></div>
    </div>`;
  document.body.appendChild(_hud);
  _hudText = _hud.querySelector("#ph3d-arrest-t");
  _hudBar  = _hud.querySelector("#ph3d-arrest-bar");
}

function _updateHud() {
  if (!_hudText || !_hudBar) return;
  const r = Math.max(0, _remaining);
  _hudText.textContent = r.toFixed(1);
  _hudBar.style.width = (r / COUNTDOWN_SECS) * 100 + "%";
}

export const ArrestWatch = {
  init(opts) { _opts = opts; _buildHud(); },

  /* Remove the HUD and drop callbacks (call on scene teardown) */
  destroy() {
    this.cancel();
    if (_hud && _hud.parentNode) _hud.parentNode.removeChild(_hud);
    _hud = _hudText = _hudBar = null;
    _opts = null;
  },

  isCounting() { return _counting; },
  remaining()  { return _remaining; },
  speedMultiplier() { return _counting ? SLOW_FACTOR : 1.0; },

  tick(dt) {
    if (!_opts) return;
    /* No countdown while already in jail */
    if (window.__ph3d_prison && window.__ph3d_prison.inJail) { this.cancel(); return; }
    const player = _opts.getPlayer && _opts.getPlayer();
    if (!player) { this.cancel(); return; }

    const cars = _opts.getPoliceCars ? _opts.getPoliceCars() : [];
    let inRange = false, nearest = null, nearestD = Infinity;
    for (const pc of cars) {
      if (!pc || !pc.mesh) continue;
      const d = Math.hypot(pc.mesh.position.x - player.x, pc.mesh.position.z - player.z);
      if (d < nearestD) { nearestD = d; nearest = pc; }
    }
    if (nearestD < RADIUS) inRange = true;

    if (!_counting) {
      if (inRange) {
        _counting = true; _remaining = COUNTDOWN_SECS; _outTimer = 0;
        if (_hud) _hud.style.opacity = "1";
        _updateHud();
      }
      return;
    }

    if (inRange) {
      _outTimer = 0;
      _remaining -= dt;
      if (_remaining <= 0) {
        this.cancel();
        try {
          Sfx.play("handcuff_click");
          setTimeout(() => { try { Sfx.pain("cry", { vol: 0.3 }); } catch (_) {} }, 1500);
          const _l = Sfx.voiceText("police_arrest");
          if (_l) window.__ph3d_phone && window.__ph3d_phone._toast("Officer: \u201C" + _l + "\u201D");
        } catch (_) {}
        if (_opts.onArrest) {
          try { _opts.onArrest(nearest); } catch (e) { console.warn("[arrest] onArrest failed:", e); }
        }
        return;
      }
      _updateHud();
    } else {
      _outTimer += dt;
      if (_outTimer >= ESCAPE_GRACE) this.cancel();
    }
  },

  cancel() {
    _counting = false; _remaining = 0; _outTimer = 0;
    if (_hud) _hud.style.opacity = "0";
  },
};

