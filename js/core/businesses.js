/* Phase 4 — player-owned businesses. One simulated business day = five real minutes.
   Earnings accrue to a business ledger and are collected explicitly by the player. */
import { Economy } from "./economy.js";

const KEY = "ph3d_businesses_v1";
const CATALOG = [
  { id:"provisions", name:"Provision Store", kind:"Retail", price:250000, unitPrice:1800, margin:.30, cycleUnits:8, stock:24, icon:"🛒", desc:"Everyday groceries and household essentials." },
  { id:"canteen", name:"Food Canteen", kind:"Food", price:400000, unitPrice:2500, margin:.34, cycleUnits:7, stock:21, icon:"🍲", desc:"Serve jollof, rice, beans and local meals." },
  { id:"boutique", name:"Fashion Boutique", kind:"Fashion", price:750000, unitPrice:6500, margin:.32, cycleUnits:4, stock:12, icon:"👕", desc:"Clothes, shoes and accessories." },
  { id:"phone-accessories", name:"Phone Accessories", kind:"Electronics", price:1200000, unitPrice:9000, margin:.28, cycleUnits:4, stock:12, icon:"📱", desc:"Chargers, earphones, cases and screen guards." }
];
const clone = x => JSON.parse(JSON.stringify(x));
function load(){ try { const x=JSON.parse(localStorage.getItem(KEY)||"{}"); return x&&typeof x==="object"?x:{}; } catch(_){ return {}; } }
function save(){ try { localStorage.setItem(KEY,JSON.stringify(state)); } catch(e){ console.warn("[businesses] save failed",e); } }
const state = load();
if(!state.owned || typeof state.owned!=="object") state.owned={};
if(!Number.isFinite(state.lastCycle)) state.lastCycle=Date.now();
if(!Number.isFinite(state.totalEarned)) state.totalEarned=0;

export const Businesses = {
  catalog: CATALOG,
  get owned(){ this._settle(); return Object.values(state.owned); },
  get totalEarned(){ return state.totalEarned; },
  get balance(){ return Economy.balance; },
  format(n){ return Economy.format(n); },
  _settle(){
    const now=Date.now(), cycleMs=5*60*1000;
    let cycles=Math.floor((now-state.lastCycle)/cycleMs);
    if(cycles<=0) return;
    cycles=Math.min(cycles,2016); // cap offline catch-up at seven simulated days
    for(let c=0;c<cycles;c++){
      Object.values(state.owned).forEach(b=>{
        const def=CATALOG.find(d=>d.id===b.id); if(!def||b.stock<=0) return;
        const sold=Math.min(b.stock,def.cycleUnits+b.level*2+b.staff*2);
        b.stock-=sold;
        const gross=sold*def.unitPrice*(1+b.level*.08);
        const profit=Math.max(0,Math.floor(gross*def.margin-b.staff*1500));
        b.pending=(b.pending||0)+profit;
        b.sold=(b.sold||0)+sold;
        b.cycles=(b.cycles||0)+1;
      });
    }
    state.lastCycle=now-(Math.max(0,(now-state.lastCycle)%cycleMs)); save();
  },
  buy(id){
    this._settle(); const d=CATALOG.find(x=>x.id===id);
    if(!d) return {ok:false,reason:"invalid"};
    if(state.owned[id]) return {ok:false,reason:"owned"};
    if(Economy.balance<d.price) return {ok:false,reason:"funds"};
    if(!Economy.withdraw(d.price)) return {ok:false,reason:"funds"};
    state.owned[id]={id:d.id,name:d.name,level:1,staff:0,stock:d.stock,pending:0,sold:0,cycles:0,boughtAt:Date.now()};
    save(); try { window.dispatchEvent(new CustomEvent("ph3d:business-buy", {detail:{id:d.id,name:d.name}})); } catch(_) {} return {ok:true,business:clone(state.owned[id])};
  },
  restock(id){
    this._settle(); const b=state.owned[id], d=CATALOG.find(x=>x.id===id);
    if(!b||!d) return {ok:false,reason:"missing"};
    const cost= Math.floor(d.price*.012);
    if(Economy.balance<cost) return {ok:false,reason:"funds",cost};
    if(!Economy.withdraw(cost)) return {ok:false,reason:"funds",cost};
    b.stock+=20; save(); return {ok:true,cost,stock:b.stock};
  },
  hire(id){
    this._settle(); const b=state.owned[id]; if(!b) return {ok:false,reason:"missing"};
    if(b.staff>=3) return {ok:false,reason:"limit"};
    const cost=25000*(b.staff+1); if(Economy.balance<cost) return {ok:false,reason:"funds",cost};
    if(!Economy.withdraw(cost)) return {ok:false,reason:"funds",cost};
    b.staff++; save(); return {ok:true,staff:b.staff,cost};
  },
  upgrade(id){
    this._settle(); const b=state.owned[id]; if(!b) return {ok:false,reason:"missing"};
    if(b.level>=5) return {ok:false,reason:"limit"};
    const cost=Math.floor(CATALOG.find(d=>d.id===id).price*(.18*b.level));
    if(Economy.balance<cost) return {ok:false,reason:"funds",cost};
    if(!Economy.withdraw(cost)) return {ok:false,reason:"funds",cost};
    b.level++; save(); try { window.dispatchEvent(new CustomEvent("ph3d:business-upgrade", {detail:{id,level:b.level}})); } catch(_) {} return {ok:true,level:b.level,cost};
  },
  collect(id){
    this._settle(); const b=state.owned[id]; if(!b) return {ok:false,reason:"missing"};
    const amount=Math.floor(b.pending||0); if(amount<=0) return {ok:false,reason:"empty"};
    b.pending=0; state.totalEarned+=amount; save(); Economy.receive(b.name,amount,"Business earnings");
    try { window.dispatchEvent(new CustomEvent("ph3d:business-collect", {detail:{id,amount}})); } catch(_) {}
    return {ok:true,amount};
  },
  snapshot(){ this._settle(); return {owned:clone(Object.values(state.owned)),catalog:clone(CATALOG),totalEarned:state.totalEarned,balance:Economy.balance}; }
};
