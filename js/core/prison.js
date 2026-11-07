/**
 * Prison - jail timer + bail.
 *
 * Public API:
 *   Prison.sentence(reason)  - start a sentence
 *   Prison.tick(dt)          - call every frame
 *   Prison.payBail()         - pay and walk free
 *   Prison.bailCost()        - how much bail costs
 */

import { Economy } from "./economy.js";
import { Wardrobe } from "./wardrobe.js";

/* ── Jail clothes ───────────────────────────────────────────────
   Pre-arrest outfit kept in localStorage so a page reload mid-sentence
   can't leave the player stuck in orange.
   Jail state is also persisted so a reload during a sentence resumes it
   (player can't escape jail by refreshing). */
const LOOK_KEY      = "ph3d.prearrestLook.v1";
const JAIL_STATE_KEY = "ph3d.jailState.v1";
const JAIL_LOOK = {
  topStyle: "longsleeve", topColor: 10, topPattern: "solid",
  bottomStyle: "jeans",   bottomColor: 8, bottomPattern: "solid",
  shoeStyle: "sneakers",  shoeColor: 0,
  hat: null, glasses: null, tie: "none",
};
function _applyLook(look) {
  try {
    Object.keys(look).forEach((k) => { try { Wardrobe.set(k, look[k]); } catch (e) {} });
  } catch (e) {}
}
function _putOnJailClothes() {
  try {
    if (!localStorage.getItem(LOOK_KEY)) {
      localStorage.setItem(LOOK_KEY, JSON.stringify(Wardrobe.config));
    }
  } catch (e) {}
  _applyLook(JAIL_LOOK);
}
function _restoreClothes() {
  try {
    const raw = localStorage.getItem(LOOK_KEY);
    if (!raw) return;
    _applyLook(JSON.parse(raw));
    localStorage.removeItem(LOOK_KEY);
  } catch (e) {}
}

/* ── Reload safety ──────────────────────────────────────────────
   Check if the player was mid-sentence when the page reloaded.
   If the sentence hasn't expired yet, resume it and reroute to the
   prison scene.  If it expired while offline, just restore clothes. */
let _reloadTimeLeft = 0;
try {
  const raw = localStorage.getItem(JAIL_STATE_KEY);
  if (raw) {
    const s = JSON.parse(raw);
    const remaining = s && s.until ? (s.until - Date.now()) / 1000 : 0;
    if (remaining > 0) {
      /* Sentence still active — will be picked up by Prison.inJail below */
      _reloadTimeLeft = remaining;
    } else {
      /* Sentence expired offline — free the player */
      _restoreClothes();
      try { localStorage.removeItem(JAIL_STATE_KEY); } catch (e) {}
    }
  } else {
    /* No jail state saved — restore clothes in case of a prior crash */
    _restoreClothes();
  }
} catch (e) { _restoreClothes(); }

const BAIL      = 500000;
const JAIL_TIME = 90;

export const Prison = {
  inJail:   _reloadTimeLeft > 0,
  timeLeft: _reloadTimeLeft,
  reason:   "",
  _onEnd: null, _onTick: null,

  bailCost() { return BAIL; },

  sentence(reason) {
    if (this.inJail) return false;
    this.inJail   = true;
    this.timeLeft = JAIL_TIME;
    this.reason   = reason || "CRIME";
    _putOnJailClothes();
    try {
      localStorage.setItem(JAIL_STATE_KEY, JSON.stringify({
        until: Date.now() + JAIL_TIME * 1000,
        reason: this.reason,
      }));
    } catch (e) {}
    if (window.__ph3d_phone) window.__ph3d_phone._toast("SENTENCED - " + JAIL_TIME + "s");
    return true;
  },

  payBail() {
    if (!this.inJail) return { ok:false, reason:"not_in_jail" };
    if (Economy.balance < BAIL) return { ok:false, reason:"over_balance" };
    Economy.withdraw(BAIL);
    this.release();
    return { ok:true };
  },

  /* Router asks this before every navigation.  While serving, only the
     prison scene itself and the __release__ sentinel are allowed. */
  canLeaveTo(targetName) {
    if (!this.inJail) return true;
    return targetName === "prisonScene" || targetName === "__release__";
  },

  release() {
    const wasJailed = this.inJail;
    this.inJail = false; this.timeLeft = 0; this.reason = "";
    _restoreClothes();
    try { localStorage.removeItem(JAIL_STATE_KEY); } catch (e) {}
    /* Walk out through the sentinel, which the router sends to the city. */
    try {
      const r = window.__ph3d_router;
      if (wasJailed && r && r.current && r.current.sceneId === "statejail") {
        r.go("__release__");
      }
    } catch (e) {}
    if (window.__ph3d_phone) window.__ph3d_phone._toast("RELEASED");
    this._onEnd && this._onEnd();
  },

  tick(dt) {
    if (!this.inJail) return;
    this.timeLeft -= dt;
    /* Keep localStorage in sync so a reload mid-tick sees the updated time */
    if (Math.round(this.timeLeft) % 5 === 0) {
      try {
        localStorage.setItem(JAIL_STATE_KEY, JSON.stringify({
          until: Date.now() + this.timeLeft * 1000,
          reason: this.reason,
        }));
      } catch (e) {}
    }
    this._onTick && this._onTick(this.timeLeft);
    if (this.timeLeft <= 0) this.release();
  },

  /* Reroute to prison scene after a reload-resumed sentence.
     Call this once the router is ready (e.g. from main.js). */
  resumeIfNeeded() {
    if (!this.inJail) return;
    setTimeout(() => {
      try {
        const r = window.__ph3d_router;
        if (r && r.go && (!r.current || r.current.sceneId !== "statejail")) {
          r.go("prisonScene");
        }
      } catch (e) {}
    }, 1500);
  },

  onEnd(fn)  { this._onEnd  = fn; },
  onTick(fn) { this._onTick = fn; },
};

