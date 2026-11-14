import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* Self-contained furniture/room builder. Provides Builder, the f*
   placement helpers, makeMats(), and finalize() -- all previously
   missing (this file used to import these from itself, which is
   not possible and crashed any scene that used it, e.g. governor.js
   with "does not provide an export named 'Builder'"). Ported from
   the proven implementations in scenes/house-interior.js and
   places/mansion/mansion_scene.js, and extended with seats/uses/
   platforms so callers like governor.js can read them off Builder. */

const _c = new THREE.Color();

export class Builder {
  constructor(ox, oz) {
    this.ox = ox || 0; this.oz = oz || 0;
    this.yOff = 0; this.level = 0;
    this.lit = []; this.glow = []; this.ceilParts = [];
    this.colliders = [];
    this.seats = [];
    this.uses = [];
    this.platforms = [];
  }
  _paint(g, color) {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    _c.set(color);
    const r = _c.r, gg = _c.g, b = _c.b;
    for (let i = 0; i < n; i++) { arr[i*3] = r; arr[i*3+1] = gg; arr[i*3+2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  _collide(w, d, x, z, ry) {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const hw = (w*c + d*s) * 0.5, hd = (w*s + d*c) * 0.5;
    this.colliders.push({
      minX: this.ox + x - hw, maxX: this.ox + x + hw,
      minZ: this.oz + z - hd, maxZ: this.oz + z + hd,
      level: this.level
    });
  }
  box(w,h,d,color,x,y,z,ry,collide,target){
    ry = ry || 0;
    const g = new THREE.BoxGeometry(w,h,d);
    g.deleteAttribute('uv');
    this._paint(g, color);
    if (ry) g.rotateY(ry);
    g.translate(this.ox + x, y + this.yOff, this.oz + z);
    (target || this.lit).push(g);
    if (collide) this._collide(w, d, x, z, ry);
    return this;
  }
  glowBox(w,h,d,c,x,y,z){ return this.box(w,h,d,c,x,y,z,0,false,this.glow); }
  ceilBox(w,h,d,c,x,y,z){ return this.box(w,h,d,c,x,y,z,0,false,this.ceilParts); }
  cyl(rt,rb,h,seg,color,x,y,z,ry,rx,rz,target){
    const g = new THREE.CylinderGeometry(rt,rb,h,seg);
    g.deleteAttribute('uv');
    this._paint(g, color);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(this.ox + x, y + this.yOff, this.oz + z);
    (target || this.lit).push(g);
    return this;
  }
  glowCyl(rt,rb,h,seg,c,x,y,z){ return this.cyl(rt,rb,h,seg,c,x,y,z,0,0,0,this.glow); }
  floor(x0,z0,x1,z1,c){ return this.box(x1-x0,0.12,z1-z0,c,(x0+x1)/2,-0.06,(z0+z1)/2,0,false); }
  ceil(x0,z0,x1,z1,y,c){ return this.ceilBox(x1-x0,0.12,z1-z0,c||0xfffaf0,(x0+x1)/2,y+0.06,(z0+z1)/2); }
  wallX(x,z0,z1,o){
    o=o||{};
    const t=o.t||0.14, h=o.h||2.7, col=o.col||0xefe9df, doors=o.doors||[];
    const ds = doors.slice().sort((a,b)=>a[0]-b[0]);
    let cur = z0;
    for (const d of ds){
      const a=d[0], b=d[1];
      if (a>cur+0.001) this.box(t,h,a-cur,col,x,h/2,(cur+a)/2,0,true);
      if (h>2.15) this.box(t,h-2.15,b-a,col,x,2.15+(h-2.15)/2,(a+b)/2,0,false);
      cur=b;
    }
    if (cur<z1-0.001) this.box(t,h,z1-cur,col,x,h/2,(cur+z1)/2,0,true);
  }
  wallZ(z,x0,x1,o){
    o=o||{};
    const t=o.t||0.14, h=o.h||2.7, col=o.col||0xefe9df, doors=o.doors||[];
    const ds = doors.slice().sort((a,b)=>a[0]-b[0]);
    let cur=x0;
    for (const d of ds){
      const a=d[0], b=d[1];
      if (a>cur+0.001) this.box(a-cur,h,t,col,(cur+a)/2,h/2,z,0,true);
      if (h>2.15) this.box(b-a,h-2.15,t,col,(a+b)/2,2.15+(h-2.15)/2,z,0,false);
      cur=b;
    }
    if (cur<x1-0.001) this.box(x1-cur,h,t,col,(cur+x1)/2,h/2,z,0,true);
  }
  addSeat(x,z,yaw,type,label,h){
    this.seats.push({
      x: this.ox + x,
      z: this.oz + z,
      yaw: yaw || 0,
      type: type || "sit",
      label: label || "SIT",
      /* absolute standing height: a seat on an upper level (e.g. the mansion
         roof terrace, yOff = 4 m) must sit on THAT floor, not on level 0 */
      h: (h || 0.55) + (this.yOff || 0),
      level: this.level,
      taken: false
    });
    return this;
  }
  addUse(kind,x,z,data){ this.uses.push(Object.assign({ kind, x: this.ox + x, z: this.oz + z, y: 0, level: this.level }, data || {})); return this; }
}

function mkF(B,x,z,ry){
  const c=Math.cos(ry), s=Math.sin(ry);
  const PX=(lx,lz)=>x+lx*c+lz*s;
  const PZ=(lx,lz)=>z-lx*s+lz*c;
  return {
    box:(w,h,d,col,lx,ly,lz,hit)=>B.box(w,h,d,col,PX(lx,lz),ly,PZ(lx,lz),ry,!!hit),
    glow:(w,h,d,col,lx,ly,lz)=>B.glowBox(w,h,d,col,PX(lx,lz),ly,PZ(lx,lz)),
    cyl:(rt,rb,h,sg,col,lx,ly,lz,rx,rz)=>B.cyl(rt,rb,h,sg,col,PX(lx,lz),ly,PZ(lx,lz),ry,rx||0,rz||0),
    glowCyl:(rt,rb,h,sg,col,lx,ly,lz)=>B.glowCyl(rt,rb,h,sg,col,PX(lx,lz),ly,PZ(lx,lz))
  };
}
/* Public alias -- some callers (e.g. mansion_layout.js) import this
   name directly instead of using the per-room F.f* helpers. */
export const mkFrame = mkF;

/* -------------------- furniture placement helpers -------------------- */

export function fBed(B,x,z,ry,o){
  o=o||{};
  const w=o.w||1.6, l=o.l||o.len||2.05;
  const F=mkF(B,x,z,ry);
  F.box((w+0.12),0.28,(l+0.12),o.frame||0x8a5a34,0,0.17,0,true);
  F.box(w,0.26,l,o.matt||0xfff8ec,0,0.42,0);
  F.box((w+0.06),0.14,l*0.6,o.duvet||0x3d8ea8,0,0.60,l*0.16);
  F.box(w*0.4,0.14,0.34,o.pillow||0xfffdf6,-w*0.24,0.60,-l*0.32);
  F.box(w*0.4,0.14,0.34,o.pillow||0xfffdf6,w*0.24,0.60,-l*0.32);
  F.box((w+0.24),1.0,0.10,o.head||0x6a4a2c,0,0.80,-l/2-0.10);
  B.addSeat(x, z, ry, "lie", "LIE DOWN", 0.56); /* yaw=ry: head toward headboard (local -Z) */
}
export function fNightstand(B,x,z,ry,c){const F=mkF(B,x,z,ry);F.box(0.5,0.55,0.42,c||0xb08a5c,0,0.275,0,true);F.box(0.46,0.03,0.38,0x8a6a44,0,0.56,0);B.addUse("nightstand",x,z,{label:"OPEN NIGHTSTAND",r:1.35});}
export function fLamp(B,x,z,ry){const F=mkF(B,x,z,ry||0);F.cyl(0.09,0.12,0.03,8,0x3a3a44,0,0.02,0);F.cyl(0.02,0.02,0.35,6,0x3a3a44,0,0.20,0);F.glowCyl(0.13,0.17,0.22,10,0xffe070,0,0.46,0);B.addUse("lamp",x,z,{label:"SWITCH LAMP",r:1.3});}
export function fSofa(B,x,z,ry,len,d,col,cush){
  len=len||2.1; d=d||0.9; col=col||0xe0604a; cush=cush||0xf08a6a;
  const F=mkF(B,x,z,ry);
  F.box(len,0.34,d,col,0,0.21,0,true);
  F.box(len,0.62,0.18,col,0,0.65,-d/2+0.09);
  F.box(0.18,0.34,d,col,-len/2+0.09,0.55,0);
  F.box(0.18,0.34,d,col,len/2-0.09,0.55,0);
  const n=Math.max(2,Math.round(len/0.8)), cw=(len-0.36)/n;
  for(let i=0;i<n;i++){const cx=-len/2+0.18+cw*(i+0.5);
    F.box(cw-0.05,0.16,d-0.30,cush,cx,0.46,0.06);
    F.box(cw-0.05,0.44,0.16,cush,cx,0.72,-d/2+0.26);}
  /* Seat is in front of the backrest (local +Z → world offset by ry).
     ry+PI makes the seated character face outward (away from the backrest). */
  B.addSeat(x - Math.sin(ry)*(d/2-0.1), z - Math.cos(ry)*(d/2-0.1), ry + Math.PI, "sit", "SIT", 0.55);
}
export function fArmchair(B,x,z,ry,col,cush){const F=mkF(B,x,z,ry);col=col||0xd94f8a;cush=cush||0xee7aa8;F.box(0.85,0.35,0.85,col,0,0.22,0,true);F.box(0.85,0.6,0.16,col,0,0.66,-0.35);F.box(0.16,0.32,0.85,col,-0.35,0.55,0);F.box(0.16,0.32,0.85,col,0.35,0.55,0);F.box(0.66,0.14,0.66,cush,0,0.46,0.04);F.box(0.66,0.42,0.14,cush,0,0.74,-0.28);B.addSeat(x, z, ry + Math.PI, "sit", "SIT", 0.55);}
export function fCoffeeTable(B,x,z,ry,w,d){w=w||1;d=d||0.55;const F=mkF(B,x,z,ry||0);F.box(w,0.06,d,0xa8663a,0,0.42,0,true);F.box(w-0.2,0.04,d-0.2,0x7a4a24,0,0.20,0);const lx=w/2-0.07,lz=d/2-0.07;[[-lx,-lz],[lx,-lz],[-lx,lz],[lx,lz]].forEach(p=>F.box(0.07,0.4,0.07,0x7a4a24,p[0],0.20,p[1]));B.addUse("coffee_table",x,z,{label:"USE COFFEE TABLE",r:1.35});}
export function fTV(B,x,z,ry,w){w=w||1.7;const F=mkF(B,x,z,ry);F.box(w,0.42,0.4,0x2a2a34,0,0.21,0,true);F.box(w-0.06,0.02,0.36,0x3a3a48,0,0.43,0);F.box(w*0.92,0.62,0.05,0x0a0a10,0,1.05,0.06);F.glow(w*0.86,0.54,0.02,0x2a6ad0,0,1.05,0.09);B.addUse("watch",x,z,{label:"TURN ON TELEVISION",r:2.0});}
export function fKitchen(B,x,z,ry,len,o){o=o||{};len=len||3;const cab=o.cab||0x5ac8a0, top=o.top||0x2f3237;const F=mkF(B,x,z,ry);F.box(len,0.85,0.62,cab,0,0.425,0,true);F.box(len+0.04,0.05,0.66,top,0,0.875,0);F.box(len,0.72,0.34,cab,0,2.06,-0.14);F.box(len+0.02,0.03,0.36,0xdfe4e8,0,1.69,-0.14);
  B.addUse("cook", x, z, { label: "COOK", r: 2.0 });
}
export function fSink(B,x,z,ry){const F=mkF(B,x,z,ry);F.box(0.66,0.02,0.44,0xc9ced5,0,0.905,0);F.box(0.56,0.14,0.36,0x6d737b,0,0.83,0);F.cyl(0.02,0.02,0.26,6,0xc9ced5,0,1.03,-0.16);
  B.addUse("sink", x, z, { label: "WASH", r: 1.5 });
}
export function fStove(B,x,z,ry){const F=mkF(B,x,z,ry);F.box(0.62,0.02,0.54,0x1b1d21,0,0.90,0);const p=0.15;[[-p,-p],[p,-p],[-p,p],[p,p]].forEach(q=>F.cyl(0.09,0.09,0.015,10,0xff5a3a,q[0],0.915,q[1]));
  B.addUse("cook", x, z, { label: "COOK", r: 1.5 });
}
export function fFridge(B,x,z,ry,c){const F=mkF(B,x,z,ry);F.box(0.75,1.85,0.70,c||0xd0d6dc,0,0.925,0,true);F.box(0.75,0.02,0.7,0xa9adb3,0,1.25,0);
  B.addUse("fridge", x, z, { label: "OPEN FRIDGE", r: 1.5 });
}
export function fIsland(B,x,z,ry,w,d,o){o=o||{};w=w||2.6;d=d||1.1;const F=mkF(B,x,z,ry);F.box(w,0.88,d,o.cab||0x5ac8a0,0,0.44,0,true);F.box(w+0.08,0.06,d+0.08,o.top||0x2f3237,0,0.91,0);B.addUse("island",x,z,{label:"PREPARE FOOD",r:1.7});}
export function fDiningTable(B,x,z,ry,w,d,col){w=w||1.5;d=d||0.9;const F=mkF(B,x,z,ry);F.box(w,0.07,d,col||0x8a4a6a,0,0.75,0,true);const lx=w/2-0.1,lz=d/2-0.1;[[-lx,-lz],[lx,-lz],[-lx,lz],[lx,lz]].forEach(p=>F.box(0.09,0.72,0.09,0x5a2a44,p[0],0.36,p[1]));B.addUse("dining_table",x,z,{label:"SET DINNER TABLE",r:1.6});}
export const fDining = fDiningTable;
export function fChair(B,x,z,ry,col){const F=mkF(B,x,z,ry);col=col||0xd9a04a;F.box(0.42,0.05,0.42,col,0,0.45,0,true);F.box(0.42,0.5,0.05,col,0,0.72,-0.19);[[-0.17,-0.17],[0.17,-0.17],[-0.17,0.17],[0.17,0.17]].forEach(p=>F.box(0.05,0.45,0.05,0x8a6428,p[0],0.225,p[1]));
  B.addSeat(x, z, ry + Math.PI, "sit", "SIT", 0.50);
}
export function fDesk(B,x,z,ry,w){w=w||1.5;const F=mkF(B,x,z,ry);F.box(w,0.07,0.75,0x6a4a2c,0,0.74,0,true);const lx=w/2-0.08,lz=0.75/2-0.08;[[-lx,-lz],[lx,-lz],[-lx,lz],[lx,lz]].forEach(p=>F.box(0.07,0.72,0.07,0x4a3018,p[0],0.36,p[1]));F.box(w*0.6,0.35,0.02,0x1a1a1e,0,1.0,-0.33);
  B.addUse("work", x, z, { label: "WORK", r: 1.5 });
}
export function fWardrobe(B,x,z,ry,w,d,h,col){w=w||1.2;d=d||0.6;h=h||2.1;col=col||0xd9a878;const F=mkF(B,x,z,ry);F.box(w,h,d,col,0,h/2,0,true);F.box(w+0.06,0.07,d+0.06,0xb98a58,0,h+0.035,0);F.box(0.03,0.3,0.03,0xffd700,-0.06,h*0.55,d/2+0.02);F.box(0.03,0.3,0.03,0xffd700,0.06,h*0.55,d/2+0.02);
  B.addUse("wardrobe", x, z, { label: "USE WARDROBE", r: 1.5 });
}
export function fDresser(B,x,z,ry,w,d,h,col){w=w||1.2;d=d||0.45;h=h||0.8;col=col||0xb87a5a;const F=mkF(B,x,z,ry);F.box(w,h,d,col,0,h/2,0,true);F.box(w+0.03,0.04,d+0.03,0x8a5a3a,0,h+0.02,0);for(let i=0;i<3;i++)F.box(w-0.08,h/3-0.06,0.02,0x9a6a48,0,h*(i+0.5)/3,d/2+0.005);B.addUse("dresser",x,z,{label:"OPEN DRAWERS",r:1.4});}
export function fRug(B,x,z,ry,w,d,col,inner){const F=mkF(B,x,z,ry||0);F.box(w,0.02,d,col||0xc0303a,0,0.012,0);F.box(w-0.14,0.006,d-0.14,inner||0xffd98a,0,0.026,0);B.addUse("rug",x,z,{label:"STRAIGHTEN RUG",r:1.2});}
export function fPlant(B,x,z){const F=mkF(B,x,z,0);F.cyl(0.17,0.13,0.3,10,0xc86a3a,0,0.15,0);F.cyl(0.19,0.19,0.03,10,0xa85a2a,0,0.3,0);F.cyl(0.32,0.10,0.55,8,0x3fa83a,0,0.95,0);F.cyl(0.24,0.08,0.42,8,0x4ac044,0,1.15,0);B.addUse("plant",x,z,{label:"WATER PLANT",r:1.25});}
export function fWindow(B,x,z,ry,w,h,sill){w=w||1.4;h=h||1.3;sill=sill||0.9;const F=mkF(B,x,z,ry);F.glow(w,h,0.03,0xd8f0ff,0,sill+h/2,0.015);F.box(w+0.16,0.09,0.1,0xfff8f0,0,sill-0.03,0.05);F.box(w+0.16,0.09,0.1,0xfff8f0,0,sill+h+0.03,0.05);F.box(0.09,h+0.15,0.1,0xfff8f0,-w/2-0.035,sill+h/2,0.05);F.box(0.09,h+0.15,0.1,0xfff8f0,w/2+0.035,sill+h/2,0.05);B.addUse("window",x,z,{label:"OPEN WINDOW",r:1.5});}
export function fToilet(B,x,z,ry){const F=mkF(B,x,z,ry);F.box(0.4,0.4,0.22,0xf8fafc,0,0.2,-0.28);F.cyl(0.19,0.16,0.4,10,0xf8fafc,0,0.2,0.05);F.box(0.38,0.06,0.5,0xf8fafc,0,0.43,-0.05);
  B.addSeat(x, z, ry, "toilet", "USE TOILET", 0.48);
}
export function fVanity(B,x,z,ry,w){w=w||0.8;const F=mkF(B,x,z,ry);F.box(w,0.8,0.48,0xa86a8a,0,0.4,0,true);F.box(w+0.04,0.05,0.52,0xf0f0f4,0,0.825,0);F.cyl(0.02,0.02,0.24,6,0xd0d4d8,0,0.99,-0.18);F.box(w*0.8,0.7,0.03,0xc8e8f8,0,1.6,-0.22);
  B.addUse("sink", x, z, { label: "WASH", r: 1.5 });
}
export function fShower(B,x,z,ry,w,d){w=w||1;d=d||1;const F=mkF(B,x,z,ry);F.box(w,0.1,d,0xeef2f5,0,0.05,0,true);F.glow(w-0.1,2,0.02,0xa8e0f8,0,1.1,-d/2+0.06);
  B.addSeat(x, z, ry, "bath", "TAKE A SHOWER", 0.30);
}
export function fBathtub(B,x,z,ry,w,d){w=w||1.6;d=d||0.75;const F=mkF(B,x,z,ry);F.box(w,0.55,d,0xfafcfd,0,0.275,0,true);F.box(w-0.14,0.06,d-0.14,0xbfe8ff,0,0.53,0);
  B.addSeat(x, z, ry, "bath", "TAKE A BATH", 0.30);
}
export const fTub = fBathtub;
export function fBookshelf(B,x,z,ry,w,h,d,col){w=w||2;h=h||2.2;d=d||0.35;col=col||0x8a5a2a;const F=mkF(B,x,z,ry);F.box(w,0.06,d,col,0,0.03,0);F.box(w,0.06,d,col,0,h-0.03,0);F.box(0.06,h,d,col,-w/2+0.03,h/2,0);F.box(0.06,h,d,col,w/2-0.03,h/2,0);const cols=[0xe04040,0x4080e0,0x40c060,0xf0c020,0xa040e0,0x20c0d0];for(let r=0;r<3;r++){const y=0.06+(h-0.12)*(r+1)/4;F.box(w-0.12,0.04,d-0.06,col,0,y,0);let bx=-w/2+0.14,k=0;while(bx<w/2-0.16){const bw=0.05+((k*37+r*11)%5)*0.014;const bh=0.20+((k*53+r*7)%4)*0.022;F.box(bw,bh,d-0.14,cols[(r*3+k)%cols.length],bx+bw/2,y+0.022+bh/2,-0.02);bx+=bw+0.012;k++;}}
  B._collide(w, d, x, z, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  B.addUse("read", x + (d/2+0.3)*s, z + (d/2+0.3)*c, { label: "READ", r: 1.5 });
}
export function fFireplace(B,x,z,ry){const F=mkF(B,x,z,ry);F.box(2.2,1.6,0.5,0xe8d8c8,0,0.8,0,true);F.box(1.2,0.9,0.22,0x18181a,0,0.62,0.2);F.glow(0.94,0.64,0.05,0xff7a2a,0,0.52,0.29);B.addUse("fireplace",x,z,{label:"LIGHT FIREPLACE",r:1.7});}
export function fChandelier(B,x,z,y,r){r=r||0.9;B.cyl(0.03,0.03,0.7,6,0xffd54a,x,y-0.35,z);B.glowCyl(0.34,0.46,0.46,10,0xfff0b0,x,y-0.9,z);for(let i=0;i<8;i++){const a=i*Math.PI/4;B.glowCyl(0.055,0.055,0.18,6,0xfff8d8,x+Math.cos(a)*r,y-0.72,z+Math.sin(a)*r);}B.addUse("chandelier",x,z,{label:"SWITCH CHANDELIER",r:1.6});}
export function fLampCeil(B,x,z,y){B.glowCyl(0.26,0.32,0.10,12,0xfff8dc,x,y-0.22,z);B.addUse("lamp",x,z,{label:"SWITCH CEILING LIGHT",r:1.8});}
export function fPainting(B,x,z,ry,w,h,col){w=w||0.9;h=h||0.7;col=col||0x4a8ae0;const F=mkF(B,x,z,ry);F.box(w+0.1,h+0.1,0.05,0xffc83a,0,1.7,0.03);F.box(w,h,0.02,col,0,1.7,0.06);B.addUse("painting",x,z,{label:"INSPECT PAINTING",r:1.3});}
export function fBench(B,x,z,ry,col){col=col||0x3a3a48;const F=mkF(B,x,z,ry);F.box(1.3,0.14,0.4,col,0,0.45,0,true);[[-0.5,-0.14],[0.5,-0.14],[-0.5,0.14],[0.5,0.14]].forEach(p=>F.box(0.08,0.38,0.08,0x2a2a30,p[0],0.19,p[1]));B.addSeat(x, z, ry + Math.PI, "sit", "SIT", 0.50);}
export function fTreadmill(B,x,z,ry,col){col=col||0xe04040;const F=mkF(B,x,z,ry);F.box(0.7,0.14,1.8,0x2a2a30,0,0.1,0,true);F.box(0.6,0.06,1.6,col,0,0.18,0);F.box(0.7,0.05,0.3,0x3a3a48,0,0.95,-0.8);
  B.addUse("gym", x, z, { label: "RUN", r: 1.8 });
}
/* ══════════════════════════════════════════════════════════════
   fMirror — wall-mounted mirror. The frame is a warm wood box,
   and the glass is a slightly recessed, cool-tinted panel so it
   reads as reflective at low-poly resolution.

   Signature matches the governor.js call:
     F.fMirror(B, x, z, y, ry, w, h)
   Note: governor.js passes (x, z, y, ry, w, h) in that order at
   line 229 — we read it positionally and shift the y into place.
   ══════════════════════════════════════════════════════════════ */
export function fMirror(B, x, z, y, ry, w, h) {
  /* governor.js is calling this with (x, z, y, ry, w, h) — 6 args.
     But it's also called with (x, y, z, ry, w, h) at line 233 in the
     master en-suite. Detect which by whether the third argument is
     smaller than the second (a height is usually ~1.8, a z is ~29). */
  let px = x, py = y, pz = z, pry = ry;
  /* If the caller passed (x, z, y, ...) then arg2 < arg1 and arg3 > arg2.
     If the caller passed (x, y, z, ...) then arg2 < arg3 (y < z). */
  if (arguments.length >= 6) {
    /* We have 6 args. Determine layout by magnitude:
       - x is around 10-20 for bedroom calls, z is around 26-34,
         y is around 1.5-2.
       - If arg2 (z) is much bigger than arg3 (y), the caller used
         (x, z, y, ...) — swap them. */
    const a2 = arguments[1], a3 = arguments[2];
    if (Math.abs(a2) > Math.abs(a3) * 4) {
      /* (x, z, y, ...) — swap so py=a3, pz=a2 */
      py = a3; pz = a2;
    } else {
      /* (x, y, z, ...) — already correct */
      py = a2; pz = a3;
    }
    /* governor.js always uses 6 args:
         F.fMirror(B, X, Z, Y, RY, W, H)  — 7 args at line 229? no, 6
       Let's just accept both. */
  }

  const W2 = (w != null ? w : 1.2);
  const H2 = (h != null ? h : 1.0);

  /* Frame */
  const frameColor = 0x6a4a2a;
  const glassColor = 0x1a2a3a;

  const F = mkF(B, px, pz, pry);

  /* Wall plate — dark wood slab */
  F.box(W2 + 0.10, H2 + 0.10, 0.06, frameColor, 0, py, 0.035, false);
  /* Inner bevel — lighter wood inner frame */
  F.box(W2 + 0.02, H2 + 0.02, 0.04, 0x8a6a3a, 0, py, 0.065, false);
  /* Glass panel — cool tint */
  F.box(W2 - 0.06, H2 - 0.06, 0.02, glassColor, 0, py, 0.085, false);
  /* Highlight streak to fake reflectivity */
  F.box(W2 * 0.35, H2 * 0.18, 0.008, 0xa8c8e0, -W2 * 0.15, py + H2 * 0.28, 0.095, false);
  /* Second smaller streak */
  F.box(W2 * 0.18, H2 * 0.08, 0.006, 0xc8e0f0, -W2 * 0.10, py + H2 * 0.38, 0.098, false);
  B.addUse("mirror",px,pz,{label:"CHECK APPEARANCE",r:1.4});

  return F;
}
export function fYoga(B,x,z,ry,col){const F=mkF(B,x,z,ry||0);F.box(0.7,0.03,1.6,col||0x40d0c0,0,0.02,0);
  B.addSeat(x, z, ry, "lie", "DO YOGA", 0.10);
}
export function fDumbbell(B,x,z,ry){const F=mkF(B,x,z,ry||0);F.box(1.2,0.1,0.45,0x3a3a48,0,0.5,0,true);const cols=[0xe04040,0x40c060,0x4080e0,0xf0c020];for(let i=0;i<4;i++)F.cyl(0.07,0.07,0.12,8,cols[i],-0.42+i*0.28,0.6,0);
  B.addUse("lift", x, z, { label: "LIFT", r: 1.6 });
}
export function fBigScreen(B,x,z,ry,w,h){w=w||4.6;h=h||2.2;const F=mkF(B,x,z,ry);F.box(w+0.3,h+0.3,0.18,0x14141c,0,h/2+0.5,0);F.glow(w,h,0.04,0x4aa0ff,0,h/2+0.5,0.12);B.addUse("big_screen",x,z,{label:"START BIG SCREEN",r:2.5});}
export function fLounger(B,x,z,ry,col){col=col||0xfff0d0;const F=mkF(B,x,z,ry);F.box(0.7,0.1,1.8,col,0,0.25,0,true);F.box(0.7,0.45,0.1,0xe0d0b0,0,0.55,-0.85);[[-0.28,-0.7],[0.28,-0.7],[-0.28,0.7],[0.28,0.7]].forEach(p=>F.box(0.06,0.2,0.06,0xb0a090,p[0],0.1,p[1]));B.addSeat(x, z, ry, "lie", "LIE DOWN", 0.55);}
export function fCinemaSeat(B,x,z,ry,col,yOff){col=col||0xc02030;yOff=yOff||0;const F=mkF(B,x,z,ry);F.box(0.6,0.42,0.58,col,0,0.21+yOff,0,true);F.box(0.6,0.55,0.14,col,0,0.7+yOff,-0.22);F.box(0.48,0.1,0.5,0xe84050,0,0.42+yOff,0.03);B.addSeat(x, z, ry + Math.PI, "sit", "SIT", 0.50 + yOff);}
export function fConsole(B,x,z,ry,w){w=w||1.3;const F=mkF(B,x,z,ry);F.box(w,0.06,0.38,0x6a4a2a,0,0.8,0,true);F.box(0.06,0.8,0.06,0x4a3018,-w/2+0.08,0.4,0);F.box(0.06,0.8,0.06,0x4a3018,w/2-0.08,0.4,0);B.addUse("console",x,z,{label:"USE GAME CONSOLE",r:1.5});}
export function fPiano(B,x,z,ry){const F=mkF(B,x,z,ry);F.box(1.5,0.4,1,0x1a1a1e,0,0.78,0,true);F.box(1.5,0.16,0.9,0x0e0e12,0,0.54,0);F.box(1.5,0.06,0.24,0xf4f2ec,0,0.82,0.48);F.box(1.52,0.05,1.02,0x2a2a30,0,1,0);
  B.addUse("play", x, z, { label: "PLAY PIANO", r: 1.5 });
}
export function fDoorFrame(B,x,z,ry,w,h,col,plate){w=w||1;h=h||2.15;col=col||0xffc83a;plate=plate||0xffee88;const F=mkF(B,x,z,ry);F.box(0.1,h+0.1,0.22,col,-w/2-0.05,(h+0.1)/2,0);F.box(0.1,h+0.1,0.22,col,w/2+0.05,(h+0.1)/2,0);F.box(w+0.2,0.12,0.22,col,0,h+0.06,0);F.glow(0.34,0.2,0.04,plate,0,h+0.3,0.08);}
export function fPoleLamp(B,x,z){B.cyl(0.04,0.04,3.0,8,0x333340,x,1.5,z);B.glowCyl(0.16,0.22,0.30,10,0xfff0b0,x,3.20,z);B.cyl(0.18,0.14,0.10,8,0x333340,x,3.40,z);B.addUse("pole_lamp",x,z,{label:"SWITCH OUTDOOR LIGHT",r:1.6});}
export function fDumbbellRack(B,x,z,ry){const F=mkF(B,x,z,ry);F.box(1.20,0.10,0.45,0x3a3a48,0,0.50,0,true);F.box(0.08,0.50,0.08,0x2a2a30,-0.55,0.25,0);F.box(0.08,0.50,0.08,0x2a2a30,0.55,0.25,0);const cols=[0xe04040,0x40c060,0x4080e0,0xf0c020];for(let i=0;i<4;i++){F.cyl(0.07,0.07,0.12,8,cols[i],-0.42+i*0.28,0.60,0);F.cyl(0.07,0.07,0.12,8,cols[i],-0.42+i*0.28,0.60,0.18);}
  B.addUse("lift", x, z, { label: "LIFT", r: 1.6 });
}
export function fYogaMat(B,x,z,ry,col){col=col||0x40d0c0;const F=mkF(B,x,z,ry||0);F.box(0.70,0.03,1.60,col,0,0.02,0);F.box(0.70,0.03,0.20,0xffffff,0,0.025,0.70);
  B.addUse("yoga", x, z, { label: "DO YOGA", r: 1.6 });
}
export function fMansionEntranceDoor(B,x,z,w,h){
  w=w||6.0; h=h||2.15;
  const wood=0x5a2e12, wood2=0x8a4a20, gold=0xffc83a;
  const leafW = w/2 - 0.04;
  for (const s of [-1,1]){
    const cx = x + s*(leafW/2 + 0.02);
    B.box(leafW,h,0.16,wood,cx,h/2,z,0,true);
    B.box(leafW-0.28,h-0.44,0.03,wood2,cx,h/2,z+0.085,0);
    B.box(leafW-0.52,h-0.90,0.03,0x2e1808,cx,h/2,z+0.105,0);
    for (let i=0;i<4;i++){
      B.box(leafW-0.30,0.04,0.03,gold,cx,0.32+i*(h-0.64)/3,z+0.12,0);
    }
    const handleX = cx - s*(leafW/2 - 0.14);
    B.glowCyl(0.05,0.05,0.16,8,gold,handleX,1.10,z+0.10);
    B.glowCyl(0.05,0.05,0.16,8,gold,handleX,0.75,z+0.10);
    B.box(0.05,0.05,0.22,gold,handleX,1.10,z+0.14,0);
    B.box(0.05,0.05,0.22,gold,handleX,0.75,z+0.14,0);
  }
}

/* Minor fixtures with no earlier reference implementation anywhere
   in the codebase -- kept simple/blocky, matching the low-poly style
   of everything above. */
export function fPoolBasin(B,x,z,w,d){
  const F=mkF(B,x,z,0), rim=0.16, edgeY=0.07;
  F.glow(w,0.04,d,0x4ac0e8,0,0.0,0);
  /* A shallow base and four separate coping edges. The old single box was
     accidentally passed `true` as its rotation argument and did not describe
     a usable basin; these visual meshes intentionally do not block swimmers. */
  F.box(w+0.3,0.10,d+0.3,0xd8d4c8,0,-0.05,0,0,false);
  F.box(w+0.3,0.18,rim,0xd8d4c8,0,edgeY,-(d+0.3)/2,0,false);
  F.box(w+0.3,0.18,rim,0xd8d4c8,0,edgeY,(d+0.3)/2,0,false);
  F.box(rim,0.18,d,0xd8d4c8,-(w+0.3)/2,edgeY,0,0,false);
  F.box(rim,0.18,d,0xd8d4c8,(w+0.3)/2,edgeY,0,0,false);
  B.addUse("pool",x,z,{label:"SWIM IN POOL",r:2.2,poolW:w,poolD:d,waterY:(B.yOff||0)+0.04});
}
export function fShowPlinth(B,x,z,h){h=h||2.0;const F=mkF(B,x,z,0);F.box(1.0,h,1.0,0xe8e4dc,0,h/2,0,true);F.glow(1.1,0.03,1.1,0xfff8e0,0,h+0.02,0);B.addUse("show_plinth",x,z,{label:"INSPECT DISPLAY",r:1.4});}
export function fStage(B,x,z,ry,w,d,h){h=h||0.6;const F=mkF(B,x,z,ry||0);F.box(w,h,d,0x3a2a4a,0,h/2,0,true);F.glow(w*0.9,0.02,d*0.9,0xffd070,0,h+0.01,0);B.addUse("stage",x,z,{label:"STEP ON STAGE",r:2.0});}
export function fPlaySlide(B,x,z,ry){const F=mkF(B,x,z,ry||0);F.box(1.0,0.1,2.4,0xf0c020,0,1.2,0,true);F.box(1.0,1.2,0.1,0xf0c020,0,0.6,1.15,true);F.box(0.1,1.3,0.3,0x3a8ae0,-0.5,0.65,0.9);F.box(0.1,1.3,0.3,0x3a8ae0,0.5,0.65,0.9);B.addUse("slide",x,z,{label:"USE PLAYGROUND SLIDE",r:2.0});}

/* -------------------- materials + finalize -------------------- */

export function makeMats(){
  return {
    lit:  new THREE.MeshLambertMaterial({ vertexColors: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    ceil: new THREE.MeshLambertMaterial({ vertexColors: true }),
  };
}

export function finalize(B, mats, group){
  mats = mats || makeMats();
  const ceilMeshes = [];
  const push = (arr, mat) => {
    if (!arr || arr.length === 0) return null;
    const merged = mergeGeometries(arr, false);
    arr.length = 0;
    if (!merged) return null;
    const m = new THREE.Mesh(merged, mat);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    group.add(m);
    return m;
  };
  push(B.lit, mats.lit);
  push(B.glow, mats.glow);
  const cm = push(B.ceilParts, mats.ceil);
  if (cm) ceilMeshes.push(cm);
  B.lit = []; B.glow = []; B.ceilParts = [];
  /* Returned as an object (destructured by callers like
     places/mansion/interior.js: `{ ceilMeshes } = finalize(...)`)
     but also usable as the group directly in boolean/property
     contexts since `group` itself is also attached. */
  return { group, ceilMeshes };
}

/* -------------------- room-type auto-furnish -------------------- */

export function furnish(type, g, cx, cz, w, d, h) {
  const B = new Builder(cx, cz);

  const sw = w * 0.7; // usable space width
  const sd = d * 0.7; // usable space depth

  if (type === "reception" || type === "lobby") {
    fRug(B, 0, 0, 0, sw, sd, 0xc0303a, 0xffd98a);
    fSofa(B, -sw*0.2, 0, Math.PI/2, sw*0.4, 1.0, 0x2a5a8a);
    fCoffeeTable(B, 0, 0, 0, 2.0, 1.0);
    fPlant(B, sw*0.4, sd*0.4);
    fPlant(B, -sw*0.4, sd*0.4);
    fChandelier(B, 0, 0, h-0.2, 1.0);
    fDesk(B, 0, sd*0.3, Math.PI, 3.0);
    fChair(B, 0, sd*0.3 + 1.2, 0);
  }
  else if (type === "office" || type === "control" || type === "librarian" || type === "bursary" || type === "registry") {
    fDesk(B, 0, 0, 0, 3.0);
    fChair(B, 0, -1.2, 0);
    fChair(B, -1.5, 1.5, Math.PI);
    fChair(B, 1.5, 1.5, Math.PI);
    fBookshelf(B, -sw*0.4, 0, Math.PI/2, 3.0);
    fPlant(B, sw*0.4, sd*0.4);
    fRug(B, 0, 0, 0, 5, 4, 0x4a3a2a);
  }
  else if (type === "meeting" || type === "senate") {
    fDiningTable(B, 0, 0, 0, sw*0.6, sd*0.3, 0x6a3a5a);
    for(let i=0; i<4; i++){
      fChair(B, -sw*0.2 + i*(sw*0.4/3), -sd*0.2, 0);
      fChair(B, -sw*0.2 + i*(sw*0.4/3), sd*0.2, Math.PI);
    }
    fChandelier(B, 0, 0, h-0.2, 1.2);
  }
  else if (type === "bedroom") {
    fRug(B, 0, 0, 0, sw*0.6, sd*0.6, 0x3a2a4a);
    fBed(B, 0, 0, 0, { w: 2.0, len: 2.2 });
    fNightstand(B, -1.8, -1.0, 0);
    fNightstand(B, 1.8, -1.0, 0);
    fWardrobe(B, -sw*0.4, sd*0.2, Math.PI/2, 2.0);
    fArmchair(B, sw*0.3, sd*0.3, -Math.PI/4);
    fLamp(B, -1.8, -1.0, 0);
  }
  else if (type === "living" || type === "lounge" || type === "cabin") {
    fRug(B, 0, 0, 0, sw*0.6, sd*0.5, 0x6a4a3a);
    fSofa(B, 0, -sd*0.2, 0, sw*0.5, 1.0);
    fSofa(B, -sw*0.25, sd*0.1, Math.PI/2, sw*0.4, 1.0);
    fArmchair(B, sw*0.25, sd*0.1, -Math.PI/2);
    fCoffeeTable(B, 0, sd*0.1, 0, 2.5, 1.5);
    fTV(B, 0, -sd*0.4, 0, sw*0.4);
  }
  else if (type === "kitchen" || type === "cafe" || type === "stall") {
    fKitchen(B, -sw*0.4, 0, Math.PI/2, sw*0.6);
    fFridge(B, -sw*0.4, sd*0.3, Math.PI/2);
    fIsland(B, 0, 0, 0, sw*0.4, 1.5);
    for(let i=0; i<3; i++) fChair(B, -1.0 + i*1.0, -1.5, Math.PI);
    fDiningTable(B, sw*0.2, sd*0.2, 0, 3.0, 1.5);
    for(let i=0; i<3; i++) {
      fChair(B, sw*0.2 - 1.0 + i*1.0, sd*0.2 - 1.2, 0);
      fChair(B, sw*0.2 - 1.0 + i*1.0, sd*0.2 + 1.2, Math.PI);
    }
  }
  else if (type === "dining") {
    fDiningTable(B, 0, 0, 0, sw*0.7, sd*0.4);
    for(let i=0; i<4; i++) {
      fChair(B, -sw*0.25 + i*(sw*0.5/3), -sd*0.25, 0);
      fChair(B, -sw*0.25 + i*(sw*0.5/3), sd*0.25, Math.PI);
    }
    fChandelier(B, 0, 0, h-0.2, 1.0);
  }
  else if (type === "bath" || type === "treatment" || type === "changing") {
    fBathtub(B, -sw*0.3, 0, 0, 2.0, 0.8);
    fToilet(B, sw*0.3, -sd*0.3, -Math.PI/2);
    fVanity(B, sw*0.3, sd*0.3, 0);           // was Math.PI — mirror now faces −z into the room
    fShower(B, -sw*0.3, sd*0.3, 0, 1.0, 1.0);
  }
  else if (type === "ward") {
    fBed(B, -sw*0.2, 0, 0);
    fBed(B, sw*0.2, 0, 0);
    fNightstand(B, 0, -1.0, 0);
  }
  else if (type === "gym") {
    fTreadmill(B, -sw*0.3, -sd*0.2, 0);
    fTreadmill(B, -sw*0.3, sd*0.2, 0);
    fBench(B, sw*0.3, -sd*0.2, 0);
    fBench(B, sw*0.3, sd*0.2, 0);
  }
  else if (type === "library" || type === "lecture" || type === "study") {
    fBookshelf(B, -sw*0.4, -sd*0.2, Math.PI/2, 3.0);
    fBookshelf(B, -sw*0.4, sd*0.2, Math.PI/2, 3.0);
    fBookshelf(B, sw*0.4, 0, -Math.PI/2, 4.0);
    fDesk(B, 0, 0, 0, sw*0.5);
    fChair(B, 0, -1.0, 0);
    fChair(B, -1.5, -1.0, 0);
    fChair(B, 1.5, -1.0, 0);
    fChair(B, 0, 1.5, Math.PI);
    fChair(B, -1.5, 1.5, Math.PI);
    fChair(B, 1.5, 1.5, Math.PI);
  }
  else if (type === "pool") {
    fPoolBasin(B, 0, 0, sw*0.8, sd*0.6);
  }
  else if (type === "showroom") {
    fShowPlinth(B, 0, 0, 2.5);
    fShowPlinth(B, -sw*0.3, sd*0.3, 2.0);
    fShowPlinth(B, sw*0.3, sd*0.3, 2.0);
  }
  else if (type === "stage") {
    fStage(B, 0, 0, 0, sw*0.8, sd*0.4, 0.8);
  }
  else if (type === "playground") {
    fPlaySlide(B, 0, 0, 0);
  }
  else {
    fDesk(B, 0, 0, 0, 2.0);
    fChair(B, 0, 1.2, Math.PI);
  }

  finalize(B, makeMats(), g);

  if (!g.userData.interactions) g.userData.interactions = { colliders: [], seats: [], uses: [] };
  g.userData.interactions.colliders.push(...B.colliders);
  g.userData.interactions.seats.push(...B.seats);
  g.userData.interactions.uses.push(...B.uses);
}

