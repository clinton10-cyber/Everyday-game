/* js/core/robbery.js -- robbery engine. UI lives in ui/robbery-ui.js.
   Scenes register targets with Robbery.registerTarget({ id, kind, x, z, scene, label, r }).
   Flow: start() -> "robbing" (duration) -> payout + heat -> "escape" (leave the area/scene in time) -> done or caught.
   Everything is tuned in engagement-config.js. If Engagement fails to load, payout and heat still apply. */
import { CFG } from "./engagement-config.js";
import { Economy } from "./economy.js";
import { Crime } from "./crime.js";
import { Combat } from "./combat.js";
import { Prison } from "./prison.js";
import { Engagement } from "./engagement.js";

const KEY = "ph3d.robbery.cd.v1";
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };
const rand = (a, b) => a + Math.random() * (b - a);

function loadCd() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }

export const Robbery = {
  targets: new Map(),
  active: null,          /* { t, cfg, phase: "robbing"|"escape", left, total, payout, alarm, hitBack } */
  cooldowns: loadCd(),
  _subs: new Set(),

  registerTarget(t) { if (t && t.id) this.targets.set(t.id, Object.assign({ r: 2.4 }, t)); },
  removeTarget(id) { this.targets.delete(id); },
  clearTargets(scene) { for (const [k, t] of this.targets) if (!scene || t.scene === scene) this.targets.delete(k); },
  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  _emit() { for (const fn of this._subs) { try { fn(this.active); } catch (e) {} } },

  playerPos() {
    const wc = window.__ph3d_walkCtrl;
    if (wc && wc.pos) return { x: wc.pos.x, z: wc.pos.z };
    try { const s = window.__ph3d_drive && window.__ph3d_drive.getPlayerState(); if (s) return { x: s.x, z: s.z }; } catch (e) {}
    return null;
  },
  sceneId() { const r = window.__ph3d_router; return (r && r.current && (r.current.sceneId || r.current._routeName)) || ""; },

  cooldownLeftMs(t) { return Math.max(0, (this.cooldowns[t.kind + ":" + t.id] || 0) - Date.now()); },
  canStart(t) {
    if (!t || this.active) return false;
    if (Prison && Prison.inJail) return false;
    return this.cooldownLeftMs(t) === 0;
  },
  nearest() {
    const p = this.playerPos(); if (!p) return null;
    let best = null, bd = Infinity;
    for (const t of this.targets.values()) {
      if (t.scene && t.scene !== this.sceneId()) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d <= t.r && d < bd) { bd = d; best = t; }
    }
    return best;
  },

  start(t) {
    if (!this.canStart(t)) return false;
    const cfg = CFG.robbery[t.kind]; if (!cfg) return false;
    const comply = Math.random() < cfg.comply;
    this.active = {
      t, cfg, phase: "robbing", left: cfg.duration, total: cfg.duration,
      payout: Math.round(rand(cfg.payout[0], cfg.payout[1])),
      alarm: Math.random() < cfg.alarm,
      hitBack: !comply && Math.random() < (cfg.fightBack / Math.max(0.01, 1 - cfg.comply)),
    };
    toast("Robbery started. Stay close until it finishes.");
    try { Crime.addEvent("attack", 10, "You"); } catch (e) {}
    this._emit();
    return true;
  },

  cancel(why) {
    const a = this.active; if (!a) return;
    this.active = null;
    this._setCd(a.t, 0.25);
    try { Crime.addEvent("escape", Math.round(a.cfg.heat * 0.4 * this._heatMult()), "You"); } catch (e) {}
    toast(why || "You backed off. Nothing taken.");
    this._emit();
  },

  _heatMult() { try { return Engagement.heatMult(); } catch (e) { return 1; } },
  _setCd(t, mult) { this.cooldowns[t.kind + ":" + t.id] = Date.now() + (mult || 1) * CFG.robbery[t.kind].cooldownH * 3600e3; try { localStorage.setItem(KEY, JSON.stringify(this.cooldowns)); } catch (e) {} },

  _payout(a) {
    let amt = a.payout;
    if (a.hitBack) { amt = Math.round(amt * 0.5); try { Combat.damage(15, a.t.label || "Cashier"); } catch (e) {} toast("They fought back. You got half."); }
    try { Economy.receive("ROBBERY", amt, a.t.kind); } catch (e) {}
    try { Crime.addEvent("takeItem", Math.round(a.cfg.heat * this._heatMult()), "You"); } catch (e) {}
    if (a.alarm) { try { Crime.addEvent("attack", Math.round(a.cfg.heat * 0.5 * this._heatMult()), "You"); } catch (e) {} toast("The alarm went off."); }
    a.paid = amt;
    toast("You took " + Economy.format(amt) + ". Get out.");
  },

  _escaped(a) {
    if (a.t.scene && this.sceneId() !== a.t.scene) return true;
    const p = this.playerPos(); if (!p) return true;
    return Math.hypot(a.t.x - p.x, a.t.z - p.z) > a.cfg.escapeRadius;
  },

  _finish(caught) {
    const a = this.active; this.active = null;
    this._setCd(a.t, 1);
    if (caught) {
      const fine = Math.min(Economy.balance, Math.round(Economy.balance * CFG.robberyCaughtFine));
      if (fine > 0) { try { Economy.robbed(fine, "POLICE"); } catch (e) {} }
      if (CFG.robberyCaughtToPrison) { try { Prison.sentence("ROBBERY"); } catch (e) {} }
      else toast("Caught. Fined " + Economy.format(fine) + ".");
    } else toast("Clean getaway.");
    try { Engagement.track("robbery_done", { kind: a.t.kind, payout: a.paid || 0, caught: !!caught }); } catch (e) {}
    this._emit();
  },

  tick(dt) {
    const a = this.active; if (!a) return;
    if (Prison && Prison.inJail) { this.active = null; this._emit(); return; }
    if (a.phase === "robbing") {
      const p = this.playerPos();
      if (p && Math.hypot(a.t.x - p.x, a.t.z - p.z) > a.t.r + 2.5) { this.cancel("You walked away. Nothing taken."); return; }
      a.left -= dt;
      if (a.left <= 0) { this._payout(a); a.phase = "escape"; a.left = a.total = CFG.robberyEscapeSeconds; }
    } else {
      if (this._escaped(a)) { this._finish(false); return; }
      a.left -= dt;
      if (a.left <= 0) this._finish(true);
    }
    this._emit();
  },
};
window.__ph3d_robbery = Robbery;
