/* js/core/engagement.js -- single source of truth for XP, skills, streak, achievements,
   owned phones, goals and collections. Other modules call Engagement.track(); they do not
   write state directly (market-shop and phone shop use the small helper methods below). */
import { CFG } from "./engagement-config.js";

const KEY = "ph3d.engagement.v1";

function empty() {
  return {
    v: 1, xp: 0, level: 1,
    skills: { fighting: 0, driving: 0, charisma: 0, photography: 0, hustle: 0 },
    streak: { days: 0, lastDayKey: "" },
    achievements: [],
    phones: { owned: [], active: null, airtime: 0, dataMb: 0, accessories: [] },
    goals: { daily: [], weekly: [], life: [], at: { daily: "", weekly: "" } },
    collections: { phones: {}, outfits: {}, trophies: {}, mile1: {} },
    counters: { robberies: 0, robberiesCaught: 0, photosTaken: 0, scenesVisited: 0, moneyEarned: 0, jobsDone: 0, marketBuys: 0, befriended: 0 },
    flags: {},
  };
}
function merge(base, o) {
  for (const k of Object.keys(base)) {
    if (o[k] === undefined) o[k] = base[k];
    else if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], o[k]);
  }
  return o;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const o = JSON.parse(raw);
    return (o && o.v === 1) ? merge(empty(), o) : empty();
  } catch (e) { return empty(); }
}

const pad = (n) => String(n).padStart(2, "0");
const dayKeyOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const dayKey = () => dayKeyOf(new Date());
function weekKey() {
  const d = new Date(); const dow = (d.getDay() + 6) % 7;   /* Monday start */
  d.setDate(d.getDate() - dow); return dayKeyOf(d);
}
const dayNum = (k) => { const p = k.split("-").map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 864e5); };
const xpForLevel = (n) => (n <= 1 ? 0 : Math.round(CFG.xp.base * Math.pow(n - 1, CFG.xp.pow)));
function levelForXp(xp) { let n = 1; while (n < CFG.xp.max && xp >= xpForLevel(n + 1)) n++; return n; }
function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
const toast = (m) => { try { window.__ph3d_phone && window.__ph3d_phone._toast(m); } catch (e) {} };

