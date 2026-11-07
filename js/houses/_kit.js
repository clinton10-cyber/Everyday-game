/* Shared building kit for house interiors (extracted from scenes/house-interior.js). */
import * as THREE from 'three';

const _c = new THREE.Color();
export const SPACE_SCALE = 1.0;

export class Builder {
  constructor(ox, oz) {
    this.ox = ox || 0; this.oz = oz || 0;
    this.yOff = 0; this.level = 0;
    this.lit = []; this.glow = []; this.ceilParts = [];
    this.colliders = [];
    this.S = SPACE_SCALE;
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
}

export function mkF(B,x,z,ry){
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

export function fBed(B,x,z,ry,o){
  o=o||{};
  const S=B.S;
  const w=o.w||1.6, l=o.l||2.05;
  const F=mkF(B,x,z,ry);
  F.box((w+0.12)*S,0.28,(l+0.12)*S,o.frame||0x8a5a34,0,0.17,0,true);
  F.box(w*S,0.26,l*S,o.matt||0xfff8ec,0,0.42,0);
  F.box((w+0.06)*S,0.14,l*0.6*S,o.duvet||0x3d8ea8,0,0.60,l*0.16*S);
  F.box(w*0.4*S,0.14,0.34*S,o.pillow||0xfffdf6,-w*0.24*S,0.60,-l*0.32*S);
  F.box(w*0.4*S,0.14,0.34*S,o.pillow||0xfffdf6,w*0.24*S,0.60,-l*0.32*S);
  F.box((w+0.24)*S,1.0,0.10*S,o.head||0x6a4a2c,0,0.80,-l/2*S-0.10);
}
export function fNightstand(B,x,z,ry,c){const S=B.S;const F=mkF(B,x,z,ry);F.box(0.5*S,0.55,0.42*S,c||0xb08a5c,0,0.275,0,true);F.box(0.46*S,0.03,0.38*S,0x8a6a44,0,0.56,0);}
export function fLamp(B,x,z,ry){const S=B.S;const F=mkF(B,x,z,ry);F.cyl(0.09*S,0.12*S,0.03,8,0x3a3a44,0,0.02,0);F.cyl(0.02*S,0.02*S,0.35,6,0x3a3a44,0,0.20,0);F.glowCyl(0.13*S,0.17*S,0.22,10,0xffe070,0,0.46,0);}
export function fSofa(B,x,z,ry,len,d,col,cush){
  const S=B.S;
  len=(len||2.1)*S; d=(d||0.9)*S; col=col||0xe0604a; cush=cush||0xf08a6a;
  const F=mkF(B,x,z,ry);
  F.box(len,0.34,d,col,0,0.21,0,true);
  F.box(len,0.62,0.18*S,col,0,0.65,-d/2+0.09*S);
  F.box(0.18*S,0.34,d,col,-len/2+0.09*S,0.55,0);
  F.box(0.18*S,0.34,d,col,len/2-0.09*S,0.55,0);
  const n=Math.max(2,Math.round(len/(0.8*S))), cw=(len-0.36*S)/n;
  for(let i=0;i<n;i++){const cx=-len/2+0.18*S+cw*(i+0.5);
    F.box(cw-0.05*S,0.16,d-0.30*S,cush,cx,0.46,0.06*S);
    F.box(cw-0.05*S,0.44,0.16*S,cush,cx,0.72,-d/2+0.26*S);}
}
export function fArmchair(B,x,z,ry,col,cush){const S=B.S;const F=mkF(B,x,z,ry);col=col||0xd94f8a;cush=cush||0xee7aa8;F.box(0.85*S,0.35,0.85*S,col,0,0.22,0,true);F.box(0.85*S,0.6,0.16*S,col,0,0.66,-0.35*S);F.box(0.16*S,0.32,0.85*S,col,-0.35*S,0.55,0);F.box(0.16*S,0.32,0.85*S,col,0.35*S,0.55,0);F.box(0.66*S,0.14,0.66*S,cush,0,0.46,0.04*S);F.box(0.66*S,0.42,0.14*S,cush,0,0.74,-0.28*S);}
export function fCoffee(B,x,z,ry,w,d){const S=B.S;w=(w||1)*S;d=(d||0.55)*S;const F=mkF(B,x,z,ry);F.box(w,0.06,d,0xa8663a,0,0.42,0,true);F.box(w-0.2*S,0.04,d-0.2*S,0x7a4a24,0,0.20,0);const lx=w/2-0.07*S,lz=d/2-0.07*S;[[-lx,-lz],[lx,-lz],[-lx,lz],[lx,lz]].forEach(p=>F.box(0.07*S,0.4,0.07*S,0x7a4a24,p[0],0.20,p[1]));}
export function fTV(B,x,z,ry,w){const S=B.S;w=(w||1.7)*S;const F=mkF(B,x,z,ry);F.box(w,0.42,0.4*S,0x2a2a34,0,0.21,0,true);F.box(w-0.06*S,0.02,0.36*S,0x3a3a48,0,0.43,0);F.box(w*0.92,0.62,0.05*S,0x0a0a10,0,1.05,0.06*S);F.glow(w*0.86,0.54,0.02,0x2a6ad0,0,1.05,0.09*S);}
export function fKitchen(B,x,z,ry,len,o){const S=B.S;o=o||{};len=len*S;const cab=o.cab||0x5ac8a0, top=o.top||0x2f3237;const F=mkF(B,x,z,ry);F.box(len,0.85,0.62*S,cab,0,0.425,0,true);F.box(len+0.04*S,0.05,0.66*S,top,0,0.875,0);F.box(len,0.72,0.34*S,cab,0,2.06,-0.14*S);F.box(len+0.02*S,0.03,0.36*S,0xdfe4e8,0,1.69,-0.14*S);}
export function fSink(B,x,z,ry){const S=B.S;const F=mkF(B,x,z,ry);F.box(0.66*S,0.02,0.44*S,0xc9ced5,0,0.905,0);F.box(0.56*S,0.14,0.36*S,0x6d737b,0,0.83,0);F.cyl(0.02*S,0.02*S,0.26,6,0xc9ced5,0,1.03,-0.16*S);}
export function fStove(B,x,z,ry){const S=B.S;const F=mkF(B,x,z,ry);F.box(0.62*S,0.02,0.54*S,0x1b1d21,0,0.90,0);const p=0.15*S;[[-p,-p],[p,-p],[-p,p],[p,p]].forEach(q=>F.cyl(0.09*S,0.09*S,0.015,10,0xff5a3a,q[0],0.915,q[1]));}
export function fFridge(B,x,z,ry,c){const S=B.S;const F=mkF(B,x,z,ry);F.box(0.75*S,1.85,0.70*S,c||0xd0d6dc,0,0.925,0,true);F.box(0.75*S,0.02,0.7*S,0xa9adb3,0,1.25,0);}
export function fIsland(B,x,z,ry,w,d,o){const S=B.S;o=o||{};w=w*S;d=d*S;const F=mkF(B,x,z,ry);F.box(w,0.88,d,o.cab||0x5ac8a0,0,0.44,0,true);F.box(w+0.08*S,0.06,d+0.08*S,o.top||0x2f3237,0,0.91,0);}
export function fDining(B,x,z,ry,w,d,col){const S=B.S;w=w*S;d=d*S;const F=mkF(B,x,z,ry);F.box(w,0.07,d,col||0x8a4a6a,0,0.75,0,true);const lx=w/2-0.1*S,lz=d/2-0.1*S;[[-lx,-lz],[lx,-lz],[-lx,lz],[lx,lz]].forEach(p=>F.box(0.09*S,0.72,0.09*S,0x5a2a44,p[0],0.36,p[1]));}
export function fChair(B,x,z,ry,col){const S=B.S;const F=mkF(B,x,z,ry);col=col||0xd9a04a;F.box(0.42*S,0.05,0.42*S,col,0,0.45,0,true);F.box(0.42*S,0.5,0.05*S,col,0,0.72,-0.19*S);[[-0.17*S,-0.17*S],[0.17*S,-0.17*S],[-0.17*S,0.17*S],[0.17*S,0.17*S]].forEach(p=>F.box(0.05*S,0.45,0.05*S,0x8a6428,p[0],0.225,p[1]));}
export function fWardrobe(B,x,z,ry,w,d,h,col){const S=B.S;w=(w||1.2)*S;d=(d||0.6)*S;h=h||2.1;col=col||0xd9a878;const F=mkF(B,x,z,ry);F.box(w,h,d,col,0,h/2,0,true);F.box(w+0.06*S,0.07,d+0.06*S,0xb98a58,0,h+0.035,0);F.box(0.03*S,0.3,0.03*S,0xffd700,-0.06*S,h*0.55,d/2+0.02*S);F.box(0.03*S,0.3,0.03*S,0xffd700,0.06*S,h*0.55,d/2+0.02*S);}
export function fDresser(B,x,z,ry,w,d,h,col){const S=B.S;w=(w||1.2)*S;d=(d||0.45)*S;h=h||0.8;col=col||0xb87a5a;const F=mkF(B,x,z,ry);F.box(w,h,d,col,0,h/2,0,true);F.box(w+0.03*S,0.04,d+0.03*S,0x8a5a3a,0,h+0.02,0);for(let i=0;i<3;i++)F.box(w-0.08*S,h/3-0.06*S,0.02,0x9a6a48,0,h*(i+0.5)/3,d/2+0.005);}
export function fRug(B,x,z,ry,w,d,col,inner){const S=B.S;w=w*S;d=d*S;const F=mkF(B,x,z,ry);F.box(w,0.02,d,col||0xc0303a,0,0.012,0);F.box(w-0.14*S,0.006,d-0.14*S,inner||0xffd98a,0,0.026,0);}
export function fPlant(B,x,z){const S=B.S;const F=mkF(B,x,z,0);F.cyl(0.17*S,0.13*S,0.3,10,0xc86a3a,0,0.15,0);F.cyl(0.19*S,0.19*S,0.03,10,0xa85a2a,0,0.3,0);F.cyl(0.32*S,0.10*S,0.55,8,0x3fa83a,0,0.95,0);F.cyl(0.24*S,0.08*S,0.42,8,0x4ac044,0,1.15,0);}
export function fWindow(B,x,z,ry,w,h,sill){const S=B.S;w=(w||1.4)*S;h=(h||1.3)*S;sill=sill||0.9;const F=mkF(B,x,z,ry);F.glow(w,h,0.03,0xd8f0ff,0,sill+h/2,0.015);F.box(w+0.16*S,0.09,0.1,0xfff8f0,0,sill-0.03,0.05*S);F.box(w+0.16*S,0.09,0.1,0xfff8f0,0,sill+h+0.03,0.05*S);F.box(0.09*S,h+0.15,0.1,0xfff8f0,-w/2-0.035*S,sill+h/2,0.05*S);F.box(0.09*S,h+0.15,0.1,0xfff8f0,w/2+0.035*S,sill+h/2,0.05*S);}
export function fToilet(B,x,z,ry){const S=B.S;const F=mkF(B,x,z,ry);F.box(0.4*S,0.4,0.22*S,0xf8fafc,0,0.2,-0.28*S);F.cyl(0.19*S,0.16*S,0.4,10,0xf8fafc,0,0.2,0.05*S);F.box(0.38*S,0.06,0.5*S,0xf8fafc,0,0.43,-0.05*S);}
export function fVanity(B,x,z,ry,w){const S=B.S;w=(w||0.8)*S;const F=mkF(B,x,z,ry);F.box(w,0.8,0.48*S,0xa86a8a,0,0.4,0,true);F.box(w+0.04*S,0.05,0.52*S,0xf0f0f4,0,0.825,0);F.cyl(0.02*S,0.02*S,0.24,6,0xd0d4d8,0,0.99,-0.18*S);F.box(w*0.8,0.7,0.03,0xc8e8f8,0,1.6,-0.22*S);}
export function fShower(B,x,z,ry,w,d){const S=B.S;w=(w||1)*S;d=(d||1)*S;const F=mkF(B,x,z,ry);F.box(w,0.1,d,0xeef2f5,0,0.05,0,true);F.glow(w-0.1*S,2,0.02,0xa8e0f8,0,1.1,-d/2+0.06*S);}
export function fTub(B,x,z,ry,w,d){const S=B.S;w=(w||1.6)*S;d=(d||0.75)*S;const F=mkF(B,x,z,ry);F.box(w,0.55,d,0xfafcfd,0,0.275,0,true);F.box(w-0.14*S,0.06,d-0.14*S,0xbfe8ff,0,0.53,0);}
export function fBookshelf(B,x,z,ry,w,h,d,col){const S=B.S;w=(w||2)*S;h=h||2.2;d=(d||0.35)*S;col=col||0x8a5a2a;const F=mkF(B,x,z,ry);F.box(w,0.06,d,col,0,0.03,0);F.box(w,0.06,d,col,0,h-0.03,0);F.box(0.06,h,d,col,-w/2+0.03,h/2,0);F.box(0.06,h,d,col,w/2-0.03,h/2,0);const cols=[0xe04040,0x4080e0,0x40c060,0xf0c020,0xa040e0,0x20c0d0];for(let r=0;r<3;r++){const y=0.06+(h-0.12)*(r+1)/4;F.box(w-0.12,0.04,d-0.06*S,col,0,y,0);let bx=-w/2+0.14*S,k=0;while(bx<w/2-0.16*S){const bw=0.05*S+((k*37+r*11)%5)*0.014*S;const bh=0.20+((k*53+r*7)%4)*0.022;F.box(bw,bh,d-0.14*S,cols[(r*3+k)%cols.length],bx+bw/2,y+0.022+bh/2,-0.02);bx+=bw+0.012*S;k++;}}}
export function fFireplace(B,x,z,ry){const S=B.S;const F=mkF(B,x,z,ry);F.box(2.2*S,1.6,0.5*S,0xe8d8c8,0,0.8,0,true);F.box(1.2*S,0.9,0.22*S,0x18181a,0,0.62,0.2);F.glow(0.94*S,0.64,0.05,0xff7a2a,0,0.52,0.29);}
export function fChandelier(B,x,z,y,r){const S=B.S;r=(r||0.9)*S;B.cyl(0.03,0.03,0.7,6,0xffd54a,x,y-0.35,z);B.glowCyl(0.34*S,0.46*S,0.46*S,10,0xfff0b0,x,y-0.9,z);for(let i=0;i<8;i++){const a=i*Math.PI/4;B.glowCyl(0.055*S,0.055*S,0.18,6,0xfff8d8,x+Math.cos(a)*r,y-0.72,z+Math.sin(a)*r);}}
export function fLampCeil(B,x,z,y){B.glowCyl(0.26*B.S,0.32*B.S,0.10,12,0xfff8dc,x,y-0.22,z);}
export function fPainting(B,x,z,ry,w,h,col){const S=B.S;w=(w||0.9)*S;h=(h||0.7)*S;col=col||0x4a8ae0;const F=mkF(B,x,z,ry);F.box(w+0.1*S,h+0.1*S,0.05,0xffc83a,0,1.7,0.03);F.box(w,h,0.02,col,0,1.7,0.06);}
export function fBench(B,x,z,ry,col){const S=B.S;col=col||0x3a3a48;const F=mkF(B,x,z,ry);F.box(1.3*S,0.14,0.4*S,col,0,0.45,0,true);[[-0.5*S,-0.14*S],[0.5*S,-0.14*S],[-0.5*S,0.14*S],[0.5*S,0.14*S]].forEach(p=>F.box(0.08*S,0.38,0.08*S,0x2a2a30,p[0],0.19,p[1]));}
export function fTreadmill(B,x,z,ry,col){const S=B.S;col=col||0xe04040;const F=mkF(B,x,z,ry);F.box(0.7*S,0.14,1.8*S,0x2a2a30,0,0.1,0,true);F.box(0.6*S,0.06,1.6*S,col,0,0.18,0);F.box(0.7*S,0.05,0.3*S,0x3a3a48,0,0.95,-0.8*S);}
export function fYoga(B,x,z,ry,col){const S=B.S;const F=mkF(B,x,z,ry);F.box(0.7*S,0.03,1.6*S,col||0x40d0c0,0,0.02,0);}
export function fDumbbell(B,x,z,ry){const S=B.S;const F=mkF(B,x,z,ry);F.box(1.2*S,0.1,0.45*S,0x3a3a48,0,0.5,0,true);const cols=[0xe04040,0x40c060,0x4080e0,0xf0c020];for(let i=0;i<4;i++)F.cyl(0.07*S,0.07*S,0.12,8,cols[i],-0.42*S+i*0.28*S,0.6,0);}
export function fBigScreen(B,x,z,ry,w,h){const S=B.S;w=(w||4.6)*S;h=(h||2.2)*S;const F=mkF(B,x,z,ry);F.box(w+0.3*S,h+0.3*S,0.18,0x14141c,0,h/2+0.5,0);F.glow(w,h,0.04,0x4aa0ff,0,h/2+0.5,0.12*S);}
export function fLounger(B,x,z,ry,col){const S=B.S;col=col||0xfff0d0;const F=mkF(B,x,z,ry);F.box(0.7*S,0.1,1.8*S,col,0,0.25,0,true);F.box(0.7*S,0.45,0.1,0xe0d0b0,0,0.55,-0.85*S);[[-0.28*S,-0.7*S],[0.28*S,-0.7*S],[-0.28*S,0.7*S],[0.28*S,0.7*S]].forEach(p=>F.box(0.06*S,0.2,0.06*S,0xb0a090,p[0],0.1,p[1]));}
export function fCinemaSeat(B,x,z,ry,col){const S=B.S;col=col||0xc02030;const F=mkF(B,x,z,ry);F.box(0.6*S,0.42,0.58*S,col,0,0.21,0,true);F.box(0.6*S,0.55,0.14*S,col,0,0.7,-0.22*S);F.box(0.48*S,0.1,0.5*S,0xe84050,0,0.42,0.03*S);}
export function fConsole(B,x,z,ry,w){const S=B.S;w=(w||1.3)*S;const F=mkF(B,x,z,ry);F.box(w,0.06,0.38*S,0x6a4a2a,0,0.8,0,true);F.box(0.06*S,0.8,0.06*S,0x4a3018,-w/2+0.08*S,0.4,0);F.box(0.06*S,0.8,0.06*S,0x4a3018,w/2-0.08*S,0.4,0);}
export function fPiano(B,x,z,ry){const S=B.S;const F=mkF(B,x,z,ry);F.box(1.5*S,0.4,1*S,0x1a1a1e,0,0.78,0,true);F.box(1.5*S,0.16,0.9*S,0x0e0e12,0,0.54,0);F.box(1.5*S,0.06,0.24*S,0xf4f2ec,0,0.82,0.48*S);F.box(1.52*S,0.05,1.02*S,0x2a2a30,0,1,0);}
export function fDoorFrame(B,x,z,ry,w,h,col,plate){const S=B.S;w=(w||1)*S;h=h||2.15;col=col||0xffc83a;plate=plate||0xffee88;const F=mkF(B,x,z,ry);F.box(0.1*S,h+0.1,0.22*S,col,-w/2-0.05*S,(h+0.1)/2,0);F.box(0.1*S,h+0.1,0.22*S,col,w/2+0.05*S,(h+0.1)/2,0);F.box(w+0.2*S,0.12,0.22*S,col,0,h+0.06,0);F.glow(0.34*S,0.2,0.04*S,plate,0,h+0.3,0.08*S);}

/* Desk — 1.5 × 0.75 × 0.75 m, four legs, monitor. */
export function fDesk(B, x, z, ry, w) {
  const S = B.S;
  w = (w || 1.5) * S;
  const F = mkF(B, x, z, ry);
  F.box(w, 0.06, 0.75 * S, 0x6a4a2c, 0, 0.72, 0, false);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    F.box(0.06 * S, 0.72, 0.06 * S, 0x4a3018,
      sx * (w / 2 - 0.1 * S), 0.36, sz * (0.75 * S / 2 - 0.1 * S), false);
  });
  F.box(w * 0.7, 0.35, 0.02, 0x1a1a1e, 0, 0.95, -0.28 * S, false);
}
