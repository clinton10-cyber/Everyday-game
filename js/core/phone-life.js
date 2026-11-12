/* Phone battery, charging and mobile-data simulation. Game-only resources. */
import { Engagement } from "./engagement.js";
import { Economy } from "./economy.js";

const KEY = "ph3d.phone-life.v1";
const read = () => { try { return Object.assign({ battery: 100, lastAt: Date.now(), posts: 0, likes: 0, feed: [] }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (_) { return { battery: 100, lastAt: Date.now(), posts: 0, likes: 0, feed: [] }; } };
const state = read();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };
const toast = (m) => { try { window.__ph3d_phone?._toast(m); } catch (_) {} };

export const PhoneLife = {
  state,
  tick() {
    const now = Date.now(), elapsed = Math.max(0, Math.min(24 * 60, (now - (state.lastAt || now)) / 60000));
    if (Engagement.state.phones.active) state.battery = Math.max(0, state.battery - elapsed / 20);
    state.lastAt = now; save(); return this.snapshot();
  },
  snapshot() { this.tickTimeOnly(); return { battery: Math.round(state.battery), dataMb: Math.max(0, Math.floor(Engagement.state.phones.dataMb || 0)), airtime: Math.max(0, Math.floor(Engagement.state.phones.airtime || 0)) }; },
  tickTimeOnly() { if (!Number.isFinite(state.battery)) state.battery = 100; state.battery = Math.max(0, Math.min(100, state.battery)); },
  charge(pack) {
    const offers = { small: { cost: 300, amount: 25 }, full: { cost: 900, amount: 100 } }, p = offers[pack];
    if (!p) return { ok: false, reason: "pack" };
    if (!Engagement.state.phones.active) return { ok: false, reason: "no_phone" };
    if (state.battery >= 100) return { ok: false, reason: "full" };
    if (!Economy.withdraw(p.cost)) return { ok: false, reason: "funds" };
    state.battery = Math.min(100, state.battery + p.amount); state.lastAt = Date.now(); save();
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
