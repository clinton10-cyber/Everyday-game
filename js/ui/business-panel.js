import { Businesses } from "../core/businesses.js";

const ROOT="ph3d-business-panel";
const money=n=>"₦"+Math.floor(n||0).toLocaleString("en-NG");

export const BusinessPanel={
  _ensure(){
    if(document.getElementById(ROOT)) return;
    const style=document.createElement("style"); style.id=ROOT+"-css";
    style.textContent=`
      #${ROOT}{padding:10px 12px 28px;color:#eaf6ff;font-family:inherit;overflow-y:auto;height:100%;box-sizing:border-box}
      #${ROOT} .bp-head{padding:12px;border-radius:16px;background:linear-gradient(135deg,#152b31,#10201e);border:1px solid #356b5d;margin-bottom:12px}
      #${ROOT} .bp-head b{display:block;font-size:15px;color:#8bffbd;letter-spacing:.08em}
      #${ROOT} .bp-head small{display:block;color:#9fb9b1;margin-top:5px;line-height:1.45}
      #${ROOT} .bp-section{font-size:10px;font-weight:900;letter-spacing:.16em;color:#86a9a1;margin:16px 2px 8px}
      #${ROOT} .bp-card{padding:12px;margin:8px 0;border-radius:15px;background:#111c23;border:1px solid #263b42}
      #${ROOT} .bp-title{display:flex;align-items:center;gap:9px;font-weight:900;font-size:13px}
      #${ROOT} .bp-icon{font-size:23px}.bp-meta{font-size:10px;color:#9fb0b4;line-height:1.5;margin:5px 0 9px}
      #${ROOT} .bp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:8px 0}
      #${ROOT} .bp-stat{padding:7px 5px;background:#0a1218;border-radius:9px;text-align:center}
      #${ROOT} .bp-stat b{display:block;color:#8bffbd;font-size:12px}#${ROOT} .bp-stat small{font-size:8px;color:#8da0a5}
      #${ROOT} .bp-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:9px}
      #${ROOT} button{border:0;border-radius:9px;padding:10px 6px;font-size:9px;font-weight:900;letter-spacing:.06em;background:#21483d;color:#dfffee;cursor:pointer}
      #${ROOT} button.primary{background:#83f5ad;color:#092016}#${ROOT} button:disabled{opacity:.35;cursor:default}
      #${ROOT} .bp-empty{padding:18px;text-align:center;color:#9fb0b4;font-size:11px;border:1px dashed #36504f;border-radius:13px}
      #${ROOT} .bp-note{font-size:9px;line-height:1.5;color:#80979a;margin:12px 3px}
    `; document.head.appendChild(style);
    const app=document.getElementById("app-business");
    if(!app) return;
    app.innerHTML=`<button class="tbk" data-back><i class="fa-solid fa-chevron-left"></i> Home</button><div id="${ROOT}"></div>`;
    app.querySelector("[data-back]").onclick=()=>window.__ph3d_phone?.showApp("home");
    document.querySelectorAll("#"+ROOT+" button").forEach(()=>{});
  },
  render(){
    this._ensure(); const root=document.getElementById(ROOT); if(!root) return;
    const s=Businesses.snapshot();
    let html=`<div class="bp-head"><b>MY BUSINESS PORTFOLIO</b><small>Wallet: ${money(s.balance)} · Lifetime business earnings: ${money(s.totalEarned)}<br>One business day passes every 5 minutes while the game is running or offline. Earnings are stored until collected.</small></div>`;
    html+=`<div class="bp-section">YOUR BUSINESSES (${s.owned.length})</div>`;
    if(!s.owned.length) html+=`<div class="bp-empty">You do not own a business yet. Buy one below and build your own company.</div>`;
    s.owned.forEach(b=>{
      const d=s.catalog.find(x=>x.id===b.id); if(!d)return;
      html+=`<div class="bp-card"><div class="bp-title"><span class="bp-icon">${d.icon}</span><span>${d.name}</span><span style="margin-left:auto;color:#8bffbd;font-size:10px">LEVEL ${b.level}</span></div>
        <div class="bp-meta">${d.desc}</div><div class="bp-stats"><div class="bp-stat"><b>${b.stock}</b><small>STOCK UNITS</small></div><div class="bp-stat"><b>${b.staff}/3</b><small>EMPLOYEES</small></div><div class="bp-stat"><b>${money(b.pending)}</b><small>UNCLAIMED PROFIT</small></div></div>
        <div class="bp-meta">Units sold: ${b.sold||0} · Operating cycles: ${b.cycles||0}</div><div class="bp-actions">
        <button class="primary" data-act="collect" data-id="${b.id}" ${b.pending<=0?"disabled":""}>COLLECT ${money(b.pending)}</button>
        <button data-act="stock" data-id="${b.id}">RESTOCK 20 · ${money(Math.floor(d.price*.012))}</button>
        <button data-act="hire" data-id="${b.id}" ${b.staff>=3?"disabled":""}>HIRE STAFF · ${money(25000*(b.staff+1))}</button>
        <button data-act="upgrade" data-id="${b.id}" ${b.level>=5?"disabled":""}>UPGRADE · ${b.level>=5?"MAX":money(Math.floor(d.price*(.18*b.level)))}</button></div></div>`;
    });
    html+=`<div class="bp-section">AVAILABLE BUSINESSES</div>`;
    s.catalog.filter(d=>!s.owned.some(b=>b.id===d.id)).forEach(d=>{
      html+=`<div class="bp-card"><div class="bp-title"><span class="bp-icon">${d.icon}</span>${d.name}</div><div class="bp-meta">${d.kind} · ${d.desc}<br>Starting stock: ${d.stock} units · Estimated sales cycle: every 5 minutes</div><div class="bp-actions"><button class="primary" data-act="buy" data-id="${d.id}" ${s.balance<d.price?"disabled":""}>BUY · ${money(d.price)}</button></div></div>`;
    });
    html+=`<div class="bp-note">Business performance depends on available stock, staffing and upgrades. Staff increase sales capacity but add operating costs. Stock must be replenished. No real money or real-world business is involved; all transactions use in-game currency.</div>`;
    root.innerHTML=html;
    root.querySelectorAll("button[data-act]").forEach(btn=>btn.onclick=()=>this.action(btn.dataset.act,btn.dataset.id));
  },
  action(act,id){
    let r;
    if(act==="buy") r=Businesses.buy(id);
    if(act==="stock") r=Businesses.restock(id);
    if(act==="hire") r=Businesses.hire(id);
    if(act==="upgrade") r=Businesses.upgrade(id);
    if(act==="collect") r=Businesses.collect(id);
    const messages={funds:"Not enough money.",owned:"You already own this business.",limit:"Maximum level or staff limit reached.",empty:"No earnings to collect yet."};
    if(!r?.ok) window.__ph3d_phone?._toast(messages[r?.reason]||"Action unavailable.");
    else window.__ph3d_phone?._toast(act==="collect"?`Collected ${money(r.amount)}.`:act==="buy"?"Business purchased.":act==="stock"?"Stock replenished.":act==="hire"?"Employee hired.":"Business upgraded.");
    this.render();
  }
};