export const Engagement = {
  state: load(),
  _subs: new Set(),
  _toastQueue: [],

  load() {
    this.state = load();
    this._refreshStreak();
    this._ensureGoals();
    this._evalGoals();
    this._emit();
    return this.state;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) {} },
  onChange(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  _emit() { for (const fn of this._subs) { try { fn(this.state); } catch (e) {} } },

  /* ---- derived ---- */
  levelProgress() {
    const s = this.state, a = xpForLevel(s.level), b = xpForLevel(s.level + 1);
    return { level: s.level, xp: s.xp, into: s.xp - a, need: Math.max(1, b - a) };
  },
  skillTier(name) {
    const v = this.state.skills[name] || 0, t = CFG.tiers;
    for (let i = t.length - 1; i >= 0; i--) if (v >= t[i]) return i;
    return 0;
  },
  ownsPhone(id) { return this.state.phones.owned.includes(id); },
  /* heat multiplier applied to robbery heat (juju amulet from Mile 1) */
  heatMult() { return this.state.flags.jujuProtection ? 1 - CFG.jujuHeatReduce : 1; },

  /* ---- phones (called by the phone shop) ---- */
  addPhone(id) {
    const p = this.state.phones;
    if (!p.owned.includes(id)) p.owned.push(id);
    p.active = id;
    this.state.collections.phones[id] = true;
    this.track("phone_bought", { id });
  },
  removePhone(id) {
    const p = this.state.phones;
    p.owned = p.owned.filter((x) => x !== id);
    if (p.active === id) p.active = p.owned[p.owned.length - 1] || null;
    this.save(); this._emit();
  },
  /* ---- small helpers used by shops ---- */
  collect(set, id) { (this.state.collections[set] = this.state.collections[set] || {})[id] = true; this._evalGoals(); this._checkAchievements(); this.save(); this._emit(); },
  setFlag(name, v) { this.state.flags[name] = v === undefined ? true : v; this._checkAchievements(); this.save(); this._emit(); },

  addAirtime(n) { this.state.phones.airtime += n; this.save(); this._emit(); },
  addData(mb) { this.state.phones.dataMb += mb; this.save(); this._emit(); },

  /* ---- the entry point ---- */
  track(name, payload) {
    payload = payload || {};
    const s = this.state, c = s.counters;
    switch (name) {
      case "scene_visited": c.scenesVisited++; break;
      case "money_earned": {
        const amt = Math.max(0, payload.amount || 0);
        c.moneyEarned += amt; this._addXp(Math.min(200, Math.floor(amt / 500))); this._addSkill("hustle", 2); break;
      }
      case "photo_taken": c.photosTaken++; this._addXp(6); this._addSkill("photography", CFG.skills.photography.per); break;
      case "job_done": c.jobsDone++; this._addXp(25); this._addSkill("hustle", 4); break;
      case "npc_befriended": c.befriended++; this._addXp(8); this._addSkill("charisma", 3); break;
      case "fight_won": this._addXp(15); this._addSkill("fighting", CFG.skills.fighting.per); break;
      case "drive_km": this._addSkill("driving", CFG.skills.driving.per); break;
      case "market_purchase": c.marketBuys++; this._addXp(payload.kind === "collectible" ? 20 : 5); if (payload.kind === "collectible") this._addSkill("charisma", 1); break;
      case "phone_bought": this._addXp(40); break;
      case "robbery_done":
        c.robberies++; if (payload.caught) c.robberiesCaught++;
        this._addXp(payload.caught ? 5 : 35); this._addSkill("hustle", payload.caught ? 1 : 5);
        if (payload.payout && !payload.caught) c.moneyEarned += payload.payout;
        break;
      default: break;
    }
    this._evalGoals();
    this._checkAchievements();
    this.save(); this._emit();
  },

  _addXp(n) {
    n = Math.floor(n); if (n <= 0) return;
    const s = this.state, before = s.level;
    s.xp += n; s.level = levelForXp(s.xp);
    if (s.level > before) toast("Level " + s.level);
  },
  _addSkill(name, n) {
    const cap = (CFG.skills[name] && CFG.skills[name].max) || 100;
    const s = this.state.skills, was = this.skillTier(name);
    s[name] = Math.min(cap, (s[name] || 0) + n);
    if (this.skillTier(name) > was) toast(name[0].toUpperCase() + name.slice(1) + " tier " + this.skillTier(name));
  },
  _checkAchievements() {
    const s = this.state;
    for (const a of CFG.achievements) {
      if (s.achievements.includes(a.id)) continue;
      let ok = false; try { ok = !!a.test(s.counters, s); } catch (e) {}
      if (ok) { s.achievements.push(a.id); this._addXp(50); toast("Achievement: " + a.name); }
    }
  },

  /* ---- streak: a missed day pauses it, it never resets ---- */
  _refreshStreak() {
    const st = this.state.streak, today = dayKey();
    if (st.lastDayKey === today) return;
    if (!st.lastDayKey) st.days = 1;
    else if (dayNum(today) - dayNum(st.lastDayKey) === 1) st.days++;
    /* gap > 1 day: days stays as is (paused) */
    st.lastDayKey = today;
    this._addXp(CFG.streak.xpPerDay * Math.min(Math.max(1, st.days), CFG.streak.cap));
    this.save();
  },

  /* ---- goals ---- */
  _value(key) {
    const s = this.state;
    if (key === "phonesOwned") return s.phones.owned.length;
    if (key === "mile1Items") return Object.keys(s.collections.mile1 || {}).length;
    return s.counters[key] || 0;
  },
  _pick(pool, n, seed) {
    const r = seeded(seed), a = pool.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, Math.min(n, a.length));
  },
  _mk(g, abs) { return { id: g.id, text: g.text, key: g.key, target: g.target, xp: g.xp, base: abs ? 0 : this._value(g.key), done: false }; },
  _ensureGoals() {
    const g = this.state.goals, d = dayKey(), w = weekKey();
    if (g.at.daily !== d) { g.daily = this._pick(CFG.goalPool.daily, CFG.dailyCount, "d" + d).map((x) => this._mk(x)); g.at.daily = d; }
    if (g.at.weekly !== w) { g.weekly = this._pick(CFG.goalPool.weekly, CFG.weeklyCount, "w" + w).map((x) => this._mk(x)); g.at.weekly = w; }
    if (!g.life.length) g.life = CFG.goalPool.life.map((x) => this._mk(x, true));
  },
  progressOf(goal) { return Math.min(goal.target, Math.max(0, this._value(goal.key) - goal.base)); },
  _evalGoals() {
    this._ensureGoals();
    const g = this.state.goals;
    for (const list of [g.daily, g.weekly, g.life]) for (const x of list) {
      if (!x.done && this.progressOf(x) >= x.target) { x.done = true; this._addXp(x.xp); toast("Goal done: " + x.text); }
    }
  },
};

window.__ph3d_engagement = Engagement;
