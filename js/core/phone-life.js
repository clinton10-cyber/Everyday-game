/* Phone battery, charging and mobile-data simulation. Game-only resources. */
import { Engagement } from "./engagement.js";
import { Economy } from "./economy.js";
import { PHONE_BY_ID } from "../data/phone-models.js";

const KEY = "ph3d.phone-life.v1";
const read = () => { try { return Object.assign({ battery: 100, lastAt: Date.now(), posts: 0, likes: 0, feed: [] }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { return { battery: 100, lastAt: Date.now(), posts: 0, likes: 0, feed: [] }; } };
const state = read();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };
const toast = (m) => { try { window.__ph3d_phone?._toast(m); } catch (_) {} };

export const PhoneLife = {
  state,
  /* Bigger batteries last longer: 5000 mAh = 1x, 3000 mAh phones drain faster. */
  drainFactor() {
    try {
      const m = PHONE_BY_ID[Engagement.state.phones.active];
      const mah = parseInt(String(m && m.specs && m.specs.battery || "").replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(mah) && mah > 0) return Math.max(0.7, Math.min(1.7, 5000 / mah));
    } catch (_) {}
    return 1;
  },
  isDead() { return !!Engagement.state.phones.active && Number(state.battery) <= 0; },
  /* idle drain ~10% per real hour (offline catch-up capped at 3 h so you never return to a corpse) */
  tick() {
    const now = Date.now(), elapsed = Math.max(0, Math.min(180, (now - (state.lastAt || now)) / 60000));
    if (Engagement.state.phones.active) this._lose(elapsed / 6 * this.drainFactor());
    state.lastAt = now; save(); return this.snapshot();
  },
  /* usage drain: screen-on time, opening apps, posting... */
  drain(pct) {
    if (!Engagement.state.phones.active) return state.battery;
    this._lose(Math.max(0, Number(pct) || 0) * this.drainFactor());
    save(); return state.battery;
  },
  _lose(pct) {
    if (!(pct > 0)) return;
    const before = state.battery;
    state.battery = Math.max(0, before - pct);
    const crossed = (t) => before > t && state.battery <= t;
    if (state.battery <= 0 && before > 0) {
      toast("\uD83D\uDD0B Your phone just died. Pay for a charge to turn it back on.");
      try { window.dispatchEvent(new CustomEvent("ph3d:phone-dead")); } catch (_) {}
    } else if (crossed(5)) toast("\uD83D\uDD0B Battery critical \u00b7 5% left");
    else if (crossed(10)) toast("\uD83D\uDD0B Battery low \u00b7 10% left");
    else if (crossed(20)) toast("\uD83D\uDD0B Battery at 20% \u00b7 charge soon");
  },
  snapshot() { this.tickTimeOnly(); return { battery: Math.round(state.battery), dataMb: Math.max(0, Math.floor(Engagement.state.phones.dataMb || 0)), airtime: Math.max(0, Math.floor(Engagement.state.phones.airtime || 0)) }; },
  tickTimeOnly() { if (!Number.isFinite(state.battery)) state.battery = 100; state.battery = Math.max(0, Math.min(100, state.battery)); },
  charge(pack) {
    const offers = { small: { cost: 300, amount: 25 }, emergency: { cost: 500, amount: 30 }, full: { cost: 900, amount: 100 } }, p = offers[pack];
    if (!p) return { ok: false, reason: "pack" };
    if (!Engagement.state.phones.active) return { ok: false, reason: "no_phone" };
    if (state.battery >= 100) return { ok: false, reason: "full" };
    if (!Economy.withdraw(p.cost)) return { ok: false, reason: "funds" };
    const wasDead = state.battery <= 0; state.battery = Math.min(100, state.battery + p.amount); state.lastAt = Date.now(); save();
    if (wasDead) { try { window.dispatchEvent(new CustomEvent("ph3d:phone-revived")); } catch (_) {} }
    return { ok: true, battery: Math.round(state.battery), amount: p.amount };
  },
  useData(mb) {
    mb = Math.max(0, Math.ceil(Number(mb) || 0)); const p = Engagement.state.phones;
    if (!p.active) return { ok: false, reason: "no_phone" };
    if ((p.dataMb || 0) < mb) return { ok: false, reason: "data" };
    p.dataMb -= mb; Engagement.save(); Engagement._emit(); return { ok: true, remaining: p.dataMb };
  },
  socialPost(text) {
    const body = String(text || "").trim().slice(0, 180); if (!body) return { ok: false, reason: "empty" };
    const r = this.useData(5); if (!r.ok) return r;
    state.posts++; state.feed = Array.isArray(state.feed) ? state.feed : []; state.feed.unshift({ text: body, time: Date.now() }); state.feed = state.feed.slice(0, 20); save(); return { ok: true, text: body, posts: state.posts };
  },
  like() { const r = this.useData(1); if (!r.ok) return r; state.likes++; save(); return { ok: true, likes: state.likes }; },
  selectPhone(id) {
    if (!Engagement.ownsPhone(id)) return false;
    Engagement.state.phones.active = id; Engagement.save(); Engagement._emit(); return true;
  }
};
