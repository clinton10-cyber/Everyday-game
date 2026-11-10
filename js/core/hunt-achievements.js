const KEY = "ph3d.hunt.ach.v1";
const toast = (m)=>{ try{ window.__ph3d_phone?._toast(m); }catch(e){} };
const DEFS = [
  { id:"first_blood", label:"FIRST BLOOD", desc:"Complete any hunt.", cond:h=>(h.wins||0)>=1 },
  { id:"survivor", label:"SURVIVOR", desc:"Complete 5 hunts.", cond:h=>(h.wins||0)>=5 },
  { id:"fully_loaded", label:"FULLY LOADED", desc:"Earn ₦10M+ in a single hunt.", cond:h=>(h.biggest_payout||0)>=10000000 },
  { id:"master", label:"MASTER'S GAME", desc:"Survive the full 24-hour contract.", cond:h=>(h.master_wins||0)>=1 },
  { id:"streak_3", label:"STREAK", desc:"Win 3 hunts in a row without dying.", cond:h=>(h.best_streak||0)>=3 },
  { id:"no_scratch", label:"NO SCRATCH", desc:"Survive a hunt with 100% HP.", cond:h=>(h.perfect_hp_wins||0)>=1 },
  { id:"leaderboard_top", label:"KING OF THE HILL", desc:"Reach #1 on the leaderboard.", cond:h=>h.leaderboard_rank===1 },
];
function load(){ try{ const r=localStorage.getItem(KEY); return r?JSON.parse(r):{unlocked:[],stats:{}}; }catch(e){ return {unlocked:[],stats:{}}; } }
function save(d){ try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){} }
export const HuntAchievements = {
  all(){ return DEFS; },
  unlocked(){ return load().unlocked || []; },
  stats(){ return load().stats || {}; },
  recordState(fields){ const d=load(); d.stats=Object.assign({}, d.stats||{}, fields); save(d); },
  /* Evaluates against persisted stats (single source of truth) */
  evaluate(){
    const d = load();
    const un = new Set(d.unlocked||[]);
    const before = un.size;
    for (const def of DEFS) {
      if (un.has(def.id)) continue;
      try { if (def.cond(d.stats||{})) { un.add(def.id); toast(`🏅 ${def.label} · ${def.desc}`); } } catch(e){}
    }
    d.unlocked = [...un]; save(d);
    if (un.size > before) window.dispatchEvent(new CustomEvent("ph3d:hunt-achievement-unlocked"));
  },
  /* Called by Hunt on win / cashout / death */
  onResult(kind, tier, payout, hpPct){
    const s = this.stats();
    const n = {};
    if (kind === "win") {
      n.wins = (s.wins||0)+1;
      n.master_wins = (s.master_wins||0)+(tier.id==="master"?1:0);
      n.perfect_hp_wins = (s.perfect_hp_wins||0)+(hpPct>=0.999?1:0);
      n.streak = (s.streak||0)+1;
      n.best_streak = Math.max(s.best_streak||0, n.streak);
    } else { n.streak = 0; }
    n.biggest_payout = Math.max(s.biggest_payout||0, payout||0);
    this.recordState(n);
    this.evaluate();
  },
};
