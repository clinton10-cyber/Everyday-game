/* js/world/phworld.js -- shared Port Harcourt reference world.
   Base layer (grass + patches + river) and detail layer (roads,
   landmarks, buildings, trees) are built separately so the detail
   mesh (with polygonOffset) renders cleanly on top of the base
   without z-fighting. Both city.js and drive.js consume this. */

import * as THREE from "three";

/* ── 0. Deterministic RNG ─────────────────────────────────────── */
let _seed = 20240617;
function rnd(){ _seed = (Math.imul(_seed, 1664525) + 1013904223) | 0; return (_seed >>> 0) / 4294967296; }
function rr(a,b){ return a + (b-a)*rnd(); }
function rgb(hex){
  const n = parseInt(hex.slice(1), 16);
  return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
}

/* ── 1. Local transform: translate * Rz * Ry ──────────────────── */
function xf(x, y, z, ry, rz){
  const cy = Math.cos(ry||0), sy = Math.sin(ry||0);
  const cz = Math.cos(rz||0), sz = Math.sin(rz||0);
  return function(px, py, pz){
    const ax = px*cy + pz*sy;
    const az = -px*sy + pz*cy;
    return [ x + ax*cz - py*sz, y + ax*sz + py*cz, z + az ];
  };
}

/* ── 2. Geometry builder with base/detail split ───────────────── */
function GB(){
  this.p=[]; this.n=[]; this.c=[]; this.i=[]; this.v=0;
  this.bp=[]; this.bn=[]; this.bc=[]; this.bi=[]; this.bv=0;
  this._base = false;
}
GB.prototype.setBase = function(on){ this._base = !!on; };

GB.prototype.tri = function(ax,ay,az, bx,by,bz, cx,cy,cz, col){
  const ux=bx-ax, uy=by-ay, uz=bz-az;
  const vx=cx-ax, vy=cy-ay, vz=cz-az;
  let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
  const l=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
  nx/=l; ny/=l; nz/=l;
  const r=col[0], g=col[1], b=col[2];
  if (this._base) {
    this.bp.push(ax,ay,az, bx,by,bz, cx,cy,cz);
    this.bn.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
    this.bc.push(r,g,b, r,g,b, r,g,b);
    this.bi.push(this.bv, this.bv+1, this.bv+2);
    this.bv += 3;
  } else {
    this.p.push(ax,ay,az, bx,by,bz, cx,cy,cz);
    this.n.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
    this.c.push(r,g,b, r,g,b, r,g,b);
    this.i.push(this.v, this.v+1, this.v+2);
    this.v += 3;
  }
};
GB.prototype.quad = function(a,b,c,d,col){
  this.tri(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2], col);
  this.tri(a[0],a[1],a[2], c[0],c[1],c[2], d[0],d[1],d[2], col);
};
GB.prototype.box = function(w,h,d,x,y,z,col,ry,rz){
  const T = xf(x,y,z,ry,rz);
  const a=w*0.5, b=h*0.5, c=d*0.5;
  const p000=T(-a,-b,-c), p100=T(a,-b,-c), p110=T(a,b,-c), p010=T(-a,b,-c);
  const p001=T(-a,-b, c), p101=T(a,-b, c), p111=T(a,b, c), p011=T(-a,b, c);
  this.quad(p001,p101,p111,p011,col);
  this.quad(p100,p000,p010,p110,col);
  this.quad(p101,p100,p110,p111,col);
  this.quad(p000,p001,p011,p010,col);
  this.quad(p011,p111,p110,p010,col);
  this.quad(p000,p100,p101,p001,col);
};
GB.prototype.cyl = function(rt,rb,h,seg,x,y,z,col,ry,rz){
  const T = xf(x,y,z,ry,rz);
  const y0=-h*0.5, y1=h*0.5;
  const top=[], bot=[];
  for(let i=0;i<seg;i++){
    const a = i/seg*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
    top.push(T(rt*ca, y1, rt*sa));
    bot.push(T(rb*ca, y0, rb*sa));
  }
  const apTop = rt < 1e-4, apBot = rb < 1e-4;
  for(let i=0;i<seg;i++){
    const j=(i+1)%seg;
    if(apTop)      this.tri(bot[j][0],bot[j][1],bot[j][2], bot[i][0],bot[i][1],bot[i][2], top[0][0],top[0][1],top[0][2], col);
    else if(apBot) this.tri(top[i][0],top[i][1],top[i][2], top[j][0],top[j][1],top[j][2], bot[0][0],bot[0][1],bot[0][2], col);
    else           this.quad(bot[j],bot[i],top[i],top[j],col);
  }
  if(!apTop){
    const c0=T(0,y1,0);
    for(let i=0;i<seg;i++){ const j=(i+1)%seg;
      this.tri(c0[0],c0[1],c0[2], top[j][0],top[j][1],top[j][2], top[i][0],top[i][1],top[i][2], col); }
  }
  if(!apBot){
    const c0=T(0,y0,0);
    for(let i=0;i<seg;i++){ const j=(i+1)%seg;
      this.tri(c0[0],c0[1],c0[2], bot[i][0],bot[i][1],bot[i][2], bot[j][0],bot[j][1],bot[j][2], col); }
  }
};
GB.prototype.sphere = function(r, seg, rings, x,y,z, col, phiMax){
  phiMax = (phiMax===undefined) ? Math.PI : phiMax;
  const grid = [];
  for(let j=0;j<=rings;j++){
    const phi = phiMax * j/rings;
    const sy = Math.cos(phi)*r, sr = Math.sin(phi)*r;
    const row = [];
    for(let i=0;i<seg;i++){
      const th = i/seg*Math.PI*2;
      row.push([ x + sr*Math.cos(th), y + sy, z + sr*Math.sin(th) ]);
    }
    grid.push(row);
  }
  for(let j=0;j<rings;j++){
    for(let i=0;i<seg;i++){
      const i2=(i+1)%seg;
      this.quad(grid[j][i], grid[j][i2], grid[j+1][i2], grid[j+1][i], col);
    }
  }
};
GB.prototype.roof = function(w,h,d,x,y,z,col,ry){
  const T = xf(x,y,z,ry);
  const a=w*0.5, b=d*0.5;
  const p1=T(-a,0,-b), p2=T(a,0,-b), p3=T(a,0,b), p4=T(-a,0,b);
  const r1=T(-a,h,0), r2=T(a,h,0);
  this.quad(p4,p3,r2,r1,col);
  this.quad(p2,p1,r1,r2,col);
  this.tri(p2[0],p2[1],p2[2], r2[0],r2[1],r2[2], p3[0],p3[1],p3[2], col);
  this.tri(p1[0],p1[1],p1[2], p4[0],p4[1],p4[2], r1[0],r1[1],r1[2], col);
};
GB.prototype.flat = function(x,y,z,w,d,col,ry){
  const T = xf(x,y,z,ry);
  const a=w*0.5, b=d*0.5;
  this.quad(T(-a,0,-b), T(-a,0,b), T(a,0,b), T(a,0,-b), col);
};
GB.prototype.disc = function(x,y,z,r,seg,col){
  for(let i=0;i<seg;i++){
    const a=i/seg*Math.PI*2, a2=(i+1)/seg*Math.PI*2;
    const p1=[x+Math.cos(a)*r, y, z+Math.sin(a)*r];
    const p2=[x+Math.cos(a2)*r, y, z+Math.sin(a2)*r];
    this.tri(x,y,z, p2[0],p2[1],p2[2], p1[0],p1[1],p1[2], col);
  }
};
GB.prototype.panelXY = function(x,y,z,w,h,col,ry){
  const T = xf(x,y,z,ry);
  const a=w*0.5, b=h*0.5;
  this.quad(T(-a,-b,0), T(a,-b,0), T(a,b,0), T(-a,b,0), col);
};

GB.prototype._buildFrom = function(P, N, C, I){
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal",   new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color",    new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
};
GB.prototype.buildBase = function(){
  return this._buildFrom(this.bp, this.bn, this.bc, this.bi);
};
GB.prototype.buildDetail = function(){
  return this._buildFrom(this.p, this.n, this.c, this.i);
};

/* ── 3. Palette ───────────────────────────────────────────────── */
const K = {
  white:  rgb('#e9e6dc'), cream: rgb('#f3eddc'), offwhite: rgb('#dcd7c8'),
  beige:  rgb('#cfc4a8'), sand:  rgb('#cbbb90'),
  red:    rgb('#a83a2e'), darkred: rgb('#7d2a21'), roofr: rgb('#8a3a2e'),
  brown:  rgb('#7a5b3c'), wood:  rgb('#8a6743'), thatch: rgb('#b9954e'),
  grey:   rgb('#8e9298'), dgrey: rgb('#575b61'), lgrey: rgb('#b6bac0'),
  roofg:  rgb('#5a5f66'), metal: rgb('#9ba3aa'),
  glass:  rgb('#7fb6d4'), glassd: rgb('#39647f'), glassl: rgb('#a9d3e6'),
  green:  rgb('#4e7c45'), dgreen: rgb('#2e5230'),
  grass:  rgb('#5a8038'), grass2: rgb('#6a9040'), grass3: rgb('#486a2e'),
  trunk:  rgb('#5b4632'), leaf:   rgb('#3f7038'), leaf2: rgb('#4d8a41'),
  leaf3:  rgb('#356231'),
  road:   rgb('#3b3e44'), walk:   rgb('#9a9b93'),
  gold:   rgb('#c8a02a'), blue:   rgb('#2f5f8f'), yellow: rgb('#d9b23c'),
  black:  rgb('#282a2e'), water:  rgb('#3f7391'), water2: rgb('#4a83a3'),
  fence:  rgb('#6a6f75'), skin:   rgb('#c8a878'), ink: rgb('#1c2b33'),
  t1: rgb('#c94f3d'), t2: rgb('#3f7fb0'), t3: rgb('#d8a83a'),
  t4: rgb('#4e8f4a'), t5: rgb('#8f5aa8'), t6: rgb('#c96f3a'),
  t7: rgb('#2f8f8a'), t8: rgb('#b03a5c')
};

