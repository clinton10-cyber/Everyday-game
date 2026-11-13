import { Economy } from "./economy.js";
import * as THREE from "three";

const KEY = "ph3d.styleAbilityShop.v1";
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
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { owned:[] }; } catch { return { owned:[] }; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
export function ownsStyleItem(id) { return read().owned.includes(id); }
export function isEmoteUnlocked(id) {
  if (FLIPS.has(id)) return ownsStyleItem("flip_pack");
  if (id === "dance") return ownsStyleItem("dance_pack");
  if (["azonto_step","shaku_flow","zanku_legwork","buga_bounce","amapiano_log","stepper_glide","stepper_cross","stepper_heeltoe"] .includes(id)) return ownsStyleItem("naija_dance_pack");
  return true;
}
export function attachCosmeticWings(root) {
  if (!root) return null;
  root.getObjectByName("everyday-cosmetic-wings")?.parent?.remove(root.getObjectByName("everyday-cosmetic-wings"));
  const owned = ["angel_wings","shadow_wings","neon_wings"].find(ownsStyleItem);
  if (!owned) return null;
  const group = new THREE.Group(); group.name = "everyday-cosmetic-wings";
  const palettes = {
    angel_wings: [0xf8fbff, 0xd9c9ff, 0xffdf91],
    shadow_wings: [0x17152b, 0x542b83, 0xb56cff],
    neon_wings: [0x062b42, 0x00d9ff, 0x9b5cff]
  };
  const [base, mid, glow] = palettes[owned];
  const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.58, metalness: 0.12, side: THREE.DoubleSide });
  const accent = new THREE.MeshStandardMaterial({ color: mid, roughness: 0.4, metalness: 0.22, emissive: glow, emissiveIntensity: owned === "angel_wings" ? 0.12 : 0.48, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.name = side < 0 ? "left-wing" : "right-wing";
    wing.position.set(side * 0.19, 1.28, -0.22); wing.rotation.z = side * -0.12;
    const outline = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9), mat);
    outline.scale.set(0.78, 1.48, 0.18); outline.rotation.z = side * -0.35; wing.add(outline);
    for (let i=0;i<7;i++) {
      const feather = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.30 + (i%3)*0.07, 3, 6), i%2 ? accent : mat);
      feather.position.set(side * (0.12 + i*0.045), 0.02 + i*0.105, 0.015);
      feather.rotation.z = side * (-0.72 + i*0.105); feather.scale.set(0.82, 1, 0.55); wing.add(feather);
    }
    wing.userData.baseZ = wing.rotation.z; group.add(wing);
  }
  root.add(group); return group;
}
export function updateCosmeticWings(root, time) {
  const g = root?.getObjectByName("everyday-cosmetic-wings"); if (!g) return;
  const flap = Math.sin(time * 2.8) * 0.075;
  g.children.forEach((w,i)=>{ const sign=i===0?-1:1; w.rotation.z = w.userData.baseZ + sign*flap; });
}

export function openStyleAbilityShop() {
  document.getElementById("ph3d-style-shop")?.remove();
  const state = read();
  const overlay = document.createElement("div"); overlay.id = "ph3d-style-shop";
  overlay.innerHTML = `<div class="sas-panel"><header><div><small>EVERYDAY EXCHANGE</small><h2>Emotes & Gear</h2><p>Unlock moves and mobility gear with your game balance.</p></div><button class="sas-close" aria-label="Close">×</button></header><div class="sas-balance">Available balance <b>${Economy.format(Economy.balance)}</b></div><div class="sas-grid">${ITEMS.map(i=>{const owned=state.owned.includes(i.id);return `<article class="sas-card"><span>${i.category}</span><h3>${i.name}</h3><p>${i.desc}</p><footer><b>${owned?"OWNED":Economy.format(i.price)}</b><button data-buy="${i.id}" ${owned?"disabled":""}>${owned?"Unlocked":"Buy"}</button></footer></article>`}).join("")}</div><div class="sas-note">Basic wave, clap, flex and everyday actions remain available. Purchases are saved on this device.</div></div>`;
  const style = document.createElement("style"); style.textContent = `#ph3d-style-shop{position:fixed;inset:0;z-index:10050;background:rgba(3,5,18,.82);backdrop-filter:blur(12px);display:grid;place-items:center;padding:16px;font-family:Arial,sans-serif;color:#f4f4ff}.sas-panel{width:min(760px,100%);max-height:90dvh;overflow:auto;background:linear-gradient(145deg,#171638,#090d20);border:1px solid #8b5cf6;border-radius:22px;padding:20px;box-shadow:0 20px 80px #000a}.sas-panel header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sas-panel small{color:#a78bfa;letter-spacing:2px}.sas-panel h2{margin:6px 0;font-size:26px}.sas-panel p{color:#b9bad0;font-size:13px;line-height:1.45}.sas-close{background:#29264d;color:white;border:1px solid #6556a8;border-radius:12px;font-size:25px;width:42px;height:42px}.sas-balance{margin:16px 0;padding:13px;border-radius:12px;background:#101a31;display:flex;justify-content:space-between;color:#cbd5e1}.sas-balance b{color:#5eead4}.sas-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:12px}.sas-card{background:#11152b;border:1px solid #34365d;border-radius:15px;padding:14px}.sas-card>span{font-size:10px;color:#67e8f9;text-transform:uppercase;letter-spacing:1.4px}.sas-card h3{font-size:16px;margin:9px 0 5px}.sas-card p{min-height:52px}.sas-card footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px}.sas-card footer b{font-size:13px;color:#ddd6fe}.sas-card button{border:0;border-radius:9px;padding:9px 15px;background:linear-gradient(90deg,#7c3aed,#2563eb);color:white;font-weight:700}.sas-card button:disabled{background:#254c48;color:#99f6e4}.sas-note{font-size:11px;color:#8e91ad;margin-top:15px}@media(max-width:480px){.sas-panel{padding:14px}.sas-panel h2{font-size:22px}.sas-card p{min-height:0}}`;
  overlay.append(style); document.body.append(overlay);
  overlay.querySelector(".sas-close").onclick=()=>overlay.remove();
  overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove();});
  overlay.querySelectorAll("[data-buy]").forEach(btn=>btn.addEventListener("click",()=>{
    const item=ITEMS.find(x=>x.id===btn.dataset.buy); if(!item)return;
    const current=read(); if(current.owned.includes(item.id))return;
    if(!Economy.withdraw(item.price)){btn.textContent="Not enough funds";setTimeout(()=>{btn.textContent="Buy";},1200);return;}
    current.owned.push(item.id);save(current); openStyleAbilityShop();
    try{window.__ph3d_phone?._toast(`${item.name} unlocked`);}catch{}
  }));
}
