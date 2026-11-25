import { Economy } from "./economy.js";
import * as THREE from "three";
import { buildOrigamiWings } from "../characters/origami-wings.js";

const KEY = "ph3d.styleAbilityShop.v1";
const EQUIPPED_KEY = "ph3d.equippedCosmeticWings.v1";
const BODY_KEY = "ph3d.bodyCustomization.v1";
export const BODY_TYPES = [
  {id:"athletic",name:"Athletic",price:5000,build:0.28,height:1.00,desc:"Defined deltoids, pecs and quads: a fit, sporty frame."},
  {id:"muscular",name:"Muscular",price:8000,build:0.78,height:1.00,desc:"Huge chest, shoulders, biceps, traps and powerful legs."},
  {id:"slim",name:"Slim",price:5000,build:-0.72,height:1.00,desc:"A lean, narrow, long-limbed frame with a slight lean."},
  {id:"heavyset",name:"Heavyset",price:6000,build:0.92,height:0.98,desc:"A full round belly, soft hips and thick arms and legs."},
  {id:"tall_broad",name:"Tall & Broad",price:10000,build:0.48,height:1.12,desc:"Towering and wide, with massive shoulders and traps."}
];
export const BODY_STYLES = [
  {id:"classic",name:"Classic",price:6000,look:"classic",desc:"Soft, rounded build with puffed shoulders and a friendly belly."},
  {id:"faceted_plus",name:"Faceted Elite",price:7000,look:"faceted",desc:"Glowing crystal chest gem, shoulder shards and a back fin."},
  {id:"heroic",name:"Heroic",price:9000,look:"faceted",desc:"Wide V-shaped hero frame with gold pauldrons, emblem, belt and bracers."},
  {id:"sleek",name:"Sleek",price:6500,look:"classic",desc:"Slim, narrow frame with glowing neon racing stripes."},
  {id:"angular",name:"Angular",price:8500,look:"faceted",desc:"Shoulder spikes, chest ridge, forearm fins and knee wedges."},
  {id:"refined",name:"Refined",price:11000,look:"classic",desc:"Elegant frame with a gold collar, belt, cuffs, ankle rings and brooch."}
];
/* Purchasable body tattoos — each design can be owned and equipped independently */
export const TATTOOS = [
  { id:"tribal_arm",   name:"Tribal Armband",     price:3500,  slot:"armL",  color:"#1a1a1a", desc:"Bold black tribal band around the upper left arm." },
  { id:"rose_chest",   name:"Rose Chest",         price:5500,  slot:"chest", color:"#8b1e3f", desc:"A classic red rose with stem across the upper chest." },
  { id:"dragon_back",  name:"Dragon Spine",       price:9000,  slot:"back",  color:"#2d4a3e", desc:"Coiled dragon motif running down the upper back." },
  { id:"geo_sleeve",   name:"Geo Sleeve",         price:7000,  slot:"armR",  color:"#111827", desc:"Sharp geometric lines wrapping the right upper arm." },
  { id:"flame_fore",   name:"Flame Forearm",      price:4500,  slot:"armR",  color:"#c2410c", desc:"Rising flame shapes along the right forearm." },
  { id:"star_map",     name:"Star Map",           price:4000,  slot:"chest", color:"#1e3a5f", desc:"Constellation dots and lines across the collarbone." },
  { id:"ankara_band",  name:"Ankara Band",        price:6000,  slot:"armL",  color:"#b45309", desc:"Warm ankara-inspired pattern band on the left arm." },
  { id:"infinity",     name:"Infinity Heart",     price:3000,  slot:"chest", color:"#9f1239", desc:"Infinity symbol with a small heart at the centre of the chest." },
  { id:"cross_faith",  name:"Faith Cross",        price:3200,  slot:"chest", color:"#1f2937", desc:"Simple cross tattoo on the upper chest." },
  { id:"wave_hip",     name:"Ocean Wave",         price:3800,  slot:"hip",   color:"#0e7490", desc:"Stylised wave curling over the left hip." },
];
export function getBodyOwnership(){
  try {
    const s = JSON.parse(localStorage.getItem(BODY_KEY) || '{"types":[],"styles":[],"tattoos":[]}');
    if (!s.tattoos) s.tattoos = [];
    return s;
  } catch { return { types: [], styles: [], tattoos: [] }; }
}
export function ownsBodyItem(kind, id) {
  const s = getBodyOwnership();
  return (s[kind] || []).includes(id);
}
export function purchaseBodyItem(kind, id) {
  const list = kind === "types" ? BODY_TYPES : kind === "styles" ? BODY_STYLES : kind === "tattoos" ? TATTOOS : null;
  const item = list && list.find(x => x.id === id);
  if (!item) return { ok: false, reason: "unknown" };
  if (ownsBodyItem(kind, id)) return { ok: false, reason: "owned" };
  if (!Economy.withdraw(item.price)) return { ok: false, reason: "funds" };
  const s = getBodyOwnership();
  s[kind] = [...(s[kind] || []), id];
  try { localStorage.setItem(BODY_KEY, JSON.stringify(s)); } catch {}
  return { ok: true, item };
}
export function getBodySelection() {
  try {
    return JSON.parse(localStorage.getItem(BODY_KEY + ".selected") || '{"type":"faceted","style":"faceted","tattoos":[]}');
  } catch { return { type: "faceted", style: "faceted", tattoos: [] }; }
}
export function setBodySelection(kind, id) {
  const s = getBodySelection();
  s[kind] = id;
  try { localStorage.setItem(BODY_KEY + ".selected", JSON.stringify(s)); return true; } catch { return false; }
}
/** Toggle a tattoo in the equipped list (multi-select). Returns the new equipped array. */
export function toggleEquippedTattoo(id) {
  const s = getBodySelection();
  const list = Array.isArray(s.tattoos) ? s.tattoos.slice() : [];
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else list.push(id);
  s.tattoos = list;
  try { localStorage.setItem(BODY_KEY + ".selected", JSON.stringify(s)); } catch {}
  return list;
}
export function getEquippedTattoos() {
  const s = getBodySelection();
  return Array.isArray(s.tattoos) ? s.tattoos : [];
}
export function applyBodySelection(config) {
  const s = getBodySelection();
  const t = BODY_TYPES.find(x => x.id === s.type);
  const st = BODY_STYLES.find(x => x.id === s.style);
  config = config || {};
  config.build = t ? t.build : 0;
  config.bodyHeight = t ? t.height : 1;
  config.bodyStyle = s.style || "faceted";
  config.bodyType = t ? t.id : "faceted";
  config.look = s.style === "faceted" ? "faceted" : (st?.look || "faceted");
  config.tattoos = Array.isArray(s.tattoos) ? s.tattoos.slice() : [];
  return config;
}
const ITEMS = [
  { id:"jetpack", name:"Jetpack Access", category:"Mobility", price:25000, desc:"Unlock the existing jetpack flight controls and back-mounted rocket pack." },
  { id:"flip_pack", name:"Acrobat Flip Pack", category:"Emotes", price:12000, desc:"Unlock backflip, double flip, layout, pike, gainer and twist moves." },
  { id:"dance_pack", name:"Street Dance Pack", category:"Emotes", price:8000, desc:"Unlock the core street dance collection." },
  { id:"naija_dance_pack", name:"Naija Trend Dance Pack", category:"Emotes", price:18000, desc:"Unlock Azonto, Shaku, Zanku, Buga, Amapiano and three original Steppers routines: Glide, Cross-Step and Heel-Toe." },
  { id:"angel_wings", name:"Origami Angel Wings", category:"Wings", price:18000, desc:"Hand-folded paper wings: ivory feathers in four layered tiers with fine ink creases and a warm glowing core." },
  { id:"shadow_wings", name:"Shadow Raven Wings", category:"Wings", price:22000, desc:"Obsidian raven plumage in six feather tiers with violet and teal iridescent edges." },
  { id:"neon_wings", name:"Cyber Origami Wings", category:"Wings", price:26000, desc:"Dark chrome folded wings with magenta-to-cyan neon edges, an energy conduit and a spinning core." },
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
  if (old?.parent) old.parent.remove(old);          /* geometry + materials are shared/cached: nothing to dispose */
  const equipped = getEquippedWing();
  if (!equipped) return null;
  /* outer group = placement + hide/show scale; inner group = the origami wing set (own fixed scale) */
  const group = new THREE.Group(); group.name = "everyday-cosmetic-wings";
  group.position.set(0, 1.25, -0.245);
  group.renderOrder = 2;
  group.add(buildOrigamiWings(equipped));
  root.add(group); return group;
}
/* Equipped wings give true flight: no jetpack or fuel needed, and far faster than the jetpack (jetpack = x2.8 / drive x5). */
export const WING_FLIGHT = { speedMul: 7.5, driveWalk: 9, driveRun: 14, climb: 22, accel: 80 };
export function hasWingFlight() { try { return !!getEquippedWing(); } catch { return false; } }
export function updateCosmeticWings(root, time, posture = {}) {
  const g = root?.getObjectByName("everyday-cosmetic-wings"); if (!g) return;
  const hidden = posture.state === "lying" || posture.state === "falling" || posture.flip === true || posture.falling === true;
  const target = hidden ? 0 : 1;
  g.userData.visibility = THREE.MathUtils.damp(g.userData.visibility ?? 1, target, 14, 1/60);
  g.visible = g.userData.visibility > 0.015;
  g.scale.setScalar(Math.max(0.001,g.userData.visibility));
  if (hidden) return;
  const set = g.children[0]; if (!set) return;
  const fl = posture.flying === true, hz = fl ? 5.2 : 1.9, beat = Math.sin(time * hz), flap = (fl ? 0.12 : 0.05) + beat * (fl ? 0.30 : 0.16);
  set.children.forEach((w)=>{ const u=w.userData; if(!u?.isWing) return; w.rotation.y = u.base + u.side*flap; w.rotation.x = u.side*Math.sin(time*hz+0.9)*(fl?0.09:0.04); });
  try { set.userData.tick?.(time); } catch {}
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