/* ── 4. Module state ──────────────────────────────────────────── */
let B = null;
const COLL = [];
const ROADPTS = [];
const ROADLINES = [];   /* centre-lines of every road (for streetlights) */
const ROADCL = [];      /* [x, z, halfWidth] of every carriageway sample */

/* ── 5. Convenience wrappers ──────────────────────────────────── */
function box(x,y,z,w,h,d,c,ry,rz){ B.box(w,h,d, x, y+h*0.5, z, c, ry, rz); }
function cyl(x,y,z,rt,rb,h,seg,c,ry,rz){ B.cyl(rt,rb,h,seg, x, y+h*0.5, z, c, ry, rz); }
function sph(x,y,z,r,seg,rings,c,phiMax){ B.sphere(r,seg,rings,x,y,z,c,phiMax); }
function roof(x,y,z,w,h,d,c,ry){ B.roof(w,h,d,x,y,z,c,ry); }
function flat(x,y,z,w,d,c,ry){ B.flat(x,y,z,w,d,c,ry); }
function disc(x,y,z,r,seg,c){ B.disc(x,y,z,r,seg,c); }

function winRow(x,y,z,w,h,n,ry,col,off){
  off = (off===undefined) ? 0.10 : off;
  const cy=Math.cos(ry), sy=Math.sin(ry);
  const step = w/n;
  for(let i=0;i<n;i++){
    const u = -w*0.5 + step*(i+0.5);
    B.panelXY(x + u*cy + off*sy, y + h*0.5, z - u*sy + off*cy,
              step*0.56, h, col, ry);
  }
}

function collide(x,z,w,d,h,ry){
  ry = ry||0;
  COLL.push({ x, z, hw:w*0.5, hd:d*0.5, h,
              cos:Math.cos(ry), sin:Math.sin(ry),
              br:Math.hypot(w*0.5, d*0.5), circle:false });
}
function collideCircle(x,z,r,h){
  COLL.push({ x, z, r, h, circle:true, br:r });
}
function collides(px,py,pz,rad){
  for(let i=0;i<COLL.length;i++){
    const c = COLL[i];
    if(py - rad > c.h) continue;
    const dx = px - c.x, dz = pz - c.z;
    if(c.circle){
      const r = c.r + rad;
      if(dx*dx + dz*dz < r*r) return true;
    } else {
      const br = c.br + rad;
      if(dx*dx + dz*dz > br*br) continue;
      const lx =  dx*c.cos - dz*c.sin;
      const lz =  dx*c.sin + dz*c.cos;
      if(Math.abs(lx) < c.hw + rad && Math.abs(lz) < c.hd + rad) return true;
    }
  }
  return false;
}

/* ── 6. Ground, river, roads ──────────────────────────────────── */
function buildGround(){
  B.flat(0, 0, 0, 1400, 1400, K.grass);
  const patches = [
    [-300, 120, 260, 200, K.grass2], [250, -80, 300, 240, K.grass2],
    [60, 280, 280, 180, K.grass3], [-180, -280, 240, 200, K.grass3],
    [420, 240, 260, 220, K.grass2], [-430, -60, 200, 320, K.grass3],
    [200, 380, 300, 180, K.grass2], [-380, 300, 240, 200, K.grass2]
  ];
  for(const p of patches){
    disc(p[0], 0.02, p[1], 1, 3, p[4]);
    B.flat(p[0], 0.02, p[1], p[2], p[3], p[4], rnd()*3);
  }
  const river = catmull([[-700,470],[-430,415],[-190,462],[60,425],[320,470],[560,430],[720,455]], 8);
  ribbon(river, 52, 0.05, K.water);
  ribbon(river, 44, 0.06, K.water2);
}

