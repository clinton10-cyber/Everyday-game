const KEY = "ph3d.hunt.lb.v1";
const MAX_ENTRIES = 25;
function load(){ try{ const r=localStorage.getItem(KEY); return r?JSON.parse(r):[]; }catch(e){ return []; } }
function save(l){ try{ localStorage.setItem(KEY, JSON.stringify(l.slice(0,MAX_ENTRIES))); }catch(e){} }
export const HuntLeaderboard = {
  entries(){ return load(); },
  record(tierId, payout, reason){
    if (!payout || payout <= 0) return;
    let name = "Player";
    try { const u = window.__ph3d_auth && window.__ph3d_auth.user; if (u && u.username) name = u.username; } catch(e){}
    const list = load();
    const p = Math.floor(payout);
    list.push({ name, tierId, payout:p, reason, at:Date.now() });
    list.sort((a,b)=>b.payout-a.payout);
    save(list);
    try {
      const rank = list.findIndex(e=>e.name===name && e.payout===p) + 1;
      import("./hunt-achievements.js").then(m=>{
        m.HuntAchievements.recordState({ leaderboard_rank: rank });
        m.HuntAchievements.evaluate();
      }).catch(()=>{});
    } catch(e){}
  },
  top(n){ return load().slice(0, n||10); },
  clear(){ save([]); },
};
