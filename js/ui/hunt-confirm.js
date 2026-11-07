import { HUNT_TIERS } from "../core/hunt-contracts.js";
export function confirmHunt(tierId){
  const tier = HUNT_TIERS[tierId];
  if (!tier) return Promise.resolve(false);
  return new Promise((resolve)=>{
    const scrim = document.createElement("div");
    scrim.style.cssText = "position:fixed;inset:0;z-index:9991;display:flex;align-items:center;justify-content:center;background:rgba(10,2,2,.78);backdrop-filter:blur(6px);font-family:var(--h-font,Inter,system-ui,sans-serif)";
    const total = tier.finalBonus || tier.prizePerHour.reduce((a,b)=>a+b,0);
    scrim.innerHTML = `
      <div style="background:rgba(28,10,10,.98);border:1px solid rgba(255,69,58,.5);border-radius:24px;padding:26px 24px 20px;max-width:360px;width:92%;color:#fff5f5;text-align:left;box-shadow:0 24px 60px rgba(0,0,0,.85)">
        <div style="font-size:10px;letter-spacing:.28em;color:#ff9f0a;font-weight:900;margin-bottom:8px">CONTRACT OFFER</div>
        <div style="font-family:'Iowan Old Style',Georgia,serif;font-style:italic;font-size:26px;font-weight:600;line-height:1.05;color:#fff;margin-bottom:6px">${tier.name}</div>
        <div style="font-size:11px;color:rgba(255,245,245,.55);letter-spacing:.04em;margin-bottom:14px">${tier.tag}</div>
        <div style="font-size:12px;color:rgba(255,245,245,.8);line-height:1.55;margin-bottom:16px">${tier.desc}</div>
        <div style="display:flex;gap:10px;padding:12px 0;border-top:1px solid rgba(255,69,58,.22);border-bottom:1px solid rgba(255,69,58,.22);margin-bottom:18px">
          <div style="flex:1"><div style="font-size:9px;letter-spacing:.22em;color:rgba(255,245,245,.5);font-weight:800">PRIZE</div>
            <div style="font-size:18px;font-weight:900;color:#30d158;margin-top:3px">₦${total.toLocaleString()}</div></div>
          <div style="flex:1"><div style="font-size:9px;letter-spacing:.22em;color:rgba(255,245,245,.5);font-weight:800">RISK</div>
            <div style="font-size:13px;font-weight:900;color:#ff9f0a;margin-top:6px">${tier.hours} hours · ${tier.hunters} hunters</div></div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="hc-no" style="flex:1;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:transparent;color:rgba(255,245,245,.72);font:900 11px var(--h-font,Inter,sans-serif);letter-spacing:.14em;cursor:pointer">DECLINE</button>
          <button id="hc-yes" style="flex:1.4;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#ff453a,#ff9f0a);color:#fff;font:900 11px var(--h-font,Inter,sans-serif);letter-spacing:.14em;cursor:pointer">ACCEPT</button>
        </div>
      </div>`;
    document.body.appendChild(scrim);
    const done=(v)=>{ scrim.remove(); resolve(v); };
    scrim.querySelector("#hc-no").onclick=()=>done(false);
    scrim.querySelector("#hc-yes").onclick=()=>{
      done(true);
      setTimeout(()=>{
        try{ window.__ph3d_phone?._toast("RULES: you cannot stop, cannot leave, cannot hide — your location is revealed every hour"); }catch(e){}
      },400);
    };
    scrim.addEventListener("pointerdown",(e)=>{ if(e.target===scrim) done(false); });
  });
}