function catmull(pts, res){
  const out = [];
  for(let i=0;i<pts.length-1;i++){
    const p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || pts[i+1];
    for(let t=0;t<res;t++){
      const s = t/res, s2 = s*s, s3 = s2*s;
      const x = 0.5*((2*p1[0]) + (-p0[0]+p2[0])*s +
                (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*s2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*s3);
      const z = 0.5*((2*p1[1]) + (-p0[1]+p2[1])*s +
                (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*s2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*s3);
      out.push([x,z]);
    }
  }
  out.push(pts[pts.length-1]);
  return out;
}

function ribbon(pts, width, y, col){
  const n = pts.length;
  const L = [], R = [];
  for(let i=0;i<n;i++){
    const p = pts[i];
    const pv = pts[i>0?i-1:i], nx2 = pts[i<n-1?i+1:i];
    let dx = nx2[0]-pv[0], dz = nx2[1]-pv[1];
    const l = Math.hypot(dx,dz) || 1; dx/=l; dz/=l;
    const nx = -dz, nz = dx, hw = width*0.5;
    L.push([p[0]+nx*hw, y, p[1]+nz*hw]);
    R.push([p[0]-nx*hw, y, p[1]-nz*hw]);
  }
  for(let i=0;i<n-1;i++)
    B.quad(L[i], L[i+1], R[i+1], R[i], col);
}

function road(a, b, width){
  let dx = b[0]-a[0], dz = b[1]-a[1];
  const len = Math.hypot(dx,dz) || 1;
  const nx = -dz/len, nz = dx/len;
  const bow = (rnd()-0.5) * len * 0.24;
  const mx = (a[0]+b[0])*0.5 + nx*bow;
  const mz = (a[1]+b[1])*0.5 + nz*bow;
  const pts = catmull([[a[0],a[1]],[mx,mz],[b[0],b[1]]], 9);
  ribbon(pts, width+4.5, 0.06, K.walk);
  ribbon(pts, width, 0.11, K.road);
  for(let i=0;i<pts.length;i+=2) ROADPTS.push([pts[i][0], pts[i][1], width*0.5+3]);
  ROADLINES.push({ pts, w: width });
  for(let i=0;i<pts.length;i++) ROADCL.push([pts[i][0], pts[i][1], width*0.5]);
}

const J = [
  [-370,-100],[-260,-165],[-165,-95],[-85,-25],[5,-35],[95,-5],[175,45],[270,75],
  [320,160],[215,200],[120,165],[45,135],[-35,85],[-95,35],[-180,65],[-240,145],
  [-310,235],[-45,215],[40,245],[150,260],[-170,-200],[-60,-215],[45,-175],[130,-195],
  [210,-165],[300,-130],[350,-240],[-300,-270],[-350,-180],[250,-60],[-20,170]
];

const EDGES = [
  [0,1,12],[1,2,12],[2,3,12],[3,4,12],[4,5,12],[5,6,12],[6,7,12],
  [7,8,12],[8,9,12],[9,10,10],[10,11,10],[11,12,10],[12,13,10],[13,14,10],
  [14,15,10],[15,16,9],
  [0,20,10],[20,21,10],[21,22,10],[22,23,10],[23,24,10],[24,25,10],[25,26,9],[26,8,9],
  [1,20,9],[2,20,9],[4,22,9],[5,29,9],[29,23,9],[6,29,9],[7,25,9],
  [12,30,9],[30,17,9],[17,18,9],[18,19,9],[19,9,9],[10,19,9],[11,30,9],
  [16,27,9],[27,28,9],[28,20,9],[28,0,9],[25,8,9],[8,7,9],[15,16,9],
  [13,30,8],[11,17,8],[3,13,8],[23,29,8],[24,29,8]
];

function buildRoads(){
  for(const e of EDGES) road(J[e[0]], J[e[1]], e[2]);
}

/* ── 6b. Streetlights along every road (solid) ───────────────────
   Dark tapered pole on the pavement, arm leaning over the carriageway, hooded
   lamp with a glowing lens. Spaced ~34 m, alternating sides; skipped near
   junctions, over other roads, and wherever a building/tree is. Each pole
   registers a circle collider, so cars and the walker cannot pass through. */
function buildStreetlights(){
  const POLE = rgb('#16161a'), PLINTH = rgb('#0a0a0c'), CHROME = rgb('#5a5a66'), LENS = rgb('#fff2cc'), HOOD = rgb('#121216');
  const SP = 34, END_SKIP = 16;
  let count = 0, k = 0;
  for(const R of ROADLINES){
    const pts = R.pts; let acc = SP * 0.5;
    for(let i=1;i<pts.length;i++){
      const ax = pts[i][0]-pts[i-1][0], az = pts[i][1]-pts[i-1][1];
      const seg = Math.hypot(ax, az); if(seg < 0.01) continue;
      const tx = ax/seg, tz = az/seg, nx = -tz, nz = tx;
      acc += seg;
      if(acc < SP) continue;
      acc = 0;
      /* distance from either end of this road */
      let dEnd = 0; for(let j=1;j<=i;j++) dEnd += Math.hypot(pts[j][0]-pts[j-1][0], pts[j][1]-pts[j-1][1]);
      let tot = dEnd; for(let j=i+1;j<pts.length;j++) tot += Math.hypot(pts[j][0]-pts[j-1][0], pts[j][1]-pts[j-1][1]);
      if(dEnd < END_SKIP || tot - dEnd < END_SKIP) continue;
      const side = (k++ & 1) ? 1 : -1;
      const off = R.w*0.5 + 1.5;
      const x = pts[i][0] + nx*side*off, z = pts[i][1] + nz*side*off;
      /* not on another road, not inside a building / tree */
      let bad = false;
      for(let j=0;j<ROADCL.length;j++){
        const c = ROADCL[j], dx = x-c[0], dz = z-c[1], r = c[2] + 0.9;
        if(dx*dx + dz*dz < r*r){ bad = true; break; }
      }
      if(bad || collides(x, 2, z, 0.8)) continue;
      const ox = -nx*side, oz = -nz*side;                 /* arm leans out over the road */
      const ry = Math.atan2(ox, oz);
      cyl(x, 0.0, z, 0.40, 0.46, 0.22, 10, PLINTH);
      cyl(x, 0.22, z, 0.27, 0.31, 0.60, 10, HOOD);
      cyl(x, 0.82, z, 0.075, 0.12, 5.5, 8, POLE);          /* tapered pole */
      for(const by of [1.8, 3.2, 4.6, 5.9]) cyl(x, by - 0.035, z, 0.105, 0.108, 0.07, 8, CHROME);
      B.box(0.11, 0.11, 1.75, x + ox*0.85, 6.5, z + oz*0.85, POLE, ry);   /* arm */
      B.box(0.11, 0.30, 0.11, x + ox*0.08, 6.42, z + oz*0.08, POLE);      /* arm root */
      const hx = x + ox*1.7, hz = z + oz*1.7;
      cyl(hx, 6.12, hz, 0.14, 0.38, 0.32, 8, HOOD);          /* hood */
      cyl(hx, 6.44, hz, 0.12, 0.12, 0.07, 8, CHROME);         /* cap */
      cyl(hx, 6.08, hz, 0.31, 0.31, 0.04, 12, LENS);          /* glowing lens */
      collideCircle(x, z, 0.5, 7);                            /* solid */
      count++;
    }
  }
  return count;
}

/* ── 7. Trees ─────────────────────────────────────────────────── */
function tree(x, z, s){
  s = s || 1;
  const th = 3.6*s;
  cyl(x, 0, z, 0.32*s, 0.55*s, th, 5, K.trunk);
  B.cyl(0.15*s, 3.3*s, 5.0*s, 6, x, th + 2.4*s, z, K.leaf);
  B.cyl(0.15*s, 2.6*s, 4.2*s, 6, x, th + 5.2*s, z, K.leaf2);
  B.cyl(0.12*s, 1.7*s, 3.2*s, 6, x, th + 7.6*s, z, K.leaf3);
  collideCircle(x, z, 1.35*s, th + 9*s);
}
function treeOk(x,z){
  if(collides(x, 2, z, 3.2)) return false;
  for(let i=0;i<ROADPTS.length;i++){
    const p = ROADPTS[i];
    const dx = x-p[0], dz = z-p[1], r = p[2]+3;
    if(dx*dx + dz*dz < r*r) return false;
  }
  return true;
}
function scatterTrees(count, cx, cz, rx, rz, sMin, sMax){
  let tries = 0;
  while(count > 0 && tries < count*8){
    tries++;
    const a = rnd()*Math.PI*2, r = Math.sqrt(rnd());
    const x = cx + Math.cos(a)*r*rx, z = cz + Math.sin(a)*r*rz;
    if(!treeOk(x,z)) continue;
    tree(x, z, rr(sMin||0.85, sMax||1.5));
    count--;
  }
}

/* ── 8. Landmark builders ─────────────────────────────────────── */
function bGovHouse(x,z){
  box(x, 0, z, 46, 11, 22, K.white);
  roof(x, 11, z, 51, 9, 27, K.darkred);
  box(x, 0, z+13, 46, 1.2, 7, K.offwhite);
  for(let i=0;i<7;i++) cyl(x-18+i*6, 1.2, z+15.5, 0.9, 0.9, 10.2, 6, K.white);
  box(x, 11.4, z+13, 46, 1.2, 7, K.cream);
  winRow(x, 4, z+11.3, 40, 3.2, 7, 0, K.glassd);
  winRow(x, 4, z-11.3, 40, 3.2, 7, Math.PI, K.glassd);
  winRow(x+23.3, 4, z, 16, 3.2, 4, Math.PI/2, K.glassd);
  winRow(x-23.3, 4, z, 16, 3.2, 4, -Math.PI/2, K.glassd);
  box(x, 0, z+18, 22, 0.8, 4, K.offwhite);
  cyl(x+18, 0, z-16, 0.35, 0.35, 22, 5, K.metal);
  B.panelXY(x+21.5, 21, z-16, 7, 4.2, rgb('#1c6b3a'), 0);
  box(x, 0, z-16, 2.6, 0.8, 2.6, K.lgrey);
  collide(x, z+3, 51, 38, 20);
}
function bHotel(x,z){
  const cream = rgb('#ece4d2'), stone = rgb('#e0d8c4'), dark = rgb('#6a5a42');
  /* podium with gold cornice */
  box(x, 0, z, 40, 8, 32, K.offwhite);
  box(x, 8, z, 41.4, 0.9, 33.4, K.gold);
  box(x, 0, z, 41, 0.9, 33, dark);                       /* plinth */
  winRow(x, 4.4, z+16.15, 34, 2.6, 8, 0, K.glassd);
  winRow(x, 4.4, z-16.15, 34, 2.6, 8, Math.PI, K.glassd);
  winRow(x+20.15, 4.4, z, 26, 2.6, 6, Math.PI/2, K.glassd);
  winRow(x-20.15, 4.4, z, 26, 2.6, 6, -Math.PI/2, K.glassd);
  /* stepped tower: 5 floors wide, 3 floors narrow — no giant slab */
  box(x, 8.9, z, 26, 14, 20, cream);
  box(x, 22.9, z, 27.2, 0.8, 21.2, K.gold);
  box(x, 23.7, z, 20, 10, 15, stone);
  box(x, 33.7, z, 21.2, 1.0, 16.2, K.gold);
  box(x, 34.7, z, 11, 4, 9, cream);                      /* penthouse */
  box(x, 38.7, z, 12.4, 0.7, 10.4, K.roofg);
  cyl(x, 39.4, z, 0.18, 0.18, 8, 4, K.metal);            /* flagpole */
  for(let i=0;i<5;i++){
    const y = 10.8 + i*2.7;
    winRow(x, y, z+10.15, 22, 1.7, 6, 0, K.glassd);
    winRow(x, y, z-10.15, 22, 1.7, 6, Math.PI, K.glassd);
    winRow(x+13.15, y, z, 16, 1.7, 5, Math.PI/2, K.glassd);
    winRow(x-13.15, y, z, 16, 1.7, 5, -Math.PI/2, K.glassd);
    box(x, y-1.2, z+10.7, 22, 0.25, 1.2, K.lgrey);       /* balcony slabs, front */
  }
  for(let i=0;i<3;i++){
    const y = 25.4 + i*2.8;
    winRow(x, y, z+7.65, 16, 1.7, 5, 0, K.glassd);
    winRow(x, y, z-7.65, 16, 1.7, 5, Math.PI, K.glassd);
    winRow(x+10.15, y, z, 12, 1.7, 4, Math.PI/2, K.glassd);
    winRow(x-10.15, y, z, 12, 1.7, 4, -Math.PI/2, K.glassd);
  }
  for(const px of [-12,-6,0,6,12]) box(x+px, 8.9, z+10.2, 0.6, 14, 0.5, K.gold);   /* gold piers */
  /* porte-cochere */
  box(x, 5.2, z+21, 16, 0.7, 11, K.gold);
  for(const cx of [-7,-2.5,2.5,7]) cyl(x+cx, 0, z+25.4, 0.38, 0.42, 5.2, 8, K.white);
  box(x, 0, z+21, 15, 0.2, 10, K.grey);                  /* driveway apron */
  box(x-12, 0, z+22, 3, 1.2, 3, K.lgrey); box(x+12, 0, z+22, 3, 1.2, 3, K.lgrey);   /* planters */
  scatterTrees(6, x, z+24, 34, 8, 1.0, 1.4);
  collide(x, z, 40, 32, 40);
}
function bIbp(x,z){
  B.flat(x, 0.09, z, 92, 76, K.grass2, 0.2);
  B.flat(x, 0.10, z, 62, 50, K.grass);
  flat(x, 0.13, z, 92, 5, K.sand, 0.2);
  flat(x, 0.13, z, 5, 76, K.sand, 0.2);
  disc(x, 0.14, z, 13, 14, K.walk);
  box(x, 0.14, z, 7, 2.2, 7, K.lgrey);
  cyl(x, 2.3, z, 0.45, 1.9, 17, 4, K.white);
  cyl(x, 19.3, z, 0.05, 0.55, 2.6, 4, K.gold);
  collideCircle(x, z, 4, 22);
  disc(x+24, 0.15, z-16, 5.5, 12, K.water);
  cyl(x+24, 0.15, z-16, 5.8, 6.2, 1.2, 12, K.lgrey);
  cyl(x+24, 1.3, z-16, 0.4, 0.6, 3.2, 8, K.lgrey);
  for(let i=0;i<8;i++){
    const a = i/8*Math.PI*2, bx = x + Math.cos(a)*20, bz = z + Math.sin(a)*17;
    box(bx, 0.14, bz, 3, 0.6, 1.2, K.wood, a);
  }
  scatterTrees(22, x, z, 40, 32, 0.9, 1.4);
}
function bMarket(x,z){
  B.flat(x, 0.09, z, 78, 62, rgb('#b0a48c'), 0.15);
  const tarps = [K.t1,K.t2,K.t3,K.t4,K.t5,K.t6,K.t7,K.t8];
  for(let i=0;i<34;i++){
    const a = rnd()*Math.PI*2, r = Math.sqrt(rnd());
    const sx = x + Math.cos(a)*r*32, sz = z + Math.sin(a)*r*25;
    const ry = rr(-0.4, 0.4);
    const w = rr(3.6, 6), d = rr(3.6, 6);
    box(sx, 0.09, sz, w, rr(2.4,3.4), d, K.beige, ry);
    roof(sx, 2.9, sz, w+1.6, 1.6, d+1.6, tarps[(i*3)%8], ry);
    collide(sx, sz, w+1.4, d+1.4, 5, ry);
  }
  for(let i=0;i<2;i++){
    const sx = x + (i? 20 : -20), sz = z + (i? 12 : -12);
    box(sx, 0.09, sz, 16, 4.5, 11, K.wood, 0.3);
    roof(sx, 4.6, sz, 18, 3, 13, i?K.t2:K.t3, 0.3);
    collide(sx, sz, 18, 13, 8, 0.3);
  }
  for(let i=0;i<26;i++){
    const a = i/26*Math.PI*2;
    cyl(x+Math.cos(a)*38, 0, z+Math.sin(a)*30, 0.25,0.25, 2.4, 4, K.fence);
  }
}
function bAirport(x,z){
  B.flat(x, 0.07, z-70, 230, 20, rgb('#3a3d42'));
  for(let i=0;i<12;i++) B.flat(x-96+i*17.5, 0.09, z-70, 9, 1.6, rgb('#e8e8e0'));
  for(let i=0;i<2;i++) B.flat(x, 0.09, z-70 + (i?7:-7), 220, 0.8, rgb('#c8c8c0'));
  B.flat(x, 0.07, z-40, 14, 60, rgb('#4a4d52'));
  B.flat(x, 0.08, z-6, 120, 34, rgb('#8d8f92'));
  box(x, 0, z+22, 96, 11, 26, rgb('#dfe3e6'));
  B.cyl(13, 13, 96, 12, x, 22, z+22, rgb('#c9d2d8'), 0, Math.PI/2);
  winRow(x, 4, z+35.2, 88, 4.5, 16, 0, K.glassd);
  winRow(x, 4, z+8.8, 88, 4.5, 16, Math.PI, K.glassd);
  box(x, 0, z+38, 30, 5, 6, rgb('#e8ecee'));
  roof(x, 5, z+38, 32, 3, 8, K.roofg);
  const tx = x-62, tz = z+16;
  box(tx, 0, tz, 11, 30, 11, rgb('#e2e6e8'));
  box(tx, 30, tz, 15, 6, 15, rgb('#2f4a5c'));
  winRow(tx, 31, tz+7.6, 13, 3.6, 4, 0, K.glassl);
  winRow(tx, 31, tz-7.6, 13, 3.6, 4, Math.PI, K.glassl);
  box(tx, 36, tz, 13, 1.2, 13, K.roofg);
  cyl(tx, 37.2, tz, 0.15,0.15, 10, 4, K.metal);
  collide(tx, tz, 15, 15, 40);
  collide(x, z+22, 96, 28, 24);
  collide(x, z+38, 30, 8, 8);
  box(x+80, 0, z+10, 34, 13, 26, rgb('#c2c8cc'));
  B.cyl(13, 13, 34, 10, x+80, 26, z+10, rgb('#aeb6bb'), 0, Math.PI/2);
  collide(x+80, z+10, 34, 26, 26);
}
function bAutoHub(x,z){
  B.flat(x, 0.09, z, 66, 44, rgb('#a9aaa4'));
  box(x, 0, z, 40, 9, 22, rgb('#e6e8ea'));
  winRow(x, 1, z+11.15, 38, 7, 7, 0, K.glassl);
  winRow(x+20.15, 1, z, 20, 7, 4, Math.PI/2, K.glassl);
  winRow(x-20.15, 1, z, 20, 7, 4, -Math.PI/2, K.glassl);
  box(x, 9, z, 42, 1.4, 24, K.dgrey);
  box(x, 10.4, z+10, 20, 4, 1, K.red);
  B.panelXY(x, 12.4, z+10.6, 14, 2.2, K.white, 0);
  box(x, 7.4, z-20, 44, 0.8, 20, K.lgrey);
  for(let i=0;i<4;i++){
    cyl(x-18+i*12, 0, z-28, 0.4,0.4, 7.4, 5, K.metal);
    cyl(x-18+i*12, 0, z-12, 0.4,0.4, 7.4, 5, K.metal);
  }
  const carCols = [K.red, K.blue, K.white, K.black, K.gold, K.grey];
  for(let i=0;i<6;i++){
    const cx = x-15+i*6.2, cz = z-20 + (i%2? 5:-5), ry = i%2? 0.1:-0.1;
    box(cx, 0.4, cz, 4.2, 1.3, 2.2, carCols[i], ry);
    box(cx-0.2, 1.7, cz, 2.4, 1.1, 2.0, carCols[i], ry);
  }
  collide(x, z, 42, 24, 12);
}
function bPleasure(x,z){
  B.flat(x, 0.09, z, 86, 70, K.grass2, -0.12);
  B.flat(x, 0.10, z, 60, 48, K.grass);
  const R = 17, HUB = 21, segs = 22;
  const wx = x-16, wz = z-6;
  for(let i=0;i<segs;i++){
    const a = i/segs*Math.PI*2;
    const px = wx + Math.cos(a)*R, py = HUB + Math.sin(a)*R;
    B.box(3.2, 2.2, 1.2, px, py, wz, (i%3===0)?K.gold:K.lgrey, 0, a+Math.PI/2);
  }
  for(let i=0;i<8;i++){
    const a = i/8*Math.PI*2;
    B.box(R*2, 0.35, 0.35, wx + Math.cos(a)*R*0.5, HUB + Math.sin(a)*R*0.5, wz, K.lgrey, 0, a);
  }
  for(let i=0;i<11;i++){
    const a = i/11*Math.PI*2;
    const px = wx + Math.cos(a)*R, py = HUB + Math.sin(a)*R;
    box(px, py-3.2, wz, 2.6, 2.4, 2.6, (i%2)?K.t2:K.t1);
    cyl(px, py-3.4, wz, 0.12,0.12, 3.6, 4, K.metal);
  }
  cyl(wx, HUB, wz, 1.6, 1.6, 3.2, 8, K.dgrey, 0, Math.PI/2);
  const legBottomY = 1.8;
  const legTopY    = HUB;
  const legDY = legTopY - legBottomY;
  const legDX = 6.5;
  const legLen = Math.hypot(legDX, legDY);
  const legAng = Math.atan2(legDX, legDY);
  B.box(1.5, legLen, 1.5, wx - legDX/2, (legBottomY + legTopY)/2, wz, K.lgrey, 0, +legAng);
  B.box(1.5, legLen, 1.5, wx + legDX/2, (legBottomY + legTopY)/2, wz, K.lgrey, 0, -legAng);
  box(wx, 0, wz, 20, 0.6, 12, K.walk);
  collide(wx, wz, 26, 8, HUB+8);
  const cx = x+24, cz = z+16;
  cyl(cx, 0, cz, 9, 9.5, 1.4, 14, K.lgrey);
  for(let i=0;i<8;i++){
    const a = i/8*Math.PI*2;
    cyl(cx+Math.cos(a)*7, 1.4, cz+Math.sin(a)*7, 0.28,0.28, 6, 5, K.gold);
  }
  cyl(cx, 7.4, cz, 0.6, 9.6, 4.2, 14, K.t1);
  cyl(cx, 11.6, cz, 0.1, 1.2, 3.4, 8, K.gold);
  collideCircle(cx, cz, 9.5, 15);
  box(x+18, 0, z-18, 12, 1, 10, K.sand, 0.3);
  B.box(3, 12, 12, x+18, 6, z-18, K.t2, 0.3, 0.5);
  for(let i=0;i<3;i++) cyl(x-30+i*5, 0, z+22, 0.2,0.2, 5, 4, K.metal);
  box(x-25, 5, z+22, 11, 0.3, 0.3, K.metal);
  scatterTrees(14, x, z, 40, 32, 0.9, 1.3);
}
function bUni(x,z){
  B.flat(x, 0.09, z, 118, 96, K.grass2);
  B.flat(x, 0.10, z, 96, 74, K.grass);
  box(x, 0, z-32, 62, 13, 20, K.cream);
  roof(x, 13, z-32, 66, 7, 24, K.roofr);
  winRow(x, 4, z-21.9, 56, 4, 9, 0, K.glassd);
  for(let i=0;i<6;i++) cyl(x-24+i*9.6, 0, z-20, 0.8,0.8, 13, 5, K.white);
  const tx = x, tz = z-32;
  box(tx, 13, tz, 12, 20, 12, K.cream);
  roof(tx, 33, tz, 14, 8, 14, K.roofr);
  disc(tx, 30.2, tz+6.15, 3, 10, K.white);
  disc(tx, 30.2, tz+6.35, 1.1, 8, K.ink);
  collide(tx, tz, 14, 14, 42);
  box(x-42, 0, z+6, 22, 10, 34, K.offwhite);  roof(x-42, 10, z+6, 24, 5, 36, K.roofr);
  box(x+42, 0, z+6, 22, 10, 34, K.offwhite);  roof(x+42, 10, z+6, 24, 5, 36, K.roofr);
  winRow(x-42, 3, z+23.1, 18, 3.6, 5, 0, K.glassd);
  winRow(x+42, 3, z+23.1, 18, 3.6, 5, 0, K.glassd);
  collide(x-42, z+6, 24, 36, 16);
  collide(x+42, z+6, 24, 36, 16);
  collide(x, z-32, 62, 22, 20);
  flat(x, 0.13, z+22, 96, 5, K.sand);
  flat(x, 0.13, z+22, 5, 40, K.sand);
  scatterTrees(20, x, z+18, 44, 30, 0.9, 1.3);
}
function bMyHouse(x,z){
  /* Lagos flat mansion: same design as places/myhouse/exterior.js and the map icon. */
  const cream = rgb('#efe8d6');
  B.flat(x, 0.09, z, 46, 40, K.walk);                 // paved compound
  B.flat(x, 0.10, z+14, 40, 7, K.grass2);             // front lawn
  // perimeter wall with a gate gap at the front
  box(x-21.5, 0, z+19.5, 20, 2.2, 0.5, K.white);
  box(x+11.5, 0, z+19.5, 20, 2.2, 0.5, K.white);
  box(x-23, 0, z, 0.5, 2.2, 39, K.white); box(x+23, 0, z, 0.5, 2.2, 39, K.white);
  box(x, 0, z-19.5, 46, 2.2, 0.5, K.white);
  box(x-1.8, 0, z+19.5, 0.9, 3.2, 0.9, K.gold); box(x+1.8, 0, z+19.5, 0.9, 3.2, 0.9, K.gold);
  // main block: 4 storeys
  box(x-2, 0, z-3, 26, 14, 15, cream);
  for(let f=0; f<4; f++){
    const y = f*3.5;
    box(x-2, y+0.1, z+5.6, 26.4, 0.3, 3, K.white);                  // balcony slab
    if(f>0) box(x-2, y+0.4, z+7.0, 26.4, 1.0, 0.15, K.glassl);      // glass rail
    winRow(x-2, y+1.2, z+4.55, 23, 2.0, 6, 0, K.glassd);
    winRow(x-2, y+1.2, z-10.55, 23, 2.0, 6, Math.PI, K.glassd);
  }
  winRow(x+11.05, 1.4, z-3, 12, 2.0, 3, Math.PI/2, K.glassd);
  winRow(x-15.05, 1.4, z-3, 12, 2.0, 3, -Math.PI/2, K.glassd);
  box(x-2, 14, z-3, 27, 0.5, 16, K.gold);                           // cornice
  box(x-2, 14.5, z-3, 26, 0.7, 15, K.white);                        // parapet
  box(x-3, 15.2, z-3.5, 17, 3.2, 10, cream);                        // penthouse
  box(x-3, 18.4, z-3.5, 18, 0.35, 11, K.gold);
  cyl(x+5, 15.2, z-7, 1.5, 1.5, 2.6, 10, K.dgrey);                  // water tank
  box(x-11, 15.2, z-8, 3.4, 2.2, 3.4, K.white);                     // lift room
  // entrance canopy + columns + door
  box(x-2, 3.4, z+8.6, 8, 0.35, 4, K.gold);
  cyl(x-5.4, 0, z+10.2, 0.28, 0.28, 3.4, 8, K.white); cyl(x+1.4, 0, z+10.2, 0.28, 0.28, 3.4, 8, K.white);
  box(x-2, 0, z+4.6, 3.2, 3.0, 0.3, K.black);
  B.flat(x-2, 0.12, z+13, 6, 12, K.walk);
  // gatehouse + generator house + car
  box(x+15, 0, z+16, 3.4, 2.8, 3.4, K.white);
  box(x+17, 0, z-12, 4.6, 2.4, 3.2, K.grey);
  box(x+12, 0.4, z+12, 4.4, 1.4, 2.3, K.blue);
  box(x+12.2, 1.8, z+12, 2.5, 1.1, 2.1, K.glassd);
  tree(x-17, z+14, 1.25); tree(x+19, z+10, 1.1); tree(x-19, z-8, 1.2);
  collide(x-2, z-3, 27, 16, 15);
  collide(x+17, z-12, 5, 3.4, 2.4);
  collide(x+15, z+16, 3.6, 3.6, 2.8);
}
function bPrison(x,z){
  const W = 74, D = 62, H = 7;
  B.flat(x, 0.09, z, W, D, rgb('#9a968c'));
  box(x, 0, z-D/2, W, H, 2.4, rgb('#b9b3a4'));
  box(x, 0, z+D/2, W, H, 2.4, rgb('#b9b3a4'));
  box(x-W/2, 0, z, 2.4, H, D, rgb('#b9b3a4'));
  box(x+W/2, 0, z, 2.4, H, D, rgb('#b9b3a4'));
  collide(x, z-D/2, W, 3, H); collide(x, z+D/2, W, 3, H);
  collide(x-W/2, z, 3, D, H); collide(x+W/2, z, 3, D, H);
  const cs = [[-1,-1],[1,-1],[-1,1],[1,1]];
  for(const c of cs){
    const tx = x + c[0]*(W/2-1), tz = z + c[1]*(D/2-1);
    box(tx, 0, tz, 7, 13, 7, rgb('#c4beae'));
    box(tx, 13, tz, 9, 1, 9, K.roofg);
    collideCircle(tx, tz, 5, 15);
  }
  for(let i=0;i<2;i++){
    const bz = z - 13 + i*26;
    box(x, 0, bz, 44, 6, 12, rgb('#cfc9ba'));
    roof(x, 6, bz, 46, 3, 14, K.roofg);
    for(let k=0;k<9;k++) B.panelXY(x-18+k*4.5, 3.4, bz+6.15, 1.6, 1.8, K.ink, 0);
    collide(x, bz, 46, 14, 9);
  }
  B.flat(x, 0.11, z+22, 40, 12, rgb('#a8a294'));
}
function bGovMansion(x,z){
  B.flat(x, 0.09, z, 96, 78, K.grass2);
  box(x, 0, z, 50, 14, 26, K.cream);
  roof(x, 14, z, 54, 7, 30, K.darkred);
  box(x, 0, z+13, 20, 15, 8, K.white);
  for(let i=0;i<5;i++) cyl(x-8+i*4, 0, z+16, 0.85,0.85, 15, 6, K.white);
  box(x, 15, z+13, 22, 1.4, 9, K.white);
  cyl(x, 16.4, z, 6.4, 7, 6, 12, K.white);
  sph(x, 22.4, z, 6.4, 12, 6, K.gold, Math.PI/2);
  cyl(x, 28.8, z, 0.2, 0.7, 2.8, 6, K.gold);
  box(x-34, 0, z-4, 20, 10, 34, K.cream); roof(x-34, 10, z-4, 22, 5, 36, K.darkred);
  box(x+34, 0, z-4, 20, 10, 34, K.cream); roof(x+34, 10, z-4, 22, 5, 36, K.darkred);
  winRow(x, 5, z+13.2, 44, 3.4, 8, 0, K.glassd);
  winRow(x, 5, z-13.2, 44, 3.4, 8, Math.PI, K.glassd);
  collide(x, z, 54, 30, 24);
  collide(x-34, z-4, 22, 36, 16);
  collide(x+34, z-4, 22, 36, 16);
  cyl(x-9, 0, z+36, 1, 1, 7, 6, K.white);
  cyl(x+9, 0, z+36, 1, 1, 7, 6, K.white);
  B.flat(x, 0.12, z+24, 10, 26, K.walk);
  scatterTrees(16, x, z+22, 46, 22, 0.9, 1.3);
}
function bTheMansion(x,z){
  B.flat(x, 0.09, z, 88, 70, K.grass2);
  box(x, 0, z, 36, 9, 22, rgb('#efece4'));
  box(x-4, 9, z, 26, 1.2, 20, K.white);
  box(x+10, 0, z-12, 18, 6.5, 14, K.white);
  box(x-14, 0, z+12, 16, 5, 12, K.white);
  winRow(x, 1.4, z+11.15, 32, 6.2, 6, 0, K.glassl);
  winRow(x+18.15, 1.4, z, 18, 6.2, 4, Math.PI/2, K.glassl);
  winRow(x-18.15, 1.4, z, 18, 6.2, 4, -Math.PI/2, K.glassl);
  box(x, 9, z-12, 40, 0.8, 26, K.lgrey);
  for(let i=0;i<4;i++) cyl(x-16+i*11, 0, z-22, 0.35,0.35, 9, 5, K.metal);
  B.flat(x+2, 0.13, z+24, 24, 13, K.water);
  B.flat(x+2, 0.12, z+24, 26, 15, K.walk);
  B.flat(x+2, 0.14, z+24, 23, 12, K.water2);
  B.flat(x, 0.12, z+38, 9, 20, K.walk);
  collide(x, z, 40, 26, 14);
  collide(x+10, z-12, 20, 16, 9);
  collide(x-14, z+12, 18, 14, 8);
  scatterTrees(12, x, z, 42, 32, 0.9, 1.2);
}
function bAircraft(x,z,ry){
  ry = ry || 0;
  B.cyl(2.4, 2.4, 30, 10, x, 6.2, z, K.white, ry, Math.PI/2);
  B.cyl(0.3, 2.4, 5, 10, x+17.5*Math.cos(ry), 6.2, z-17.5*Math.sin(ry), K.white, ry, Math.PI/2);
  B.cyl(2.4, 0.9, 5, 10, x-17.5*Math.cos(ry), 6.2, z+17.5*Math.sin(ry), K.white, ry, Math.PI/2);
  B.box(7, 0.9, 34, x, 6.2, z, K.lgrey, ry, 0);
  B.box(4, 2.6, 2.6, x+2, 4.6, z+8, K.dgrey, ry, 0);
  B.box(4, 2.6, 2.6, x+2, 4.6, z-8, K.dgrey, ry, 0);
  B.box(5, 7, 0.8, x-14*Math.cos(ry), 11, z+14*Math.sin(ry), K.red, ry, 0);
  B.box(3, 0.7, 12, x-14*Math.cos(ry), 7, z+14*Math.sin(ry), K.lgrey, ry, 0);
  B.box(26, 0.7, 0.9, x, 7.4, z+2.4, K.glassd, ry, 0);
  cyl(x+6, 0, z, 0.3,0.3, 4.4, 4, K.metal);
  cyl(x-6, 0, z, 0.3,0.3, 4.4, 4, K.metal);
  collide(x, z, 34, 34, 14, ry);
}
function bRealEstate(x,z){
  B.flat(x, 0.09, z, 58, 46, rgb('#a8a9a3'));
  box(x, 0, z, 34, 16, 22, rgb('#e9e6de'));
  box(x, 16, z, 36, 1.2, 24, K.grey);
  for(let i=0;i<3;i++){
    const y = 3 + i*4.6;
    winRow(x, y, z+11.15, 30, 3, 6, 0, K.glassd);
    winRow(x, y, z-11.15, 30, 3, 6, Math.PI, K.glassd);
    winRow(x+17.15, y, z, 18, 3, 4, Math.PI/2, K.glassd);
    winRow(x-17.15, y, z, 18, 3, 4, -Math.PI/2, K.glassd);
  }
  box(x, 17.2, z+9, 24, 5, 1, K.blue);
  B.panelXY(x, 19.7, z+9.6, 18, 2.6, K.white, 0);
  cyl(x-22, 0, z+16, 0.25,0.25, 12, 4, K.metal);
  cyl(x+22, 0, z+16, 0.25,0.25, 12, 4, K.metal);
  collide(x, z, 36, 24, 20);
  scatterTrees(6, x, z-14, 24, 10, 0.9, 1.2);
}
function bJobCenter(x,z){
  B.flat(x, 0.09, z, 54, 44, rgb('#a8a9a3'));
  box(x, 0, z, 30, 12, 20, rgb('#dfe4e8'));
  box(x-2, 12, z, 20, 6, 14, rgb('#eef1f3'));
  box(x-2, 18, z, 22, 1, 16, K.blue);
  for(let i=0;i<2;i++){
    winRow(x, 2.5+i*4.6, z+10.15, 26, 3, 6, 0, K.glassd);
    winRow(x, 2.5+i*4.6, z-10.15, 26, 3, 6, Math.PI, K.glassd);
  }
  winRow(x-2, 14, z+7.15, 16, 3, 4, 0, K.glassd);
  box(x+16, 0, z+4, 10, 4, 10, K.gold);
  B.panelXY(x+16, 2, z+9.2, 7, 2, K.ink, 0);
  collide(x, z, 34, 22, 20);
  collide(x+16, z+4, 11, 11, 5);
}
function bHospital(x,z){
  B.flat(x, 0.09, z, 84, 72, rgb('#adb0ab'));
  box(x, 0, z, 44, 17, 24, K.white);
  box(x, 17, z, 46, 1.2, 26, K.lgrey);
  box(x-16, 0, z+18, 26, 11, 18, K.white);
  box(x+18, 0, z-14, 22, 14, 18, K.white);
  for(let i=0;i<3;i++){
    winRow(x, 3+i*4.8, z+12.15, 40, 3, 8, 0, K.glassd);
    winRow(x, 3+i*4.8, z-12.15, 40, 3, 8, Math.PI, K.glassd);
  }
  winRow(x+22.15, 3, z-14, 14, 3, 4, Math.PI/2, K.glassd);
  B.box(9, 2.4, 1.0, x, 19.2, z+12, K.red);
  B.box(2.4, 9, 1.0, x, 19.2, z+12, K.red);
  box(x+2, 0, z-18, 20, 5, 10, K.lgrey);
  box(x-6, 0.4, z-22, 6, 2.2, 2.6, K.white);
  box(x-6, 2.6, z-22, 2.6, 1.2, 2.4, K.red);
  collide(x, z, 46, 26, 20);
  collide(x-16, z+18, 28, 20, 12);
  collide(x+18, z-14, 24, 20, 15);
}
function bChurch(x,z){
  B.flat(x, 0.09, z, 46, 56, K.grass2);
  box(x, 0, z, 20, 9, 32, K.cream);
  roof(x, 9, z, 23, 7, 35, rgb('#5a4a3a'));
  const tz = z-19;
  box(x, 0, tz, 11, 22, 11, K.cream);
  box(x, 22, tz, 12, 1.2, 12, K.wood);
  B.cyl(0.2, 8, 15, 4, x, 30, tz, rgb('#4a3a2c'));
  B.box(0.7, 5, 0.7, x, 46.5, tz, K.gold);
  B.box(3.4, 0.7, 0.7, x, 48.2, tz, K.gold);
  for(let i=0;i<4;i++){
    const wz = z-10+i*7;
    B.panelXY(x+10.15, 3, wz, 2.2, 5, K.glassd, Math.PI/2);
    B.panelXY(x-10.15, 3, wz, 2.2, 5, K.glassd, -Math.PI/2);
  }
  B.panelXY(x, 4, z+16.15, 4, 6, K.wood, 0);
  collide(x, z, 23, 35, 16);
  collide(x, tz, 12, 12, 40);
  scatterTrees(8, x, z, 26, 30, 0.9, 1.2);
}
function bNightclub(x,z){
  B.flat(x, 0.09, z, 52, 46, rgb('#26262c'));
  box(x, 0, z, 30, 12, 22, rgb('#17121f'));
  box(x, 12, z, 31, 1.0, 23, rgb('#2a1a44'));
  B.box(24, 1.6, 0.5, x, 9.5, z+11.2, rgb('#b04aff'));
  B.box(18, 0.8, 0.5, x, 7.6, z+11.3, rgb('#ff4ad8'));
  B.panelXY(x, 3, z+11.2, 5, 6, rgb('#3a1a5a'), 0);
  sph(x, 14.6, z, 3, 12, 8, rgb("#e8e8ff"), Math.PI*2);
  collide(x, z, 31, 23, 14);
}
function bMosque(x,z){
  B.flat(x, 0.09, z, 60, 56, K.grass2);
  box(x, 0, z, 30, 11, 26, rgb('#eae5d8'));
  box(x, 11, z, 32, 1.2, 28, K.white);
  cyl(x, 12.2, z, 9, 9.4, 3.2, 16, rgb('#e6e1d2'));
  sph(x, 15.4, z, 9, 16, 7, K.gold, Math.PI/2);
  cyl(x, 23.9, z, 0.15, 0.6, 3, 6, K.gold);
  sph(x, 27.4, z, 0.55, 8, 5, K.gold);
  for(const s of [-1,1]){
    const mx = x + s*18, mz = z-11;
    box(mx, 0, mz, 5.4, 26, 5.4, rgb('#eae5d8'));
    box(mx, 26, mz, 7, 1, 7, K.white);
    cyl(mx, 27, mz, 2.6, 3, 4, 8, rgb('#e6e1d2'));
    sph(mx, 31, mz, 2.6, 10, 5, K.gold, Math.PI/2);
    cyl(mx, 33.6, mz, 0.12, 0.35, 2.4, 5, K.gold);
    collideCircle(mx, mz, 4, 36);
  }
  B.panelXY(x, 3, z+13.15, 6, 8, K.glassd, 0);
  for(let i=0;i<3;i++){
    B.panelXY(x-9+i*9, 4, z+13.15, 2.4, 4.5, K.glassd, 0);
    B.panelXY(x-9+i*9, 4, z-13.15, 2.4, 4.5, K.glassd, Math.PI);
  }
  collide(x, z, 32, 28, 26);
  scatterTrees(8, x, z, 30, 28, 0.9, 1.2);
}
function bVatican(x,z){
  B.flat(x, 0.09, z, 130, 120, rgb('#c9c6bb'));
  B.flat(x, 0.10, z+34, 84, 56, rgb('#dcd8cc'));
  box(x, 0, z-14, 58, 18, 32, K.cream);
  roof(x, 18, z-14, 61, 5, 35, rgb('#9a8f78'));
  for(let i=0;i<8;i++) cyl(x-24+i*6.9, 0, z+4, 1.1, 1.1, 16, 6, K.white);
  box(x, 16, z+4, 52, 1.6, 6, K.white);
  cyl(x, 18, z-18, 13, 13, 8, 16, rgb('#efeade'));
  for(let i=0;i<12;i++){
    const a = i/12*Math.PI*2;
    B.panelXY(x+Math.cos(a)*13.1, 20, z-18+Math.sin(a)*13.1, 1.6, 4, K.glassd, a + Math.PI/2);
  }
  sph(x, 26, z-18, 13, 18, 9, rgb('#d9d2c0'), Math.PI/2);
  cyl(x, 38.8, z-18, 1.4, 1.6, 4, 8, K.white);
  sph(x, 43, z-18, 1.6, 8, 5, K.gold);
  cyl(x, 44.6, z-18, 0.1, 0.35, 3, 5, K.gold);
  B.box(0.7, 3.4, 0.7, x, 49, z-18, K.gold);
  B.box(2.4, 0.7, 0.7, x, 50.4, z-18, K.gold);
  box(x, 0.1, z+40, 4, 1.6, 4, K.lgrey);
  cyl(x, 1.7, z+40, 0.4, 1.5, 18, 4, rgb('#d8d2c2'));
  collide(x, z-14, 61, 35, 40);
  collideCircle(x, z+40, 3, 21);
  for(const s of [-1,1]){
    for(let i=0;i<6;i++){
      const a = s*(0.35 + i*0.22);
      cyl(x + Math.sin(a)*44, 0, z+18 + Math.cos(a)*40, 0.9,0.9, 9, 6, K.white);
    }
  }
  scatterTrees(10, x, z+20, 50, 34, 0.9, 1.2);
}
function bStatehouse(x,z){
  B.flat(x, 0.09, z, 96, 80, K.grass2);
  box(x, 0, z, 54, 15, 26, K.white);
  roof(x, 15, z, 57, 5, 29, K.roofg);
  for(let i=0;i<8;i++) cyl(x-21+i*6, 0, z+14.5, 1, 1, 15, 6, K.white);
  box(x, 15, z+14.5, 52, 1.6, 8, K.white);
  cyl(x, 15, z, 9, 9, 6, 16, K.white);
  sph(x, 21, z, 9, 16, 7, rgb('#cfd6da'), Math.PI/2);
  cyl(x, 29.8, z, 0.3, 1.2, 3.4, 6, K.gold);
  collide(x, z, 54, 30, 30);
  box(x-38, 0, z+2, 20, 11, 32, K.white); roof(x-38, 11, z+2, 22, 4, 34, K.roofg);
  box(x+38, 0, z+2, 20, 11, 32, K.white); roof(x+38, 11, z+2, 22, 4, 34, K.roofg);
  collide(x-38, z+2, 22, 34, 16);
  collide(x+38, z+2, 22, 34, 16);
  B.flat(x, 0.12, z+32, 30, 30, K.walk);
  scatterTrees(12, x, z+22, 46, 22, 0.9, 1.3);
}
function bClassroom(x,z){
  B.flat(x, 0.09, z, 40, 34, K.grass2);
  box(x, 0, z, 26, 6, 15, rgb('#e6dfcc'));
  roof(x, 6, z, 28, 3.4, 17, K.roofr);
  winRow(x, 2, z+7.6, 22, 2.6, 5, 0, K.glassd);
  winRow(x, 2, z-7.6, 22, 2.6, 5, Math.PI, K.glassd);
  B.panelXY(x-9, 1, z+7.6, 3, 4.4, K.wood, 0);
  B.flat(x, 0.12, z+13, 30, 14, rgb('#b8b09a'));
  for(let i=0;i<3;i++) cyl(x-10+i*10, 0.12, z+16, 0.2,0.2, 4.4, 4, K.metal);
  box(x, 4.5, z+16, 24, 0.3, 0.3, K.metal);
  collide(x, z, 28, 17, 10);
  scatterTrees(5, x, z+12, 20, 8, 0.8, 1.1);
}
function bComputerLab(x,z){
  B.flat(x, 0.09, z, 38, 32, rgb('#a8a9a3'));
  box(x, 0, z, 26, 8, 16, rgb('#dfe6ea'));
  box(x, 8, z, 28, 1, 18, K.blue);
  for(let i=0;i<2;i++){
    winRow(x, 1.8+i*3.6, z+8.15, 22, 2.4, 8, 0, K.glassl);
    winRow(x, 1.8+i*3.6, z-8.15, 22, 2.4, 8, Math.PI, K.glassl);
  }
  cyl(x+9, 9, z-5, 0.25,0.25, 3, 4, K.metal);
  B.cyl(2.2, 0.4, 0.9, 10, x+9, 12.4, z-5, K.white, 0, 0.7);
  collide(x, z, 28, 18, 11);
}
function bZoo(x,z){
  B.flat(x, 0.09, z, 96, 84, K.grass2);
  B.flat(x, 0.10, z, 78, 66, K.grass);
  const pens = [
    [-24,-18,26,22,K.sand], [22,-20,26,20,rgb('#8f9a6a')],
    [-24, 18,26,20,rgb('#9aa87a')], [22, 18,26,20,K.sand]
  ];
  for(const p of pens){
    const px = x+p[0], pz = z+p[1], pw = p[2], pd = p[3];
    B.flat(px, 0.12, pz, pw, pd, p[4]);
    for(let i=0;i<Math.round(pw/2.4);i++){
      cyl(px-pw/2+i*2.4, 0.12, pz-pd/2, 0.14,0.14, 2.6, 4, K.fence);
      cyl(px-pw/2+i*2.4, 0.12, pz+pd/2, 0.14,0.14, 2.6, 4, K.fence);
    }
    for(let i=0;i<Math.round(pd/2.4);i++){
      cyl(px-pw/2, 0.12, pz-pd/2+i*2.4, 0.14,0.14, 2.6, 4, K.fence);
      cyl(px+pw/2, 0.12, pz-pd/2+i*2.4, 0.14,0.14, 2.6, 4, K.fence);
    }
    B.flat(px, 0.16, pz-pd/2, pw, 0.35, K.fence);
    B.flat(px, 0.16, pz+pd/2, pw, 0.35, K.fence);
  }
  const animals = [[-24,-18,K.gold],[-18,-20,rgb('#8a6a3a')],[22,-20,K.grey],[26,-16,K.white],
                   [-24,18,K.brown],[-18,20,K.gold],[22,18,rgb('#7a5a3a')],[26,22,K.grey]];
  for(const a of animals){
    const ax = x+a[0], az = z+a[1], c = a[2];
    box(ax, 0.15, az, 3.2, 1.6, 1.6, c, rnd()*3);
    box(ax+1.9, 0.9, az, 1.3, 1.2, 1.3, c, rnd()*3);
  }
  box(x, 0, z+36, 18, 6, 3, rgb('#c9bda0'));
  B.cyl(0.2, 4.4, 6, 4, x, 12, z+36, rgb('#c9bda0'));
  collide(x, z+36, 18, 4, 9);
  scatterTrees(16, x, z, 44, 38, 0.85, 1.3);
}
function bJail(x,z){
  const W = 62, D = 54, H = 6;
  B.flat(x, 0.09, z, W+6, D+6, rgb('#9a968c'));
  box(x, 0, z-D/2, W, H, 2, rgb('#b4aea0'));
  box(x, 0, z+D/2, W, H, 2, rgb('#b4aea0'));
  box(x-W/2, 0, z, 2, H, D, rgb('#b4aea0'));
  box(x+W/2, 0, z, 2, H, D, rgb('#b4aea0'));
  collide(x, z-D/2, W, 3, H); collide(x, z+D/2, W, 3, H);
  collide(x-W/2, z, 3, D, H); collide(x+W/2, z, 3, D, H);
  box(x, 0, z, 34, 8, 16, rgb('#c8c2b4'));
  roof(x, 8, z, 36, 3, 18, K.roofg);
  for(let i=0;i<7;i++) B.panelXY(x-14+i*4.6, 3, z+8.15, 1.4, 2, K.ink, 0);
  collide(x, z, 36, 18, 11);
  for(const c of [[-1,-1],[1,1]]){
    const tx = x + c[0]*(W/2-1), tz = z + c[1]*(D/2-1);
    box(tx, 0, tz, 6, 11, 6, rgb('#bdb7a8'));
    box(tx, 11, tz, 8, 1, 8, K.roofg);
    collideCircle(tx, tz, 4.4, 13);
  }
  for(const c of [[-1,1],[1,-1]]){
    cyl(x + c[0]*(W/2-6), 0, z + c[1]*(D/2-6), 0.25,0.25, 12, 4, K.metal);
    box(x + c[0]*(W/2-6), 12, z + c[1]*(D/2-6), 2.2, 1, 1.4, K.yellow);
  }
}
function bVastCity(x,z){
  B.flat(x, 0.09, z, 130, 118, rgb('#a6a7a1'));
  const palette = [rgb('#d6d2c8'), rgb('#c2ccd2'), rgb('#e0dccf'),
                   rgb('#b8c4cc'), rgb('#d0c8b8'), rgb('#c8d4d8')];
  for(let i=0;i<22;i++){
    const gx = (i%5) - 2, gz = Math.floor(i/5) - 2;
    const bx = x + gx*24 + rr(-4,4);
    const bz = z + gz*24 + rr(-4,4);
    const w = rr(10,16), d = rr(10,16), h = rr(12, 34);
    const c = palette[i % palette.length];
    const ry = rr(-0.25, 0.25);
    box(bx, 0, bz, w, h, d, c, ry);
    for(let k=0;k<Math.floor(h/6);k++){
      winRow(bx, 3+k*6, bz + d*0.5 + 0.1, w*0.78, 2.4, 3, ry, K.glassd);
    }
    box(bx, h, bz, w*0.55, 1.6, d*0.55, K.roofg, ry);
    if(i%4===0) cyl(bx, h+1.6, bz, 0.2,0.2, 6, 4, K.metal);
    collide(bx, bz, w+1, d+1, h+3, ry);
  }
  B.flat(x, 0.11, z, 128, 7, K.road);
  B.flat(x, 0.11, z, 7, 116, K.road);
  scatterTrees(8, x, z, 58, 52, 0.8, 1.1);
}
function bDuplex(x,z){
  B.flat(x, 0.09, z, 44, 40, K.grass2);
  box(x, 0, z, 24, 6.5, 16, rgb('#f0ede6'));
  box(x, 6.5, z, 22, 6, 15, rgb('#e4e0d6'));
  box(x, 12.5, z, 26, 0.9, 18, K.white);
  winRow(x, 1.6, z+8.15, 20, 3.4, 4, 0, K.glassl);
  winRow(x, 8, z+7.65, 18, 3.2, 4, 0, K.glassl);
  winRow(x+12.15, 8, z, 13, 3.2, 3, Math.PI/2, K.glassl);
  box(x, 12.5, z+9, 8, 2.2, 3.4, K.lgrey);
  box(x+10, 0, z-11, 5, 2.6, 5, K.lgrey);
  collide(x, z, 26, 18, 14);
  collide(x+10, z-11, 6, 6, 3);
  tree(x-16, z+10, 1.1);
  tree(x-16, z-8, 0.95);
}
function bLagosLife(x,z){
  B.flat(x, 0.09, z, 60, 46, rgb('#a8a9a3'));
  box(x, 0, z, 34, 26, 18, rgb('#e2ddd2'));
  box(x, 26, z, 36, 1.4, 20, K.roofg);
  for(let f=0;f<6;f++){
    const y = 2.4 + f*4.2;
    winRow(x, y, z+9.15, 30, 2.6, 5, 0, K.glassd);
    winRow(x, y, z-9.15, 30, 2.6, 5, Math.PI, K.glassd);
    box(x, y-0.9, z+10.6, 32, 0.5, 3, K.white);
    box(x, y-0.4, z+12.1, 32, 0.9, 0.35, K.lgrey);
  }
  winRow(x+17.15, 2.4, z, 14, 2.6, 3, Math.PI/2, K.glassd);
  winRow(x-17.15, 2.4, z, 14, 2.6, 3, -Math.PI/2, K.glassd);
  box(x-17, 0, z-6, 8, 27, 8, rgb('#cfc9bc'));
  collide(x, z, 36, 20, 28);
  collide(x-17, z-6, 9, 9, 28);
  B.flat(x, 0.12, z+16, 30, 8, K.walk);
}
function bCanteen(x,z){
  B.flat(x, 0.09, z, 40, 34, K.grass2);
  box(x, 0, z, 26, 6, 15, rgb('#ece6da'));
  roof(x, 6, z, 28, 3.4, 17, K.roofr);
  winRow(x, 2, z+7.6, 22, 2.6, 5, 0, K.glassd);
  B.flat(x, 0.12, z+13, 30, 12, rgb('#b8b09a'));
  collide(x, z, 28, 17, 10);
  scatterTrees(4, x, z+12, 20, 8, 0.8, 1.1);
}
function bBeach(x,z){
  B.flat(x, 0.09, z, 110, 90, rgb('#e8d8ae'));
  B.flat(x, 0.11, z-34, 110, 24, rgb('#3a9fb0'));
  scatterTrees(8, x, z+14, 80, 20, 0.9, 1.2);
}
function bForest(x,z){
  B.flat(x, 0.09, z, 130, 120, rgb('#54754a'));
  const path = catmull([
    [x-52, z+42],[x-24, z+16],[x-30, z-14],[x+2, z-30],
    [x+30, z-16],[x+22, z+18],[x+46, z+40]
  ], 7);
  ribbon(path, 8, 0.13, rgb('#9c8a63'));
  ribbon(path, 6.4, 0.14, rgb('#ad9a70'));
  for(let i=0;i<path.length;i+=1) ROADPTS.push([path[i][0], path[i][1], 6]);
  let n = 0, guard = 0;
  while(n < 95 && guard < 3000){
    guard++;
    const a = rnd()*Math.PI*2, r = Math.sqrt(rnd());
    const tx = x + Math.cos(a)*r*60, tz = z + Math.sin(a)*r*55;
    if(!treeOk(tx,tz)) continue;
    tree(tx, tz, rr(0.9, 1.7));
    n++;
  }
}
function bCityPark(x,z){
  B.flat(x, 0.09, z, 120, 104, K.grass2, 0.1);
  B.flat(x, 0.10, z, 96, 82, K.grass);
  flat(x, 0.13, z, 118, 6, K.sand, 0.1);
  flat(x, 0.13, z, 6, 100, K.sand, 0.1);
  disc(x, 0.15, z, 11, 16, K.water);
  cyl(x, 0.15, z, 11.5, 12, 1.4, 16, K.lgrey);
  cyl(x, 1.55, z, 0.8, 1.4, 4, 10, K.lgrey);
  disc(x, 5.6, z, 3.4, 12, K.water2);
  cyl(x, 5.6, z, 0.3, 0.5, 2.4, 8, K.lgrey);
  collideCircle(x, z, 12, 8);
  const gx = x-34, gz = z-24;
  for(let i=0;i<6;i++){
    const a = i/6*Math.PI*2;
    cyl(gx+Math.cos(a)*6, 0, gz+Math.sin(a)*6, 0.4,0.4, 6.5, 5, K.white);
  }
  B.cyl(0.2, 7.4, 4.6, 6, gx, 9.2, gz, K.roofr);
  collideCircle(gx, gz, 7, 12);
  for(let i=0;i<10;i++){
    const a = i/10*Math.PI*2;
    box(x+Math.cos(a)*22, 0.13, z+Math.sin(a)*19, 3, 0.6, 1.2, K.wood, a);
  }
  scatterTrees(34, x, z, 52, 44, 0.9, 1.6);
}
function bVillage(x,z){
  B.flat(x, 0.09, z, 110, 96, K.grass3, 0.15);
  B.flat(x, 0.10, z, 86, 72, rgb('#8b9459'));
  for(let i=0;i<11;i++){
    const a = rnd()*Math.PI*2, r = Math.sqrt(rnd());
    const hx = x + Math.cos(a)*r*40, hz = z + Math.sin(a)*r*32;
    const rad = rr(3.4, 5.2);
    cyl(hx, 0.1, hz, rad, rad*1.04, rr(2.6,3.6), 8, rgb('#c2ab86'));
    B.cyl(0.15, rad*1.5, rad*1.7, 8, hx, 3.4, hz, K.thatch);
    B.cyl(0.15, rad*0.9, rad*1.1, 8, hx, 5.4, hz, K.thatch);
    collideCircle(hx, hz, rad+0.4, 8);
  }
  disc(x, 0.14, z, 7, 12, rgb('#a89468'));
  for(let i=0;i<6;i++){
    const a = i/6*Math.PI*2;
    box(x+Math.cos(a)*4.4, 0.14, z+Math.sin(a)*4.4, 1.8, 0.5, 0.9, K.wood, a);
  }
  tree(x, z+10, 1.8);
  for(let i=0;i<8;i++){
    const lx = x + rr(-34,34), lz = z + rr(-28,28);
    if(collides(lx, 1, lz, 2)) continue;
    box(lx, 0.15, lz, 1.8, 1.1, 1.0, (i%2)?K.white:K.brown, rnd()*3);
  }
  ribbon(catmull([[x-52,z-10],[x-20,z+2],[x+10,z-8],[x+48,z+6]], 6), 5, 0.12, rgb('#9c8a63'));
}

/* ── 9. Landmark table ────────────────────────────────────────── */
const PLACES = [
  ["govhouse",     "Government House",      -250,  -60, bGovHouse],
  ["hotel",        "Hotel Presidential",    -115, -155, bHotel],
  ["boropark",     "Isaac Boro Park",         10, -110, bIbp],
  ["market",       "Mile 1 Market",          218,  103, bMarket],
  ["airport",      "Omagwa Airport",         400,   90, bAirport],
  ["showroom",     "Auto Hub",               146,  -44, bAutoHub],
  ["pleasurepark", "Pleasure Park",          -10,   35, bPleasure],
  ["university",   "University of P.H.",    -230,  -10, bUni],
  ["myhouse",      "My House",                29,  175, bMyHouse],
  ["prison",       "State Prison",           154, -236, bPrison],
  ["governor",     "Governor's Mansion",    -234, -219, bGovMansion],
  ["mansion",      "The Mansion",            -80, -270, bTheMansion],
  ["airplane",     "Landed Aircraft",        347,   10, bAircraft],
  ["realestate",   "Real Estate Office",     247,  162, bRealEstate],
  ["jobcenter",    "Job Center",             164,  212, bJobCenter],
  ["hospital",     "City Hospital",         -190,  130, bHospital],
  ["church",       "Church",                  63,  -39, bChurch],
  ["mosque",       "Central Mosque",         -55,   25, bMosque],
  ["vatican",      "Vatican City",          -374, -201, bVatican],
  ["statehouse",   "Statehouse",            -320,  -20, bStatehouse],
  ["classroom",    "Classroom",             -244,  206, bClassroom],
  ["computerlab",  "Computer Lab",          -215,  235, bComputerLab],
  ["zoo",          "City Zoo",                54, -225, bZoo],
  ["statejail",    "State Jail",             250, -215, bJail],
  ["vastcity",     "Vast City",              420, -150, bVastCity],
  ["duplex",       "Modern Duplex",          -95,  190, bDuplex],
  ["lagosflat",    "Lagos Life Apartment",     0,  265, bLagosLife],
  ["forest",       "Forest Trail",           290, -300, bForest],
  ["canteen",      "Canteen",               -150,  262, bCanteen],
  ["beach",        "Beach",                  330,  260, bBeach],
  ["citypark",     "City Park",             -350,  200, bCityPark],
  ["village",      "Village",               -330, -310, bVillage],
  ["nightclub",    "Club Eclipse",           120,  135, bNightclub]
];

/* ── 10. Public entry point ───────────────────────────────────── */

/* Split a merged indexed geometry into vertical strips along X so the
   renderer can frustum-cull each chunk instead of drawing the whole city. */
function splitByX(geo, xMin, xMax, parts) {
  const pos = geo.attributes.position.array;
  const nor = geo.attributes.normal ? geo.attributes.normal.array : null;
  const col = geo.attributes.color ? geo.attributes.color.array : null;
  const idx = geo.index ? geo.index.array : null;
  const step = (xMax - xMin) / parts;
  const B = Array.from({ length: parts }, () => ({ P: [], N: [], C: [], I: [], v: 0 }));
  const tris = idx ? idx.length / 3 : pos.length / 9;
  for (let t = 0; t < tris; t++) {
    const ids = idx ? [idx[t*3], idx[t*3+1], idx[t*3+2]] : [t*3, t*3+1, t*3+2];
    const cx = (pos[ids[0]*3] + pos[ids[1]*3] + pos[ids[2]*3]) / 3;
    let b = Math.floor((cx - xMin) / step);
    b = Math.max(0, Math.min(parts - 1, b));
    const bk = B[b];
    for (const ii of ids) {
      bk.P.push(pos[ii*3], pos[ii*3+1], pos[ii*3+2]);
      if (nor) bk.N.push(nor[ii*3], nor[ii*3+1], nor[ii*3+2]);
      if (col) bk.C.push(col[ii*3], col[ii*3+1], col[ii*3+2]);
    }
    bk.I.push(bk.v, bk.v + 1, bk.v + 2);
    bk.v += 3;
  }
  return B.filter(b => b.v > 0).map(b => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.P, 3));
    if (nor) g.setAttribute("normal", new THREE.Float32BufferAttribute(b.N, 3));
    if (col) g.setAttribute("color",  new THREE.Float32BufferAttribute(b.C, 3));
    g.setIndex(b.I);
    g.computeBoundingSphere();
    return g;
  });
}

