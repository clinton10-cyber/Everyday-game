/* The Hunt — one active run at a time. Emits window events. */
import { Economy } from "./economy.js";
import { Crime } from "./crime.js";
import { Sfx } from "./sfx.js";
import { HUNT_TIERS } from "./hunt-contracts.js";
import { NPCs } from "./npcs.js";
import { Rep } from "./rep.js";
import { Pursuit } from "./pursuit.js";
const pick=(a)=>a[Math.floor(Math.random()*a.length)];

const STORE_KEY = "ph3d.hunt.v1";
const RESUME_WINDOW_MS = 6*60*1000;
const toast = (m)=>{ try{ window.__ph3d_phone?._toast(m); }catch(e){} };
const emit = (n,d)=>window.dispatchEvent(new CustomEvent(n,{detail:d}));
const lb = (tier,amt,why)=>import("./hunt-leaderboard.js").then(m=>m.HuntLeaderboard.record(tier.id,amt,why)).catch(()=>{});
const ach = (kind,tier,amt)=>{
  let hp = 1;
  try { const c=window.__ph3d_combat; if (c && c.hp!=null && c.maxHp) hp = c.hp/c.maxHp; } catch(e){}
  import("./hunt-achievements.js").then(m=>m.HuntAchievements.onResult(kind,tier,amt,hp)).catch(()=>{});
};

