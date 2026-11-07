import * as THREE from "three";
import { Quality } from "./quality.js";
let _env = null;
export const setEnv = t => _env = t;
export const getEnv = () => _env;

/* PERF: material cache.
   M(c, r, m) used to create a fresh THREE.MeshLambert/Standard material
   on every call, so a scene like places/myhouse/interior.js (11 rooms ×
   20-40 furniture pieces) ended up with 300+ material objects, each with
   its own GPU uniform buffer. Caching by (color, roughness, metalness)
   collapses those to a handful and lets merge-by-material batching work.
   Safe to share: no caller mutates an M() material in-place. */
const _matCache = new Map();
export const M = (c, r = 0.85, m = 0) => {
  const key = c + "|" + r + "|" + m;
  let mat = _matCache.get(key);
  if (mat) return mat;
  if (Quality.current.useLambert) mat = new THREE.MeshLambertMaterial({ color: c });
  else mat = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMap: _env });
  _matCache.set(key, mat);
  return mat;
};
export const EM = (c,i=1.4,b=0x0a0f18)=>new THREE.MeshStandardMaterial({color:b,emissive:c,emissiveIntensity:i,roughness:.5});

export function box(w,h,d,mat,x=0,y=0,z=0){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; return m;
}
export function cyl(rt,rb,h,mat,x=0,y=0,z=0,seg=20){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; return m;
}
export const wait = ms => new Promise(r=>setTimeout(r,ms));

export function textLabel(text, sub=""){
  const c = document.createElement("canvas"), g = c.getContext("2d");
  const F1 = "bold 44px Inter,sans-serif";
  const F2 = "600 20px Inter,sans-serif";
  g.font = F1; const w1 = g.measureText(text).width;
  g.font = F2; const w2 = sub ? g.measureText(sub).width : 0;
  const W = Math.ceil(Math.max(w1,w2)+70), H = sub ? 116 : 78;
  c.width = W; c.height = H;
  const x = c.getContext("2d"), r = 24;
  x.beginPath();
  x.moveTo(r,4); x.lineTo(W-r,4); x.quadraticCurveTo(W-4,4,W-4,r+4);
  x.lineTo(W-4,H-r-4); x.quadraticCurveTo(W-4,H-4,W-r,H-4);
  x.lineTo(r,H-4); x.quadraticCurveTo(4,H-4,4,H-r-4);
  x.lineTo(4,r+4); x.quadraticCurveTo(4,4,r,4); x.closePath();
  x.fillStyle = "rgba(6,14,26,0.9)"; x.fill();
  x.strokeStyle = "rgba(94,224,255,0.8)"; x.lineWidth = 3; x.stroke();
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillStyle = "#ffffff"; x.font = F1;
  x.fillText(text, W/2, sub ? 42 : H/2);
  if (sub){
    x.fillStyle = "rgba(94,224,255,0.92)"; x.font = F2;
    x.fillText(sub.toUpperCase(), W/2, 82);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false
  }));
  sp.renderOrder = 999;
  const s = 2.4;
  sp.scale.set((W/H)*s, s, 1);
  return sp;
}

export function windowTexture(base, win, cols, rows){
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = base; x.fillRect(0,0,128,128);
  const cw = 128/cols, ch = 128/rows;
  x.fillStyle = win;
  for (let r=0;r<rows;r++) for (let q=0;q<cols;q++)
    x.fillRect(q*cw+cw*0.2, r*ch+ch*0.26, cw*0.6, ch*0.48);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* GL -- safe stub. Every pleasurepark / university child module
   imports `{ GL }` from this file but never actually uses it.
   This export exists so those modules can resolve their imports. */
export const GL = {
  MeshLambertMaterial: (o) => new THREE.MeshLambertMaterial(o),
  MeshStandardMaterial: (o) => new THREE.MeshStandardMaterial(o),
  MeshBasicMaterial:    (o) => new THREE.MeshBasicMaterial(o),
  MeshPhongMaterial:    (o) => new THREE.MeshPhongMaterial(o),
};