export function buildPHWorld(){
  _seed = 20240617;
  B = new GB();
  COLL.length = 0;
  ROADPTS.length = 0; ROADLINES.length = 0; ROADCL.length = 0;

  B.setBase(true);
  buildGround();
  B.setBase(false);

  buildRoads();
  for (const p of PLACES){
    try { p[4](p[2], p[3]); }
    catch (e) { console.warn("[phworld] " + p[1] + " failed:", e); }
  }

  scatterTrees(150, 0, 0, 560, 520, 0.8, 1.5);
  scatterTrees(40, 430, 250, 200, 160, 0.9, 1.5);
  scatterTrees(40, -430, -60, 190, 220, 0.9, 1.5);
  try { console.log("[phworld] streetlights:", buildStreetlights()); } catch (e) { console.warn("[phworld] streetlights failed:", e); }

  const baseGeometry   = B.buildBase();
  const detailGeometry = B.buildDetail();
  const colliders      = COLL.slice();
  const landmarks      = PLACES.map(p => ({ id: p[0], name: p[1], x: p[2], z: p[3] }));

  B = null;

  /* Chunked copies for frustum-culled rendering (originals kept for city.js) */
  const baseChunks   = splitByX(baseGeometry,   -700, 700, 6);
  const detailChunks = splitByX(detailGeometry, -700, 700, 8);

  return { baseGeometry, detailGeometry, baseChunks, detailChunks, colliders, landmarks };
}