export const Hunt = {
  active:false, tier:null, secondsSurvived:0, currentHour:0, prizePool:0,
  huntersAlive:0, _pingUntil:0,
  _tickIv:null, _spawnIv:null,

  start(tierId){
    if (this.active){ toast("A hunt is already running"); return {ok:false,reason:"already_active"}; }
    const tier = HUNT_TIERS[tierId];
    if (!tier) return {ok:false,reason:"bad_tier"};
    let rep = 100;
    try { rep = Rep.get(); } catch(e){ try{ rep = window.__ph3d_profile?.reputation ?? 100; }catch(_){} }
    if (rep < tier.requireReputation){ toast(`Needs ${tier.requireReputation} reputation`); return {ok:false,reason:"low_rep",need:tier.requireReputation}; }
    const drive = window.__ph3d_drive;
    if (!drive || drive.getMode() !== "walk"){ toast("Start the hunt from the street — exit any building first"); return {ok:false,reason:"not_in_world"}; }
    try { window.__ph3d_weapons?.select("knife"); } catch(e){}

    this.active=true; this.tier=tier; this.secondsSurvived=0; this.currentHour=0;
    this.prizePool=0; this.huntersAlive=0; this._pingUntil=0;

    toast(`🎯 ${tier.name} · survive ${tier.hours} hours`);
    try{ Sfx.play("notification_ping"); }catch(e){}
    try{ Crime.addEvent("contract",10,"You"); }catch(e){}
    emit("ph3d:hunt-start",{tier});
    this._startTimers(true);
    this._saveSnapshot();
    return {ok:true,tier};
  },

  _startTimers(fresh){
    const tier=this.tier;
    this._tickIv = setInterval(()=>this._tick(),1000);
    this._spawnIv = setInterval(()=>this._spawnHunter(), tier.realSecondsPerHour*2000);
    if (fresh) for (let i=0;i<Math.min(2,tier.hunters);i++) setTimeout(()=>this._spawnHunter(),800+i*1200);
  },

  _tick(){
    if (!this.active) return;
    this.secondsSurvived += 1;
    const tier=this.tier, hl=tier.realSecondsPerHour;
    if (this.secondsSurvived%5===0){ try{ Sfx.play("ui_tap",{vol:.22}); }catch(e){} }
    if (this.secondsSurvived % hl === 0){ this.currentHour += 1; this._settleHour(); }
    emit("ph3d:hunt-tick",{seconds:this.secondsSurvived,hourLengthSec:hl,prize:this.prizePool,currentHour:this.currentHour,totalHours:tier.hours});
    if (this.secondsSurvived%5===0) this._saveSnapshot();
    if (this.currentHour >= tier.hours) this._win();
  },

  _settleHour(){
    const tier=this.tier;
    const idx=Math.min(this.currentHour-1, tier.prizePerHour.length-1);
    this.prizePool += tier.prizePerHour[idx]||0;

    /* hourly location ping — hunters know exactly where you are for 15s */
    this._pingUntil = performance.now() + 15000;

    try{ Sfx.play("police_radio"); }catch(e){}
    try{ navigator.vibrate?.([80,40,80]); }catch(e){}
    toast(`⏱ Hour ${this.currentHour} survived · ₦${this.prizePool.toLocaleString()} · 📍 you are exposed`);
    emit("ph3d:hunt-hour",{hour:this.currentHour,prize:this.prizePool,pinged:true});
  },

  isPinged(){
    return this._pingUntil > performance.now();
  },

  _win(){
    const tier=this.tier;
    const total = tier.finalBonus || this.prizePool;
    try{ Economy.receive("THE HUNT",total,tier.name+" victory"); }catch(e){}
    let _wl = "";
    try{ Sfx.play("level_up"); _wl = Sfx.voiceText("level_up"); }catch(e){}
    toast(`🏆 ${_wl ? "\u201C" + _wl + "\u201D " : ""}SURVIVED! ₦${total.toLocaleString()}`);
    try{ navigator.vibrate?.([80,40,80,40,200]); }catch(e){}
    try{ Rep.add(10); }catch(e){}
    emit("ph3d:hunt-win",{prize:total,tier});
    lb(tier,total,"win"); ach("win",tier,total);
    this._end("win");
  },

  cashOut(){
    if (!this.active) return {ok:false,reason:"not_active"};
    const tier=this.tier;
    const penalty=this.prizePool*tier.cashOutPenalty;
    const payout=Math.floor(this.prizePool-penalty);
    if (payout>0){ try{ Economy.receive("THE HUNT",payout,tier.name+" cash out"); }catch(e){} }
    toast(`💰 CASHED OUT · ₦${payout.toLocaleString()}`);
    emit("ph3d:hunt-cashout",{prize:payout,penalty,tier});
    lb(tier,payout,"cashout"); ach("cashout",tier,payout);
    this._end("cashout");
    return {ok:true,payout,penalty};
  },

  onPlayerDeath(){
    if (!this.active) return;
    const tier=this.tier;
    toast("💀 You died. Prize lost.");
    try{ Sfx.pain("death", { vol: 0.95 }); }catch(e){}
    emit("ph3d:hunt-death",{tier});
    ach("death",tier,0);
    this._end("death");
  },

  _end(reason){
    const was=this.active;
    this.active=false;
    clearInterval(this._tickIv); clearInterval(this._spawnIv);
    this._tickIv=this._spawnIv=null;
    try{
      if (reason==="death") Pursuit.endAll(); else Pursuit.dismissHunters();
      for (const n of NPCs.list){ if (n._isHunter && !n.dead){ n.dead=true; n.state="dead"; n.deadT=19; } }
    }catch(e){}
    try{ localStorage.removeItem(STORE_KEY); }catch(e){}
    if (was) emit("ph3d:hunt-end",{reason});
  },

  _scene(){
    const drive=window.__ph3d_drive;
    return (drive && drive.scene && drive.scene.three) || window.__ph3d_router?.current?.three;
  },

  _spawnHunter(){
    if (!this.active) return;
    const drive=window.__ph3d_drive; if (!drive) return;
    const tier=this.tier, pos=drive.getPos();
    const a=Math.random()*Math.PI*2, d=45+Math.random()*30;
    const cfg={gender:Math.random()<0.5?"masculine":"feminine",skinTone:Math.floor(Math.random()*8),hairStyle:pick(["buzz","short","long"]),hairColor:Math.floor(Math.random()*11),topStyle:"jacket",topColor:pick([0,6,7]),topPattern:"solid",bottomStyle:"jeans",bottomColor:1,shoeStyle:"boots",shoeColor:0,hat:null,glasses:Math.random()<0.5?{style:"shades",color:0}:null};
    let npc=null;
    try{ npc=NPCs.spawnRole(this._scene(),"police",pos.x+Math.cos(a)*d,pos.z+Math.sin(a)*d,{forcedConfig:cfg}); }
    catch(e){ console.warn("[hunt] spawn hunter failed",e); return; }
    if (!npc) return;
    npc._isHunter=true; npc.maxDist=400;
    npc.hp=80+tier.hunterTier*40; npc.maxHp=npc.hp;
    /* Dodge's rule: hunters are melee-only, regardless of tier */
    npc.weapons={current:"knife"};
    /* hostile from the first frame: Pursuit takes over the body and attacks */
    try{ npc._cfg = npc._cfg || cfg; Pursuit.start(npc,{hunter:true}); }catch(e){ console.warn("[hunt] pursuit start failed",e); }
    this.huntersAlive += 1;
    toast("⚠ A hunter has entered the zone");
    try{ Sfx.play("police_whistle"); Sfx.play("knife_slash"); }catch(e){}
    try{ navigator.vibrate?.(120); }catch(e){}
    emit("ph3d:hunt-hunter-spawned",{huntersAlive:this.huntersAlive});
  },

  _saveSnapshot(){
    if (!this.active){ try{ localStorage.removeItem(STORE_KEY); }catch(e){} return; }
    try{ localStorage.setItem(STORE_KEY,JSON.stringify({tierId:this.tier.id,seconds:this.secondsSurvived,currentHour:this.currentHour,prize:this.prizePool,savedAt:Date.now()})); }catch(e){}
  },

  tryResume(){
    let snap=null;
    try{ snap=JSON.parse(localStorage.getItem(STORE_KEY)||"null"); }catch(e){}
    if (!snap) return {ok:false};
    const drop=(r)=>{ try{ localStorage.removeItem(STORE_KEY); }catch(e){} return {ok:false,reason:r}; };
    if (Date.now()-snap.savedAt > RESUME_WINDOW_MS) return drop("expired");
    const tier=HUNT_TIERS[snap.tierId];
    if (!tier) return drop("bad_tier");
    this.active=true; this.tier=tier;
    this.secondsSurvived=snap.seconds||0; this.currentHour=snap.currentHour||0;
    this.prizePool=snap.prize||0; this.huntersAlive=0; this._pingUntil=0;
    toast(`⏸ Resuming ${tier.name}…`);
    emit("ph3d:hunt-start",{tier});
    this._startTimers(false);
    return {ok:true,tier};
  },

  getState(){
    if (!this.active) return null;
    return {tier:this.tier,seconds:this.secondsSurvived,hour:this.currentHour,totalHours:this.tier.hours,prize:this.prizePool,huntersAlive:this.huntersAlive};
  },
};
window.__ph3d_hunt = Hunt;
