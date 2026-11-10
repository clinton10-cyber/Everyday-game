import { Sfx } from "./sfx.js";
export const Police={
  dispatched:false,timer:0,target:null,arrivalTime:30,
  dispatch(by){
    if(this.dispatched)return;
    this.dispatched=true;this.timer=0;this.target=by||"You";
    let line="";try{Sfx.play("police_whistle");line=Sfx.voiceText("police_stop");}catch(_){}
    const ui=window.__ph3d_phone;
    ui&&ui._toast("🚔 POLICE DISPATCHED · 30s");
    ui&&ui.notify("POLICE",(line?"\u201C"+line+"\u201D \u00b7 ":"")+"On the way to your location.");
  },
  update(dt){
    if(!this.dispatched)return;
    this.timer+=dt;
    if(this.timer>=this.arrivalTime){
      this.arrive();
    }
  },
  arrive(){
    this.dispatched=false;this.timer=0;
    /* Already arrested / in jail -> don't arrest twice */
    try { const P0=window.__ph3d_prison; if (P0 && P0.inJail) { this.target=null; return; } } catch(e){}
    const ui=window.__ph3d_phone;
    const name=this.target||"You";
    try {
      const isMe = !this.target || this.target === "you" || this.target === "You";
      const H = window.__ph3d_hunt, Cr = window.__ph3d_crime;
      if (isMe && H && !H.active && Cr && Cr.alert >= 70 && Math.random() < 0.4) {
        ui && ui._toast("🕶 A broker makes you an offer…");
        setTimeout(() => { try { ui?.showApp("hunt"); } catch (e) {} }, 900);
        try { Cr.reset(); } catch(e){}
        try { window.__ph3d_combat && window.__ph3d_combat.reset(); } catch(e){}
        this.target = null;
        return;
      }
    } catch (e) {}
    ui&&ui._toast("Police arrested "+name);
    ui&&ui.notify("ARRESTED",name+" has been taken into custody.");
    try {
      const isMe = !this.target || this.target === "you" || this.target === "You";
      if (isMe) {
        const P = window.__ph3d_prison;   /* was an unimported `Prison` -> ReferenceError */
        if (P && P.sentence) P.sentence("ARRESTED");
        const r = window.__ph3d_router;
        if (r && r.go) r.go("prisonScene");
      }
    } catch (e) { console.warn("[police] arrest nav failed", e); }
    try { if (window.__ph3d_crime)  window.__ph3d_crime.reset();  } catch(e){}
    try { if (window.__ph3d_combat) window.__ph3d_combat.reset(); } catch(e){}
    try { if (window.__ph3d_mp)     window.__ph3d_mp.chat("[POLICE] "+name+" was arrested."); } catch(e){}
    this.target=null;
  },
  cancel(){this.dispatched=false;this.timer=0;this.target=null;},
};

