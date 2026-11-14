import { Economy } from "./economy.js";
import * as THREE from "three";

const KEY = "ph3d.styleAbilityShop.v1";
const EQUIPPED_KEY = "ph3d.equippedCosmeticWings.v1";
const BODY_KEY = "ph3d.bodyCustomization.v1";
export const BODY_TYPES = [
  {id:"athletic",name:"Athletic",price:5000,build:0.28,height:1.00,desc:"Defined shoulders and a fit, balanced frame."},
  {id:"muscular",name:"Muscular",price:8000,build:0.78,height:1.00,desc:"Broad chest, thick arms and powerful proportions."},
  {id:"slim",name:"Slim",price:5000,build:-0.72,height:1.00,desc:"A lean, narrow silhouette with lighter limbs."},
  {id:"heavyset",name:"Heavyset",price:6000,build:0.92,height:0.98,desc:"A fuller torso and broader overall build."},
  {id:"tall_broad",name:"Tall & Broad",price:10000,build:0.48,height:1.12,desc:"Extra height with a wide, confident frame."}
];
export const BODY_STYLES = [
  {id:"classic",name:"Classic",price:6000,look:"classic",desc:"Rounded classic character proportions."},
  {id:"faceted_plus",name:"Faceted Elite",price:7000,look:"faceted",desc:"Crisp low-poly planes with refined proportions."},
  {id:"heroic",name:"Heroic",price:9000,look:"faceted",desc:"Sculpted heroic silhouette and stronger shoulders."},
  {id:"sleek",name:"Sleek",price:6500,look:"classic",desc:"A streamlined, narrow silhouette."},
  {id:"angular",name:"Angular",price:8500,look:"faceted",desc:"Sharper, more pronounced geometric forms."},
  {id:"refined",name:"Refined",price:11000,look:"classic",desc:"Balanced proportions with a premium finish."}
];
export function getBodyOwnership(){try{return JSON.parse(localStorage.getItem(BODY_KEY)||'{"types":[],"styles":[]}')}catch{return {types:[],styles:[]};}}
export function ownsBodyItem(kind,id){const s=getBodyOwnership();return (s[kind]||[]).includes(id);}
export function purchaseBodyItem(kind,id){const list=kind==="types"?BODY_TYPES:BODY_STYLES,item=list.find(x=>x.id===id);if(!item)return {ok:false,reason:"unknown"};if(ownsBodyItem(kind,id))return {ok:false,reason:"owned"};if(!Economy.withdraw(item.price))return {ok:false,reason:"funds"};const s=getBodyOwnership();s[kind]=[...(s[kind]||[]),id];try{localStorage.setItem(BODY_KEY,JSON.stringify(s));}catch{}return {ok:true,item};}
export function getBodySelection(){try{return JSON.parse(localStorage.getItem(BODY_KEY+".selected")||'{"type":"faceted","style":"faceted"}')}catch{return {type:"faceted",style:"faceted"};}}
export function setBodySelection(kind,id){const s=getBodySelection();s[kind]=id;try{localStorage.setItem(BODY_KEY+".selected",JSON.stringify(s));return true;}catch{return false;}}
export function applyBodySelection(config){const s=getBodySelection();const t=BODY_TYPES.find(x=>x.id===s.type);const st=BODY_STYLES.find(x=>x.id===s.style);config=config||{};config.build=t?t.build:0;config.bodyHeight=t?t.height:1;config.bodyStyle=s.style||"faceted";config.look=s.style==="faceted"?"faceted":(st?.look||"faceted");return config;}
const ITEMS = [
  { id:"jetpack", name:"Jetpack Access", category:"Mobility", price:25000, desc:"Unlock the existing jetpack flight controls and back-mounted rocket pack." },
  { id:"flip_pack", name:"Acrobat Flip Pack", category:"Emotes", price:12000, desc:"Unlock backflip, double flip, layout, pike, gainer and twist moves." },
  { id:"dance_pack", name:"Street Dance Pack", category:"Emotes", price:8000, desc:"Unlock the core street dance collection." },
  { id:"naija_dance_pack", name:"Naija Trend Dance Pack", category:"Emotes", price:18000, desc:"Unlock Azonto, Shaku, Zanku, Buga, Amapiano and three original Steppers routines: Glide, Cross-Step and Heel-Toe." },
  { id:"angel_wings", name:"Celestial Angel Wings", category:"Wings", price:18000, desc:"Large pearl-white feather wings with a soft gold glow." },
  { id:"shadow_wings", name:"Shadow Raven Wings", category:"Wings", price:22000, desc:"Dark layered wings with a violet edge glow." },
  { id:"neon_wings", name:"Neon Pulse Wings", category:"Wings", price:26000, desc:"Futuristic cyan-purple energy wings." },
];
const FLIPS = new Set(["backflip","doubleBackflip","tripleBackflip","layoutFlip","pikeFlip","gainer","arabian","halfTwist","fullTwist","corkscrew","doubleFullTwist","backFullDouble","splitLegFlip","xOut","straddle","kickTheMoon","oneArmFlip","crouchEntry","sprintDouble","tripleCompact"]);
const read = () => { try { const v=JSON.parse(localStorage.getItem(KEY)||"{}"); return { ...v, owned:Array.isArray(v.owned)?v.owned.filter(x=>typeof x==="string"):[] }; } catch { return { owned:[] }; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
export function ownsStyleItem(id) { return read().owned.includes(id); }
export function getEquippedWing() {
  try {
    const saved=localStorage.getItem(EQUIPPED_KEY);
    if (saved === "none") return null;
    if (saved) return ["angel_wings","shadow_wings","neon_wings"].includes(saved) && ownsStyleItem(saved) ? saved : null;
    // Migrate an older purchase: preserve the previously auto-displayed wing once.
    const legacy=["angel_wings","shadow_wings","neon_wings"].find(ownsStyleItem) || null;
    if (legacy) localStorage.setItem(EQUIPPED_KEY,legacy);
    return legacy;
  } catch { return null; }
}
export function setEquippedWing(id) {
  if (id && (!["angel_wings","shadow_wings","neon_wings"].includes(id) || !ownsStyleItem(id))) return false;
  try { localStorage.setItem(EQUIPPED_KEY,id || "none"); return true; } catch { return false; }
}
export function purchaseStyleItem(id) {
  const item=ITEMS.find(x=>x.id===id); if(!item) return {ok:false,reason:"unknown"};
  const state=read(); if(state.owned.includes(id)) return {ok:false,reason:"owned"};
  if(!Economy.withdraw(item.price)) return {ok:false,reason:"funds"};
  state.owned.push(id); save(state); return {ok:true,item};
}
export function getStyleItems() { return ITEMS.map(x=>({...x,owned:ownsStyleItem(x.id)})); }

export function isEmoteUnlocked(id) {
  if (FLIPS.has(id)) return ownsStyleItem("flip_pack");
  if (id === "dance") return ownsStyleItem("dance_pack");
  if (["azonto_step","shaku_flow","zanku_legwork","buga_bounce","amapiano_log","stepper_glide","stepper_cross","stepper_heeltoe"] .includes(id)) return ownsStyleItem("naija_dance_pack");
  return true;
}
export function attachCosmeticWings(root) {
  if (!root) return null;
  const old = root.getObjectByName("everyday-cosmetic-wings");
  if (old?.parent) old.parent.remove(old);
  const equipped = getEquippedWing();
  if (!equipped) return null;

  const group = new THREE.Group(); group.name = "everyday-cosmetic-wings";
  group.position.set(0, 1.25, -0.245);
  group.renderOrder = 2;
  const palettes = {
    angel_wings: { base:0xf8f5ec, mid:0xd9c7a0, glow:0xffdf91, metal:0xc6a45b },
    shadow_wings: { base:0x171522, mid:0x39264e, glow:0xa86cff, metal:0x8d72ad },
    neon_wings: { base:0x092638, mid:0x087f9b, glow:0x19dfff, metal:0x8e67ff }
  };
  const pal=palettes[equipped];
  const baseMat=new THREE.MeshStandardMaterial({color:pal.base,roughness:0.62,metalness:0.18,side:THREE.DoubleSide});
  const midMat=new THREE.MeshStandardMaterial({color:pal.mid,roughness:0.42,metalness:0.28,side:THREE.DoubleSide});
  const glowMat=new THREE.MeshStandardMaterial({color:pal.glow,roughness:0.28,metalness:0.5,emissive:pal.glow,emissiveIntensity:equipped==="angel_wings"?0.18:0.55,side:THREE.DoubleSide});
  const goldMat=new THREE.MeshStandardMaterial({color:pal.metal,metalness:0.82,roughness:0.24});
  const featherGeo=new THREE.CapsuleGeometry(0.052,0.34,3,7);
  for (const side of [-1,1]) {
    const wing=new THREE.Group(); wing.name=side<0?"left-wing":"right-wing";
    wing.position.set(side*0.12,0,0); wing.rotation.y=side*0.12; wing.userData.baseZ=side*0.055;
    // Broad, swept silhouette formed from three overlapping feather tiers.
    const fan=new THREE.Mesh(new THREE.SphereGeometry(0.43,16,12),baseMat);
    fan.scale.set(1.52,1.12,0.16); fan.position.set(side*0.34,0.12,-0.015); fan.rotation.z=side*-0.28; wing.add(fan);
    for(let row=0;row<3;row++){
      const count=row===0?8:7;
      for(let i=0;i<count;i++){
        const u=i/(count-1);
        const feather=new THREE.Mesh(featherGeo,(i+row)%5===0?glowMat:(row===0?baseMat:midMat));
        const spread=0.18+u*0.64;
        feather.position.set(side*(0.12+spread),0.22-row*0.19+Math.sin(u*Math.PI)*0.12,-0.035-row*0.018);
        feather.rotation.z=side*(-0.62+u*0.92);
        feather.scale.set(0.78+u*0.20,1.02+row*0.12,0.48);
        wing.add(feather);
      }
    }
    // Raised shoulder mantle and fine metallic quill accents.
    for(let i=0;i<4;i++){
      const covert=new THREE.Mesh(new THREE.CapsuleGeometry(0.065,0.20,3,8),i%2?midMat:baseMat);
      covert.position.set(side*(0.10+i*0.075),0.30-i*0.045,0.045);
      covert.rotation.z=side*(-0.85+i*0.19); covert.scale.set(1.05,1.18,0.55); wing.add(covert);
    }
    const pin=new THREE.Mesh(new THREE.SphereGeometry(0.105,14,12),goldMat);
    pin.position.set(side*0.13,0.31,0.075); pin.scale.set(1,1.2,0.34); wing.add(pin);
    const jewel=new THREE.Mesh(new THREE.OctahedronGeometry(0.065,1),glowMat);
    jewel.position.set(side*0.13,0.31,0.12); jewel.rotation.z=Math.PI/4; wing.add(jewel);
    group.add(wing);
  }
  // A discreet centre clasp makes the pair read as a fitted back-piece.
  const clasp=new THREE.Mesh(new THREE.OctahedronGeometry(0.105,1),goldMat);
  clasp.position.set(0,0.31,0.10); clasp.scale.set(0.78,1.3,0.55); group.add(clasp);
  root.add(group); return group;
}
export function updateCosmeticWings(root, time, posture = {}) {
  const g = root?.getObjectByName("everyday-cosmetic-wings"); if (!g) return;
  const hidden = posture.state === "lying" || posture.state === "falling" || posture.flip === true || posture.falling === true;
  const target = hidden ? 0 : 1;
  g.userData.visibility = THREE.MathUtils.damp(g.userData.visibility ?? 1, target, 14, 1/60);
  g.visible = g.userData.visibility > 0.015;
  g.scale.setScalar(Math.max(0.001,g.userData.visibility));
  if (hidden) return;
  const flap = Math.sin(time * 2.8) * 0.075;
  g.children.forEach((w,i)=>{ const sign=i===0?-1:1; w.rotation.z = w.userData.baseZ + sign*flap; });
}

export function openStyleAbilityShop() {
  document.getElementById("ph3d-style-shop")?.remove();
  const state = read();
  const overlay = document.createElement("div"); overlay.id = "ph3d-style-shop";
  overlay.innerHTML = `<div class="sas-panel"><header><div><small>EVERYDAY EXCHANGE</small><h2>Emotes & Gear</h2><p>Unlock moves and mobility gear with your game balance.</p></div><button class="sas-close" aria-label="Close">×</button></header><div class="sas-balance">Available balance <b>${Economy.format(Economy.balance)}</b></div><div class="sas-grid">${ITEMS.map(i=>{const owned=state.owned.includes(i.id);return `<article class="sas-card"><span>${i.category}</span><h3>${i.name}</h3><p>${i.desc}</p><footer><b>${owned?(i.category==="Wings"?(getEquippedWing()===i.id?"EQUIPPED":"OWNED"):"OWNED"):Economy.format(i.price)}</b>${i.category==="Wings"&&owned?`<button data-equip="${i.id}">${getEquippedWing()===i.id?"Unequip":"Equip"}</button>`:`<button data-buy="${i.id}" ${owned?"disabled":""}>${owned?"Unlocked":"Buy"}</button>`}</footer></article>`}).join("")}</div><div class="sas-note">Basic wave, clap, flex and everyday actions remain available. Purchases are saved on this device.</div></div>`;
  const style = document.createElement("style"); style.textContent = `#ph3d-style-shop{position:fixed;inset:0;z-index:10050;background:rgba(3,5,18,.82);backdrop-filter:blur(12px);display:grid;place-items:center;padding:16px;font-family:Arial,sans-serif;color:#f4f4ff}.sas-panel{width:min(760px,100%);max-height:90dvh;overflow:auto;background:linear-gradient(145deg,#171638,#090d20);border:1px solid #8b5cf6;border-radius:22px;padding:20px;box-shadow:0 20px 80px #000a}.sas-panel header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sas-panel small{color:#a78bfa;letter-spacing:2px}.sas-panel h2{margin:6px 0;font-size:26px}.sas-panel p{color:#b9bad0;font-size:13px;line-height:1.45}.sas-close{background:#29264d;color:white;border:1px solid #6556a8;border-radius:12px;font-size:25px;width:42px;height:42px}.sas-balance{margin:16px 0;padding:13px;border-radius:12px;background:#101a31;display:flex;justify-content:space-between;color:#cbd5e1}.sas-balance b{color:#5eead4}.sas-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:12px}.sas-card{background:#11152b;border:1px solid #34365d;border-radius:15px;padding:14px}.sas-card>span{font-size:10px;color:#67e8f9;text-transform:uppercase;letter-spacing:1.4px}.sas-card h3{font-size:16px;margin:9px 0 5px}.sas-card p{min-height:52px}.sas-card footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px}.sas-card footer b{font-size:13px;color:#ddd6fe}.sas-card button{border:0;border-radius:9px;padding:9px 15px;background:linear-gradient(90deg,#7c3aed,#2563eb);color:white;font-weight:700}.sas-card button:disabled{background:#254c48;color:#99f6e4}.sas-note{font-size:11px;color:#8e91ad;margin-top:15px}@media(max-width:480px){.sas-panel{padding:14px}.sas-panel h2{font-size:22px}.sas-card p{min-height:0}}`;
  overlay.append(style); document.body.append(overlay);
  overlay.querySelector(".sas-close").onclick=()=>overlay.remove();
  overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove();});
  overlay.querySelectorAll("[data-equip]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=btn.dataset.equip; setEquippedWing(getEquippedWing()===id?null:id); openStyleAbilityShop();
    try { window.__ph3d_walkCtrl && attachCosmeticWings(window.__ph3d_walkCtrl.avatar); } catch {}
  }));
  overlay.querySelectorAll("[data-buy]").forEach(btn=>btn.addEventListener("click",()=>{
    const item=ITEMS.find(x=>x.id===btn.dataset.buy); if(!item)return;
    const current=read(); if(current.owned.includes(item.id))return;
    if(!Economy.withdraw(item.price)){btn.textContent="Not enough funds";setTimeout(()=>{btn.textContent="Buy";},1200);return;}
    current.owned.push(item.id);save(current); openStyleAbilityShop();
    try{window.__ph3d_phone?._toast(`${item.name} unlocked`);}catch{}
  }));
}
