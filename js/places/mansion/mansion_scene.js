/* The Mansion -- user's reference implementation, ported to the game.
   Everything below the module header is the ORIGINAL reference code,
   unchanged except:
     - WebGLRenderer comes from router (the game already has one)
     - canvas = router.renderer.domElement (no #c element)
     - HUD elements created dynamically and cleaned up on dispose
     - the RAF loop becomes update(dt) -- the router drives frames
     - scene returned in the router's shape { three, camera, ... }
   Coordinates, furniture, collision math, groundY, FOV, eye height,
   and the stairwell logic are untouched. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export async function mansionScene(params, router) {
  const renderer = router.renderer;
  const canvas   = renderer.domElement;

  /* ============================================================
     0. RENDERER / SCENE  (renderer already exists on router)
     ============================================================ */
  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x9dc4e8);
  scene.fog = new THREE.Fog(0x9dc4e8, 80, 320);

  /* FOV 95 -- matches the reference exactly */
  const camera = new THREE.PerspectiveCamera(95, innerWidth/innerHeight, 0.06, 300);
  camera.rotation.order = 'YXZ';

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a6a78, 1.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
  const sun = new THREE.DirectionalLight(0xfff0dd, 0.55);
  sun.position.set(40, 90, 30);
  scene.add(sun);

  {
    const g = new THREE.PlaneGeometry(700, 700);
    const m = new THREE.MeshLambertMaterial({ color: 0x86a86a });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI/2;
    mesh.position.y = -0.02;
    scene.add(mesh);
  }

  const MAT_LIT  = new THREE.MeshLambertMaterial({ vertexColors:true });
  const MAT_GLOW = new THREE.MeshBasicMaterial({ vertexColors:true });
  const MAT_CEIL = new THREE.MeshLambertMaterial({ vertexColors:true });

  /* ============================================================
     1. BUILDER
     ============================================================ */
  const _c = new THREE.Color();

  class Builder {
    constructor(ox = 0, oz = 0) {
      this.ox = ox; this.oz = oz;
      this.yOff = 0;
      this.level = 0;
      this.lit = []; this.glow = []; this.ceilParts = [];
      this.colliders = [];
    }
    _paint(g, color) {
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      _c.set(color);
      const r = _c.r, gg = _c.g, b = _c.b;
      for (let i = 0; i < n; i++) { arr[i*3] = r; arr[i*3+1] = gg; arr[i*3+2] = b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return g;
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
    box(w,h,d,color,x,y,z,ry=0,collide=false,target=null){
      const g = new THREE.BoxGeometry(w,h,d);
      g.deleteAttribute('uv');
      this._paint(g, color);
      if (ry) g.rotateY(ry);
      g.translate(this.ox + x, y + this.yOff, this.oz + z);
      (target || this.lit).push(g);
      if (collide) this._collide(w, d, x, z, ry);
      return this;
    }
    glowBox(w,h,d,color,x,y,z,ry=0){ return this.box(w,h,d,color,x,y,z,ry,false,this.glow); }
    ceilBox(w,h,d,color,x,y,z,ry=0){ return this.box(w,h,d,color,x,y,z,ry,false,this.ceilParts); }
    cyl(rt,rb,h,seg,color,x,y,z,ry=0,rx=0,rz=0,target=null){
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
    glowCyl(rt,rb,h,seg,color,x,y,z,ry=0,rx=0,rz=0){
      return this.cyl(rt,rb,h,seg,color,x,y,z,ry,rx,rz,this.glow);
    }
    floor(x0,z0,x1,z1,color){
      return this.box(x1-x0, 0.12, z1-z0, color, (x0+x1)/2, -0.06, (z0+z1)/2, 0, false);
    }
    ceiling(x0,z0,x1,z1,y,color=0xfaf8f4){
      return this.ceilBox(x1-x0, 0.12, z1-z0, color, (x0+x1)/2, y+0.06, (z0+z1)/2);
    }
    wallX(x,z0,z1,o={}){
      const t = o.t ?? 0.14, h = o.h ?? 2.7, col = o.col ?? 0xefe9df, doors = o.doors ?? [];
      const ds = doors.slice().sort((a,b)=>a[0]-b[0]);
      let cur = z0;
      for (const [a,b] of ds){
        if (a > cur + 0.001) this.box(t, h, a-cur, col, x, h/2, (cur+a)/2, 0, true);
        if (h > 2.15) this.box(t, h-2.15, b-a, col, x, 2.15 + (h-2.15)/2, (a+b)/2, 0, false);
        cur = b;
      }
      if (cur < z1 - 0.001) this.box(t, h, z1-cur, col, x, h/2, (cur+z1)/2, 0, true);
      return this;
    }
    wallZ(z,x0,x1,o={}){
      const t = o.t ?? 0.14, h = o.h ?? 2.7, col = o.col ?? 0xefe9df, doors = o.doors ?? [];
      const ds = doors.slice().sort((a,b)=>a[0]-b[0]);
      let cur = x0;
      for (const [a,b] of ds){
        if (a > cur + 0.001) this.box(a-cur, h, t, col, (cur+a)/2, h/2, z, 0, true);
        if (h > 2.15) this.box(b-a, h-2.15, t, col, (a+b)/2, 2.15 + (h-2.15)/2, z, 0, false);
        cur = b;
      }
      if (cur < x1 - 0.001) this.box(x1-cur, h, t, col, (cur+x1)/2, h/2, z, 0, true);
      return this;
    }
  }

  function mkFrame(B, x, z, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const PX = (lx,lz) => x + lx*c + lz*s;
    const PZ = (lx,lz) => z - lx*s + lz*c;
    return {
      box : (w,h,d,col,lx,ly,lz,hit) => B.box(w,h,d,col,PX(lx,lz),ly,PZ(lx,lz),ry,!!hit),
      glow: (w,h,d,col,lx,ly,lz)     => B.glowBox(w,h,d,col,PX(lx,lz),ly,PZ(lx,lz),ry),
      cyl : (rt,rb,h,sg,col,lx,ly,lz,rx,rz) => B.cyl(rt,rb,h,sg,col,PX(lx,lz),ly,PZ(lx,lz),ry,rx||0,rz||0),
      glowCyl:(rt,rb,h,sg,col,lx,ly,lz)     => B.glowCyl(rt,rb,h,sg,col,PX(lx,lz),ly,PZ(lx,lz),ry)
    };
  }

  /* ============================================================
     2. FURNITURE LIBRARY  (verbatim from reference)
     ============================================================ */
  function fBed(B,x,z,ry,o={}){
    const w=o.w??1.6, l=o.l??2.05;
    const F=mkFrame(B,x,z,ry);
    F.box(w+0.12,0.28,l+0.12, o.frame??0x8a5a34, 0,0.17,0, true);
    F.box(w,0.26,l,          o.matt??0xfff8ec, 0,0.42,0);
    F.box(w+0.06,0.14,l*0.60,o.duvet??0x3d8ea8, 0,0.60,l*0.16);
    F.box(w*0.40,0.14,0.34,  o.pillow??0xfffdf6, -w*0.24,0.60,-l*0.32);
    F.box(w*0.40,0.14,0.34,  o.pillow??0xfffdf6,  w*0.24,0.60,-l*0.32);
    F.box(w+0.24,1.0,0.10,   o.head??0x6a4a2c, 0,0.80,-l/2-0.10);
  }
  function fNightstand(B,x,z,ry,col=0xb08a5c){
    const F=mkFrame(B,x,z,ry);
    F.box(0.50,0.55,0.42,col,0,0.275,0,true);
    F.box(0.46,0.03,0.38,0x8a6a44,0,0.56,0);
    F.box(0.02,0.02,0.02,0xffd700,0,0.38,0.215);
    F.box(0.02,0.02,0.02,0xffd700,0,0.18,0.215);
  }
  function fLamp(B,x,z,ry){
    const F=mkFrame(B,x,z,ry);
    F.cyl(0.09,0.12,0.03,8,0x3a3a44,0,0.02,0);
    F.cyl(0.02,0.02,0.35,6,0x3a3a44,0,0.20,0);
    F.glowCyl(0.13,0.17,0.22,10,0xffe070,0,0.46,0);
  }
  function fSofa(B,x,z,ry,len=2.10,depth=0.90,col=0xe0604a,cush=0xf08a6a){
    const F=mkFrame(B,x,z,ry), d=depth;
    F.box(len,0.34,d,col,0,0.21,0,true);
    F.box(len,0.62,0.18,col,0,0.65,-d/2+0.09);
    F.box(0.18,0.34,d,col,-len/2+0.09,0.55,0);
    F.box(0.18,0.34,d,col, len/2-0.09,0.55,0);
    const n=Math.max(2,Math.round(len/0.8)), cw=(len-0.36)/n;
    for(let i=0;i<n;i++){
      const cx=-len/2+0.18+cw*(i+0.5);
      F.box(cw-0.05,0.16,d-0.30,cush,cx,0.46,0.06);
      F.box(cw-0.05,0.44,0.16,cush,cx,0.72,-d/2+0.26);
    }
    F.box(0.10,0.08,0.10,0x4a3020,-len/2+0.14,0.04,-d/2+0.14);
    F.box(0.10,0.08,0.10,0x4a3020, len/2-0.14,0.04,-d/2+0.14);
    F.box(0.10,0.08,0.10,0x4a3020,-len/2+0.14,0.04, d/2-0.14);
    F.box(0.10,0.08,0.10,0x4a3020, len/2-0.14,0.04, d/2-0.14);
  }
  function fArmchair(B,x,z,ry,col=0xd94f8a,cush=0xee7aa8){
    const F=mkFrame(B,x,z,ry);
    F.box(0.85,0.35,0.85,col,0,0.22,0,true);
    F.box(0.85,0.60,0.16,col,0,0.66,-0.35);
    F.box(0.16,0.32,0.85,col,-0.35,0.55,0);
    F.box(0.16,0.32,0.85,col, 0.35,0.55,0);
    F.box(0.66,0.14,0.66,cush,0,0.46,0.04);
    F.box(0.66,0.42,0.14,cush,0,0.74,-0.28);
  }
  function fCoffeeTable(B,x,z,ry,w=1.0,d=0.55){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.06,d,0xa8663a,0,0.42,0,true);
    F.box(w-0.20,0.04,d-0.20,0x7a4a24,0,0.20,0);
    const lx=w/2-0.07, lz=d/2-0.07;
    [[-lx,-lz],[lx,-lz],[-lx,lz],[lx,lz]].forEach(p=>F.box(0.07,0.40,0.07,0x7a4a24,p[0],0.20,p[1]));
  }
  function fTV(B,x,z,ry,w=1.70){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.42,0.40,0x2a2a34,0,0.21,0,true);
    F.box(w-0.06,0.02,0.36,0x3a3a48,0,0.43,0);
    F.box(w*0.92,0.62,0.05,0x0a0a10,0,1.05,0.06);
    F.glow(w*0.86,0.54,0.02,0x2a6ad0,0,1.05,0.09);
    F.box(0.34,0.04,0.18,0x0a0a10,0,0.72,0.06);
    F.box(0.06,0.14,0.06,0x0a0a10,0,0.65,0.06);
    F.box(0.12,0.16,0.10,0x4a4a58,-w*0.38,0.58,0);
    F.box(0.12,0.16,0.10,0x4a4a58, w*0.38,0.58,0);
  }
  function fBigScreen(B,x,z,ry,w=4.6,h=2.2){
    const F=mkFrame(B,x,z,ry);
    F.box(w+0.3,h+0.3,0.18,0x14141c,0,h/2+0.5,0);
    F.glow(w,h,0.04,0x4aa0ff,0,h/2+0.5,0.12);
    F.box(w+1.0,0.5,0.5,0x1a1a24,0,0.25,0);
  }
  function fKitchen(B,x,z,ry,len,o={}){
    const F=mkFrame(B,x,z,ry);
    const cab=o.cab??0x5ac8a0, top=o.top??0x2f3237;
    F.box(len,0.85,0.62,cab,0,0.425,0,true);
    F.box(len+0.04,0.05,0.66,top,0,0.875,0);
    F.box(len,0.72,0.34,cab,0,2.06,-0.14);
    F.box(len+0.02,0.03,0.36,0xdfe4e8,0,1.69,-0.14);
    F.box(len-0.10,0.10,0.50,0x2b2e33,0,0.05,-0.02);
    const n=Math.max(2,Math.round(len/0.6));
    for(let i=0;i<n;i++){
      const cx=-len/2+(len/n)*(i+0.5);
      F.box(0.02,0.10,0.02,0xe8ecf0,cx,0.62,0.32);
      F.box(0.02,0.10,0.02,0xe8ecf0,cx,2.06,0.045);
    }
  }
  function fSink(B,x,z,ry){
    const F=mkFrame(B,x,z,ry);
    F.box(0.66,0.02,0.44,0xc9ced5,0,0.905,0);
    F.box(0.56,0.14,0.36,0x6d737b,0,0.83,0);
    F.cyl(0.02,0.02,0.26,6,0xc9ced5,0,1.03,-0.16);
    F.box(0.04,0.04,0.20,0xc9ced5,0,1.15,-0.06);
  }
  function fStove(B,x,z,ry){
    const F=mkFrame(B,x,z,ry);
    F.box(0.62,0.02,0.54,0x1b1d21,0,0.90,0);
    const p=0.15;
    [[-p,-p],[p,-p],[-p,p],[p,p]].forEach(q=>F.cyl(0.09,0.09,0.015,10,0xff5a3a,q[0],0.915,q[1]));
    F.box(0.50,0.05,0.05,0x3a3d42,0,0.94,-0.28);
  }
  function fFridge(B,x,z,ry,col=0xd0d6dc){
    const F=mkFrame(B,x,z,ry);
    F.box(0.75,1.85,0.70,col,0,0.925,0,true);
    F.box(0.75,0.02,0.70,0xa9adb3,0,1.25,0);
    F.box(0.03,0.55,0.03,0x7a7f88,-0.28,1.55,0.36);
    F.box(0.03,0.35,0.03,0x7a7f88,-0.28,0.85,0.36);
  }
  function fIsland(B,x,z,ry,w=2.6,d=1.1,o={}){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.88,d,o.cab??0x5ac8a0,0,0.44,0,true);
    F.box(w+0.08,0.06,d+0.08,o.top??0x2f3237,0,0.91,0);
    F.box(w-0.2,0.04,d-0.2,0xcfcac2,0,0.30,0);
  }
  function fDiningTable(B,x,z,ry,w=1.5,d=0.9,col=0x8a4a6a){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.07,d,col,0,0.75,0,true);
    const lx=w/2-0.10, lz=d/2-0.10;
    [[-lx,-lz],[lx,-lz],[-lx,lz],[lx,lz]].forEach(p=>F.box(0.09,0.72,0.09,0x5a2a44,p[0],0.36,p[1]));
  }
  function fChair(B,x,z,ry,col=0xd9a04a){
    const F=mkFrame(B,x,z,ry);
    F.box(0.42,0.05,0.42,col,0,0.45,0,true);
    F.box(0.42,0.50,0.05,col,0,0.72,-0.19);
    [[-0.17,-0.17],[0.17,-0.17],[-0.17,0.17],[0.17,0.17]].forEach(p=>
      F.box(0.05,0.45,0.05,0x8a6428,p[0],0.225,p[1]));
  }
  function fWardrobe(B,x,z,ry,w=1.2,d=0.60,h=2.10,col=0xd9a878){
    const F=mkFrame(B,x,z,ry);
    F.box(w,h,d,col,0,h/2,0,true);
    F.box(w+0.06,0.07,d+0.06,0xb98a58,0,h+0.035,0);
    F.box(w+0.04,0.05,0.02,0xb98a58,0,0.025,d/2+0.02);
    F.box(0.02,h-0.2,0.02,0xa88058,0,h/2,d/2+0.005);
    F.box(0.03,0.30,0.03,0xffd700,-0.06,h*0.55,d/2+0.02);
    F.box(0.03,0.30,0.03,0xffd700, 0.06,h*0.55,d/2+0.02);
  }
  function fDresser(B,x,z,ry,w=1.20,d=0.45,h=0.80,col=0xb87a5a){
    const F=mkFrame(B,x,z,ry);
    F.box(w,h,d,col,0,h/2,0,true);
    F.box(w+0.03,0.04,d+0.03,0x8a5a3a,0,h+0.02,0);
    for(let i=0;i<3;i++){
      F.box(w-0.08,h/3-0.06,0.02,0x9a6a48,0,h*(i+0.5)/3,d/2+0.005);
      F.box(0.16,0.03,0.03,0xffd700,0,h*(i+0.5)/3,d/2+0.025);
    }
  }
  function fRug(B,x,z,ry,w,d,col=0xc0303a,inner=0xffd98a){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.020,d,col,0,0.012,0);
    F.box(w-0.14,0.006,d-0.14,inner,0,0.026,0);
  }
  function fPlant(B,x,z){
    const F=mkFrame(B,x,z,0);
    F.cyl(0.17,0.13,0.30,10,0xc86a3a,0,0.15,0);
    F.cyl(0.19,0.19,0.03,10,0xa85a2a,0,0.30,0);
    F.cyl(0.03,0.03,0.45,6,0x4a8a3a,0,0.50,0);
    F.cyl(0.32,0.10,0.55,8,0x3fa83a,0,0.95,0);
    F.cyl(0.24,0.08,0.42,8,0x4ac044,0,1.15,0);
  }
  function fWindow(B,x,z,ry,w=1.40,h=1.30,sill=0.90){
    const F=mkFrame(B,x,z,ry);
    F.glow(w,h,0.03,0xd8f0ff,0,sill+h/2,0.015);
    F.box(w+0.16,0.09,0.10,0xfff8f0,0,sill-0.03,0.05);
    F.box(w+0.16,0.09,0.10,0xfff8f0,0,sill+h+0.03,0.05);
    F.box(0.09,h+0.15,0.10,0xfff8f0,-w/2-0.035,sill+h/2,0.05);
    F.box(0.09,h+0.15,0.10,0xfff8f0, w/2+0.035,sill+h/2,0.05);
    F.box(0.05,h,0.06,0xfff8f0,0,sill+h/2,0.05);
    F.box(w,0.05,0.06,0xfff8f0,0,sill+h/2,0.05);
  }
  function fToilet(B,x,z,ry){
    const F=mkFrame(B,x,z,ry);
    F.box(0.40,0.40,0.22,0xf8fafc,0,0.20,-0.28);
    F.cyl(0.19,0.16,0.40,10,0xf8fafc,0,0.20,0.05);
    F.box(0.38,0.06,0.50,0xf8fafc,0,0.43,-0.05);
  }
  function fVanity(B,x,z,ry,w=0.80){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.80,0.48,0xa86a8a,0,0.40,0,true);
    F.box(w+0.04,0.05,0.52,0xf0f0f4,0,0.825,0);
    F.box(w*0.70,0.02,0.34,0xdfe8f0,0,0.85,0);
    F.cyl(0.02,0.02,0.24,6,0xd0d4d8,0,0.99,-0.18);
    F.box(0.04,0.03,0.16,0xd0d4d8,0,1.10,-0.10);
    F.box(w*0.80,0.70,0.03,0xc8e8f8,0,1.60,-0.22);
  }
  function fShower(B,x,z,ry,w=1.0,d=1.0){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.10,d,0xeef2f5,0,0.05,0,true);
    F.box(w,0.02,d-0.10,0xd8dde0,0,0.11,0);
    F.glow(w-0.10,2.00,0.02,0xa8e0f8,0,1.10,-d/2+0.06);
    F.cyl(0.02,0.02,0.30,6,0xd0d4d8,0,2.05,-d/2+0.10);
    F.cyl(0.10,0.10,0.04,10,0xd0d4d8,0,1.88,-d/2+0.10);
  }
  function fBathtub(B,x,z,ry,w=1.60,d=0.75){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.55,d,0xfafcfd,0,0.275,0,true);
    F.box(w-0.14,0.06,d-0.14,0xbfe8ff,0,0.53,0);
    F.cyl(0.02,0.02,0.20,6,0xd0d4d8,-w/2+0.15,0.62,-d/2+0.15);
  }
  function fBookshelf(B,x,z,ry,w=2.0,h=2.2,d=0.35,col=0x8a5a2a){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.06,d,col,0,0.03,0);
    F.box(w,0.06,d,col,0,h-0.03,0);
    F.box(0.06,h,d,col,-w/2+0.03,h/2,0);
    F.box(0.06,h,d,col, w/2-0.03,h/2,0);
    F.box(w-0.12,0.03,d-0.05,0x4a2a12,0,h/2,-d/2+0.03);
    const rows=4, cols=[0xe04040,0x4080e0,0x40c060,0xf0c020,0xa040e0,0x20c0d0,0xf08030,0x304060];
    for(let r=0;r<rows;r++){
      const y = 0.06 + (h-0.12)*(r+1)/(rows+1);
      F.box(w-0.12,0.04,d-0.06,col,0,y,0);
      let bx = -w/2+0.14, k = 0;
      while(bx < w/2-0.16){
        const bw = 0.055 + ((k*37 + r*11) % 5) * 0.014;
        const bh = 0.20 + ((k*53 + r*7) % 4) * 0.022;
        F.box(bw, bh, d-0.14, cols[(r*3+k)%cols.length], bx+bw/2, y+0.022+bh/2, -0.02);
        bx += bw + 0.012; k++;
      }
    }
  }
  function fPiano(B,x,z,ry){
    const F=mkFrame(B,x,z,ry);
    F.box(1.50,0.40,1.00,0x1a1a1e,0,0.78,0,true);
    F.box(1.50,0.16,0.90,0x0e0e12,0,0.54,0);
    F.box(1.50,0.06,0.24,0xf4f2ec,0,0.82,0.48);
    F.box(1.52,0.05,1.02,0x2a2a30,0,1.00,0);
    F.box(0.10,0.55,0.10,0x1a1a1e,-0.65,0.275,-0.40);
    F.box(0.10,0.55,0.10,0x1a1a1e, 0.65,0.275,-0.40);
    F.box(0.10,0.55,0.10,0x1a1a1e, 0.00,0.275, 0.40);
  }
  function fLampCeil(B,x,z,y){
    B.cyl(0.06,0.06,0.16,8,0x666666,x,y-0.08,z);
    B.glowCyl(0.24,0.32,0.10,12,0xfff8dc,x,y-0.22,z);
    B.glowCyl(0.32,0.30,0.04,12,0xffedb0,x,y-0.29,z);
  }
  function fChandelier(B,x,z,y,r=0.90){
    B.cyl(0.03,0.03,0.70,6,0xffd54a,x,y-0.35,z);
    B.glowCyl(0.34,0.46,0.46,10,0xfff0b0,x,y-0.90,z);
    for(let i=0;i<8;i++){
      const a = i*Math.PI/4;
      const cx = x + Math.cos(a)*r, cz = z + Math.sin(a)*r;
      B.glowCyl(0.055,0.055,0.18,6,0xfff8d8,cx,y-0.72,cz);
      B.cyl(0.018,0.018,0.26,5,0xffd54a,x+Math.cos(a)*r*0.72,y-0.52,z+Math.sin(a)*r*0.72);
    }
  }
  function fPainting(B,x,z,ry,w=0.9,h=0.7,col=0x4a8ae0){
    const F=mkFrame(B,x,z,ry);
    F.box(w+0.10,h+0.10,0.05,0xffc83a,0,1.70,0.03);
    F.box(w,h,0.02,col,0,1.70,0.06);
    F.box(w*0.5,h*0.5,0.01,0xffe89a,0,1.70,0.07);
  }
  function fConsole(B,x,z,ry,w=1.30){
    const F=mkFrame(B,x,z,ry);
    F.box(w,0.06,0.38,0x6a4a2a,0,0.80,0,true);
    F.box(0.06,0.80,0.06,0x4a3018,-w/2+0.08,0.40,0);
    F.box(0.06,0.80,0.06,0x4a3018, w/2-0.08,0.40,0);
    F.cyl(0.14,0.10,0.30,10,0x8ab0d0,0,0.98,0);
  }
  function fCeilLampSmall(B,x,z,y){
    B.glowCyl(0.26,0.26,0.03,12,0xfff3c8,x,y-0.06,z);
  }
  function fPoleLamp(B,x,z){
    B.cyl(0.04,0.04,3.0,8,0x333340,x,1.5,z);
    B.glowCyl(0.16,0.22,0.30,10,0xfff0b0,x,3.20,z);
    B.cyl(0.18,0.14,0.10,8,0x333340,x,3.40,z);
  }
  function fTreadmill(B,x,z,ry,col=0xe04040){
    const F=mkFrame(B,x,z,ry);
    F.box(0.70,0.14,1.80,0x2a2a30,0,0.07,0,true);
    F.box(0.60,0.06,1.60,col,0,0.18,0);
    F.box(0.70,0.10,0.20,0x2a2a30,0,0.60,-0.80);
    F.box(0.06,0.90,0.06,0x2a2a30,-0.28,0.60,-0.80);
    F.box(0.06,0.90,0.06,0x2a2a30, 0.28,0.60,-0.80);
    F.box(0.70,0.05,0.30,0x3a3a48,0,0.95,-0.80);
    F.glow(0.50,0.20,0.02,0x40e0ff,0,0.95,-0.63);
  }
  function fBench(B,x,z,ry,col=0x3a3a48){
    const F=mkFrame(B,x,z,ry);
    F.box(1.30,0.14,0.40,col,0,0.45,0,true);
    F.box(0.08,0.38,0.08,0x2a2a30,-0.50,0.19,-0.14);
    F.box(0.08,0.38,0.08,0x2a2a30, 0.50,0.19,-0.14);
    F.box(0.08,0.38,0.08,0x2a2a30,-0.50,0.19, 0.14);
    F.box(0.08,0.38,0.08,0x2a2a30, 0.50,0.19, 0.14);
  }
  function fDumbbellRack(B,x,z,ry){
    const F=mkFrame(B,x,z,ry);
    F.box(1.20,0.10,0.45,0x3a3a48,0,0.50,0,true);
    F.box(0.08,0.50,0.08,0x2a2a30,-0.55,0.25,0);
    F.box(0.08,0.50,0.08,0x2a2a30, 0.55,0.25,0);
    const cols=[0xe04040,0x40c060,0x4080e0,0xf0c020];
    for(let i=0;i<4;i++){
      F.cyl(0.07,0.07,0.12,8,cols[i],-0.42+i*0.28,0.60,0);
      F.cyl(0.07,0.07,0.12,8,cols[i],-0.42+i*0.28,0.60,0.18);
    }
  }
  function fYogaMat(B,x,z,ry,col=0x40d0c0){
    const F=mkFrame(B,x,z,ry);
    F.box(0.70,0.03,1.60,col,0,0.02,0);
    F.box(0.70,0.03,0.20,0xffffff,0,0.025,0.70);
  }
  function fCinemaSeat(B,x,z,ry,col=0xc02030,yOff=0){
    const F=mkFrame(B,x,z,ry);
    F.box(0.60,0.42,0.58,col,0,0.21+yOff,0,true);
    F.box(0.60,0.55,0.14,col,0,0.70+yOff,-0.22);
    F.box(0.14,0.28,0.58,col,-0.23,0.56+yOff,0);
    F.box(0.14,0.28,0.58,col, 0.23,0.56+yOff,0);
    F.box(0.48,0.10,0.50,0xe84050,0,0.42+yOff,0.03);
    F.box(0.48,0.42,0.10,0xe84050,0,0.72+yOff,-0.16);
  }
  function fLounger(B,x,z,ry,col=0xfff0d0){
    const F=mkFrame(B,x,z,ry);
    F.box(0.70,0.10,1.80,col,0,0.25,0,true);
    F.box(0.70,0.45,0.10,0xe0d0b0,0,0.55,-0.85);
    F.box(0.06,0.20,0.06,0xb0a090,-0.28,0.10,-0.70);
    F.box(0.06,0.20,0.06,0xb0a090, 0.28,0.10,-0.70);
    F.box(0.06,0.20,0.06,0xb0a090,-0.28,0.10, 0.70);
    F.box(0.06,0.20,0.06,0xb0a090, 0.28,0.10, 0.70);
  }
  function fMansionEntranceDoor(B, x, z, w=6.0, h=2.15){
    const wood  = 0x5a2e12;
    const wood2 = 0x8a4a20;
    const gold  = 0xffc83a;
    const leafW = w / 2 - 0.04;
    for (const s of [-1, 1]){
      const cx = x + s * (leafW/2 + 0.02);
      B.box(leafW, h, 0.16, wood, cx, h/2, z, 0, true);
      B.box(leafW - 0.28, h - 0.44, 0.03, wood2, cx, h/2, z + 0.085, 0);
      B.box(leafW - 0.52, h - 0.90, 0.03, 0x2e1808, cx, h/2, z + 0.105, 0);
      for (let i = 0; i < 4; i++){
        B.box(leafW - 0.30, 0.04, 0.03, gold, cx, 0.32 + i * (h - 0.64) / 3, z + 0.12, 0);
      }
      const handleX = cx - s * (leafW/2 - 0.14);
      B.glowCyl(0.05, 0.05, 0.16, 8, gold, handleX, 1.10, z + 0.10);
      B.glowCyl(0.05, 0.05, 0.16, 8, gold, handleX, 0.75, z + 0.10);
      B.box(0.05, 0.05, 0.22, gold, handleX, 1.10, z + 0.14, 0);
      B.box(0.05, 0.05, 0.22, gold, handleX, 0.75, z + 0.14, 0);
    }
    B.box(0.10, h, 0.20, gold, x, h/2, z, 0);
    B.box(w + 0.12, 0.12, 0.22, gold, x, h + 0.06, z, 0);
    B.box(0.07, 0.18, 0.19, gold, x - w/2 + 0.07, 1.80, z, 0);
    B.box(0.07, 0.18, 0.19, gold, x + w/2 - 0.07, 1.80, z, 0);
    B.box(0.07, 0.18, 0.19, gold, x - w/2 + 0.07, 0.40, z, 0);
    B.box(0.07, 0.18, 0.19, gold, x + w/2 - 0.07, 0.40, z, 0);
  }

  /* ============================================================
     3. THE MANSION  (verbatim from reference -- coordinates unchanged)
     ============================================================ */
  const MANSION_OX = 0, MANSION_OZ = 0;
  const MANSION_ROOF_Y = 4.00;
  const STAIR_X0 = MANSION_OX + 24, STAIR_X1 = MANSION_OX + 28;
  const STAIR_Z0 = MANSION_OZ +  4, STAIR_Z1 = MANSION_OZ + 14;

  function buildMansion(){
    const B = new Builder(MANSION_OX, MANSION_OZ);
    const H  = MANSION_ROOF_Y;
    const WT = 0.30, IT = 0.16;
    const WALL = 0xfff2dc;

    B.level = 0; B.yOff = 0;

    B.floor( 0, 0, 18,12, 0xf0a850);
    B.floor( 0,12, 18,22, 0x7ab88a);
    B.floor( 0,22, 18,36, 0x6aa8e0);
    B.floor(18, 0, 30,26, 0xf8ecd4);
    B.floor(18,26, 30,36, 0x3ab8d8);
    B.floor(30, 0, 46,12, 0xf0b878);
    B.floor(30,12, 46,22, 0xd888a0);
    B.floor(30,22, 46,36, 0x6a5aa8);

    B.wallZ( 0.0, -0.15, 46.15, { t:WT, h:H, col:WALL, doors:[[21,27]] });
    B.wallZ(36.0, -0.15, 46.15, { t:WT, h:H, col:WALL });
    B.wallX( 0.0, -0.15, 36.15, { t:WT, h:H, col:WALL });
    B.wallX(46.0, -0.15, 36.15, { t:WT, h:H, col:WALL });

    B.wallX(18.0, 0.0, 36.0, { t:IT, h:H, col:0xffe4c8, doors:[[8,10],[16,18],[28,30]] });
    B.wallX(30.0, 0.0, 36.0, { t:IT, h:H, col:0xffe4c8, doors:[[8,10],[16,18],[28,30]] });
    B.wallZ(12.0, 0.0, 18.0, { t:IT, h:H, col:0xffe4c8, doors:[[7,9]] });
    B.wallZ(22.0, 0.0, 18.0, { t:IT, h:H, col:0xffe4c8, doors:[[7,9]] });
    B.wallZ(12.0, 30.0, 46.0,{ t:IT, h:H, col:0xffe4c8, doors:[[37,39]] });
    B.wallZ(22.0, 30.0, 46.0,{ t:IT, h:H, col:0xffe4c8, doors:[[37,39]] });
    B.wallZ(26.0, 18.0, 30.0,{ t:IT, h:H, col:0xffe4c8, doors:[[22,26]] });

    B.wallX(24.0, 4.0, 14.0, { t:0.16, h:H, col:0xf0d8b0 });
    B.wallX(28.0, 4.0, 14.0, { t:0.16, h:H, col:0xf0d8b0 });

    fMansionEntranceDoor(B, 24.0, 0.0, 6.0, 2.15);

    /* PARLOUR */
    fRug(B, 9.0, 6.0, 0, 12.0, 8.0, 0xc0303a, 0xffd98a);
    fSofa(B,  4.0, 2.0, 0,           3.2, 1.0, 0xd94f8a, 0xee7aa8);
    fSofa(B,  4.0, 9.6, Math.PI,     3.2, 1.0, 0xd94f8a, 0xee7aa8);
    fSofa(B, 14.6, 6.0, -Math.PI/2,  3.0, 1.0, 0x3a7ac0, 0x5a9ae0);
    fArmchair(B, 9.2, 1.2, 0, 0xf0a020, 0xffc860);
    fArmchair(B, 9.2, 10.6, Math.PI, 0xf0a020, 0xffc860);
    fCoffeeTable(B, 6.0, 6.0, 0, 2.4, 1.3);
    fTV(B, 0.60, 6.0, Math.PI/2, 2.6);
    fPlant(B, 16.6, 1.0);
    fPlant(B, 16.6, 11.0);
    fPlant(B, 1.0, 11.0);
    fPiano(B, 16.2, 9.0, -Math.PI/2);
    fChandelier(B, 9.0, 6.0, H-0.2, 1.10);
    fWindow(B, 5.0, 0.15, 0, 2.6, 1.9, 1.0);
    fWindow(B, 12.0, 0.15, 0, 2.6, 1.9, 1.0);
    fPainting(B, 0.20, 6.0, Math.PI/2, 1.4, 1.0, 0x4a8ae0);

    /* LIBRARY */
    fBookshelf(B,  1.6, 12.42, 0, 2.6, 3.2, 0.45, 0xa0602a);
    fBookshelf(B,  4.4, 12.42, 0, 2.6, 3.2, 0.45, 0xa0602a);
    fBookshelf(B,  7.2, 12.42, 0, 2.6, 3.2, 0.45, 0xa0602a);
    fBookshelf(B, 10.0, 12.42, 0, 2.6, 3.2, 0.45, 0xa0602a);
    fBookshelf(B, 12.8, 12.42, 0, 2.6, 3.2, 0.45, 0xa0602a);
    fBookshelf(B,  0.42, 17.0, Math.PI/2, 3.0, 3.2, 0.45, 0xa0602a);
    fBookshelf(B, 15.58, 17.0, -Math.PI/2, 3.0, 3.2, 0.45, 0xa0602a);
    fRug(B, 8.0, 17.0, 0, 9.0, 4.0, 0x3a6a3a, 0xd8f0a0);
    fArmchair(B, 6.0, 16.6, 0, 0xf0c020, 0xffe070);
    fArmchair(B, 10.0, 16.6, 0, 0xf0c020, 0xffe070);
    fCoffeeTable(B, 8.0, 17.6, 0, 1.4, 0.7);
    fBookshelf(B, 8.0, 21.42, Math.PI, 6.0, 3.0, 0.45, 0x8a5020);
    fLamp(B, 4.6, 20.4, 0);
    fLamp(B, 11.4, 20.4, 0);
    fLampCeil(B, 8.0, 17.0, H);
    fWindow(B, 0.15, 17.0, Math.PI/2, 2.4, 1.8, 1.0);

    /* GYM */
    fTreadmill(B,  2.6, 25.0, 0, 0xe04040);
    fTreadmill(B,  4.4, 25.0, 0, 0x40c060);
    fTreadmill(B,  6.2, 25.0, 0, 0x4080e0);
    fBench(B, 12.0, 25.0, 0, 0x3a3a48);
    fBench(B, 12.0, 28.0, 0, 0x3a3a48);
    fDumbbellRack(B, 15.0, 25.0, -Math.PI/2);
    fDumbbellRack(B, 15.0, 30.0, -Math.PI/2);
    fYogaMat(B,  3.0, 32.0, 0, 0x40d0c0);
    fYogaMat(B,  4.6, 32.0, 0, 0xf070a0);
    fYogaMat(B,  6.2, 32.0, 0, 0xf0c020);
    fYogaMat(B,  7.8, 32.0, 0, 0x70a0f0);
    fRug(B, 5.0, 29.0, 0, 9.0, 6.0, 0x2a5a8a, 0xa8e0f8);
    B.glowBox(9.0, 2.4, 0.04, 0xc8e8f8, 9.0, 1.6, 22.14);
    B.box(9.4, 0.10, 0.10, 0xffc83a, 9.0, 2.86, 22.16);
    B.box(9.4, 0.10, 0.10, 0xffc83a, 9.0, 0.36, 22.16);
    fWindow(B, 0.15, 29.0, Math.PI/2, 2.6, 1.8, 1.0);
    fLampCeil(B, 5.0, 26.0, H);
    fLampCeil(B, 12.0, 32.0, H);
    fPlant(B, 16.6, 34.6);

    /* GRAND HALL + STAIRCASE */
    fRug(B, 21.0, 12.0, 0, 4.6, 14.0, 0xc02030, 0xffd98a);
    fChandelier(B, 21.0, 6.0, H-0.2, 1.0);
    fChandelier(B, 21.0, 18.0, H-0.2, 1.0);
    fConsole(B, 18.30, 20.0, Math.PI/2, 1.4);
    fConsole(B, 29.70, 20.0, -Math.PI/2, 1.4);
    fPlant(B, 18.8, 1.2);
    fPlant(B, 29.2, 1.2);
    fPainting(B, 18.20, 4.0, Math.PI/2, 1.0, 0.8, 0x4a8ae0);
    fPainting(B, 29.80, 4.0, -Math.PI/2, 1.0, 0.8, 0xe08a4a);
    fWindow(B, 24.0, 0.16, 0, 2.0, 2.0, 1.0);

    const NS = 13;
    const sdz = 10 / NS, sdy = H / NS;
    for (let i = 0; i < NS; i++){
      const zc = STAIR_Z0 + (i + 0.5) * sdz;
      const hh = (i + 1) * sdy;
      const col = (i % 2) ? 0xf8e8c8 : 0xe0c898;
      B.box(4.0, hh, sdz, col, 26, hh/2, zc, 0, false);
    }
    for (let i = 0; i < NS; i++){
      const zc = STAIR_Z0 + (i + 0.5) * sdz;
      const hh = (i + 1) * sdy;
      for (const xx of [24.09, 27.91]){
        B.box(0.10, 0.90, sdz, 0xd8a020, xx, hh + 0.45, zc, 0, false);
      }
    }
    B.box(0.22, 1.40, 0.22, 0xffd54a, 24.09, 0.70, 4.05, 0, false);
    B.box(0.22, 1.40, 0.22, 0xffd54a, 27.91, 0.70, 4.05, 0, false);
    B.box(0.22, 1.60, 0.22, 0xffd54a, 24.09, H + 0.80, 14.0, 0, false);
    B.box(0.22, 1.60, 0.22, 0xffd54a, 27.91, H + 0.80, 14.0, 0, false);

    /* POOL HALL */
    B.box(8.8, 0.30, 6.8, 0xe8e0d0, 24, 0.03, 31, 0, false);
    B.glowBox(8.0, 0.06, 6.0, 0x30c8e8, 24, 0.14, 31);
    B.glowBox(7.2, 0.02, 5.2, 0x80e8ff, 24, 0.19, 31);
    B.box(0.5, 0.34, 7.6, 0xfff4e0, 19.6, 0.17, 31, 0, false);
    B.box(0.5, 0.34, 7.6, 0xfff4e0, 28.4, 0.17, 31, 0, false);
    B.box(9.6, 0.34, 0.5, 0xfff4e0, 24, 0.17, 26.6, 0, false);
    B.box(9.6, 0.34, 0.5, 0xfff4e0, 24, 0.17, 35.4, 0, false);
    fLounger(B, 19.9, 28.0, 0, 0xfff0d0);
    fLounger(B, 19.9, 31.0, 0, 0xffd0a0);
    fLounger(B, 19.9, 34.0, 0, 0xa0e0ff);
    fPlant(B, 29.2, 27.0);
    fPlant(B, 29.2, 35.0);
    fPlant(B, 18.8, 35.0);
    fLampCeil(B, 22.0, 31.0, H);
    fLampCeil(B, 26.0, 31.0, H);
    fPainting(B, 18.20, 31.0, Math.PI/2, 1.2, 0.9, 0x30c8e8);

    /* KITCHEN */
    fKitchen(B, 36.0, 0.44, 0, 9.0, { cab:0x60c8b0, top:0x2f3237 });
    fSink(B, 33.0, 0.44, 0);
    fSink(B, 39.0, 0.44, 0);
    fStove(B, 35.0, 0.44, 0);
    fStove(B, 37.0, 0.44, 0);
    fFridge(B, 43.6, 0.48, 0, 0xe0a0c0);
    fFridge(B, 44.5, 0.48, 0, 0xe0a0c0);
    fKitchen(B, 45.40, 5.0, -Math.PI/2, 6.0, { cab:0x60c8b0 });
    fIsland(B, 37.0, 6.0, 0, 5.0, 1.5, { cab:0x5ac8a0, top:0x2f3237 });
    for (let i=0;i<4;i++) fChair(B, 35.4+i*1.1, 4.9, 0, 0xf0a040);
    fRug(B, 37.0, 9.5, 0, 6.0, 3.4, 0x2a8a6a, 0xa0f0d0);
    fDiningTable(B, 36.0, 9.5, 0, 2.6, 1.1, 0xe06a3a);
    fChair(B, 34.9, 8.9, 0, 0xf0a040);
    fChair(B, 37.1, 8.9, 0, 0xf0a040);
    fChair(B, 34.9, 10.1, Math.PI, 0xf0a040);
    fChair(B, 37.1, 10.1, Math.PI, 0xf0a040);
    fWindow(B, 36.0, 0.16, 0, 3.0, 1.8, 1.0);
    fLampCeil(B, 36.0, 3.0, H);
    fLampCeil(B, 36.0, 9.0, H);
    fPlant(B, 45.0, 11.0);

    /* DINING */
    fChandelier(B, 38.0, 17.0, H-0.2, 1.0);
    fRug(B, 38.0, 17.0, 0, 12.0, 8.0, 0x8a2a5a, 0xffc8e0);
    fDiningTable(B, 38.0, 17.0, 0, 7.0, 1.6, 0x6a2a5a);
    for (let i=0;i<7;i++){
      fChair(B, 35.4 + i*0.85, 15.6, 0, 0xf0c020);
      fChair(B, 35.4 + i*0.85, 18.4, Math.PI, 0xf0c020);
    }
    fChair(B, 34.2, 17.0, Math.PI/2, 0xf0c020);
    fChair(B, 41.8, 17.0, -Math.PI/2, 0xf0c020);
    fConsole(B, 30.40, 14.0, Math.PI/2, 1.6);
    fConsole(B, 30.40, 20.0, Math.PI/2, 1.6);
    fPainting(B, 38.0, 12.20, Math.PI, 2.0, 1.3, 0xe08a4a);
    fWindow(B, 34.0, 12.20, Math.PI, 2.0, 1.8, 1.0);
    fWindow(B, 42.0, 12.20, Math.PI, 2.0, 1.8, 1.0);
    fPlant(B, 45.0, 12.8);
    fPlant(B, 45.0, 21.2);

    /* CINEMA */
    fBigScreen(B, 38.0, 22.35, Math.PI, 6.5, 2.4);
    for (let r = 0; r < 4; r++){
      const zz = 26.0 + r*2.2;
      const yy = r * 0.28;
      B.box(11.0, 0.28, 2.2, 0x4a3a6a, 38, yy + 0.14, zz, 0, false);
      for (let c = 0; c < 6; c++){
        fCinemaSeat(B, 33.4 + c*1.85, zz, 0, (c % 2) ? 0xc02030 : 0xd03040, yy + 0.28);
      }
    }
    B.box(12.0, 0.10, 0.30, 0xffc83a, 38, 0.30, 24.6, 0, false);
    fRug(B, 38.0, 24.5, 0, 11.0, 2.6, 0x2a1a4a, 0x6a5aa8);
    fPlant(B, 30.8, 23.2);
    fPlant(B, 45.2, 23.2);
    fLampCeil(B, 34.0, 24.5, H);
    fLampCeil(B, 42.0, 24.5, H);
    B.box(0.10, 3.0, 12.0, 0x3a2a5a, 30.30, 1.5, 29.0, 0, false);
    B.box(0.10, 3.0, 12.0, 0x3a2a5a, 45.70, 1.5, 29.0, 0, false);

    /* ROOF TERRACE */
    B.level = 1; B.yOff = MANSION_ROOF_Y;

    B.floor( 0,  0, 24, 36, 0xe0a878);
    B.floor(28,  0, 46, 36, 0xe0a878);
    B.floor(24,  0, 28,  4, 0xe0a878);
    B.floor(24, 14, 28, 36, 0xe0a878);

    B.wallZ( 0.0, -0.15, 46.15, { t:0.28, h:1.20, col:0xf8d8a8 });
    B.wallZ(36.0, -0.15, 46.15, { t:0.28, h:1.20, col:0xf8d8a8 });
    B.wallX( 0.0, -0.15, 36.15, { t:0.28, h:1.20, col:0xf8d8a8 });
    B.wallX(46.0, -0.15, 36.15, { t:0.28, h:1.20, col:0xf8d8a8 });

    B.wallX(24.0, 4.0, 14.0, { t:0.16, h:1.10, col:0xf8d8a8 });
    B.wallX(28.0, 4.0, 14.0, { t:0.16, h:1.10, col:0xf8d8a8 });
    B.wallZ( 4.0, 24.0, 28.0, { t:0.16, h:1.10, col:0xf8d8a8 });

    B.floor( 2, 26, 20, 34, 0x4ac8a0);
    B.floor(30,  2, 44, 20, 0xf0c060);
    B.floor(10,  2, 20, 12, 0xc060a0);

    fBigScreen(B, 14.0, 26.6, Math.PI, 5.0, 2.4);
    fSofa(B, 14.0, 30.5, Math.PI, 3.4, 1.0, 0x2a8ad0, 0x50b0f0);
    fSofa(B,  9.6, 30.5, Math.PI/2, 3.0, 1.0, 0x2a8ad0, 0x50b0f0);
    fSofa(B, 18.4, 30.5, -Math.PI/2, 3.0, 1.0, 0x2a8ad0, 0x50b0f0);
    fCoffeeTable(B, 14.0, 30.5, 0, 2.2, 1.2);
    fRug(B, 14.0, 30.0, 0, 8.0, 5.0, 0xd04040, 0xffe090);
    fLounger(B, 12.0, 33.5, 0, 0xfff0d0);
    fLounger(B, 16.0, 33.5, 0, 0xfff0d0);

    B.box(4.0, 1.10, 1.4, 0x8a5a2a, 38, 0.55, 6.5, 0, false);
    B.box(4.4, 0.10, 1.8, 0x2f3237, 38, 1.15, 6.5, 0, false);
    fChair(B, 36.5, 5.2, 0, 0xf0c020);
    fChair(B, 38.0, 5.2, 0, 0xf0c020);
    fChair(B, 39.5, 5.2, 0, 0xf0c020);
    fDiningTable(B, 38.0, 11.0, 0, 4.0, 1.4, 0xe06a3a);
    for (let i=0;i<4;i++){
      fChair(B, 36.6 + i*0.95, 9.9, 0, 0xf0a040);
      fChair(B, 36.6 + i*0.95, 12.1, Math.PI, 0xf0a040);
    }
    fRug(B, 38.0, 9.5, 0, 7.0, 6.0, 0x8a5a2a, 0xffc880);

    fRug(B, 9.0, 12.0, 0, 11.0, 12.0, 0x4a8a3a, 0xc8f090);
    for (let i = 0; i < 6; i++){
      fPlant(B, 3.4 + i*2.1, 5.2);
      fPlant(B, 3.4 + i*2.1, 18.8);
    }
    fPlant(B, 2.2, 12.0);
    fPlant(B, 15.8, 12.0);
    fBench(B, 6.0, 12.0, 0, 0x8a5a2a);
    fBench(B, 12.0, 12.0, 0, 0x8a5a2a);
    fArmchair(B, 9.0, 15.0, 0, 0xf070a0, 0xffa0c8);
    fArmchair(B, 9.0,  9.0, Math.PI, 0xf070a0, 0xffa0c8);
    fCoffeeTable(B, 9.0, 12.0, 0, 1.6, 0.9);

    fLounger(B, 34.0, 30.0, 0, 0xfff0d0);
    fLounger(B, 36.0, 30.0, 0, 0xffd0a0);
    fLounger(B, 38.0, 30.0, 0, 0xa0e0ff);
    fLounger(B, 40.0, 30.0, 0, 0xf0c0e0);
    fRug(B, 37.0, 30.0, 0, 9.0, 5.0, 0x30a0c0, 0xd0f0ff);
    fPlant(B, 44.0, 34.6);

    for (const p of [[9,8],[9,16],[14,30],[20,30],[36,8],[40,16],[34,28],[42,34],[24,20],[42,22]])
      fPoleLamp(B, p[0], p[1]);

    return B;
  }

  /* ============================================================
     4. BUILD & FINALIZE
     ============================================================ */
  const ALL_COLLIDERS = [];
  const ceilMeshes = [];

  function finalize(B){
    const grp = new THREE.Group();
    const push = (arr, mat) => {
      if (!arr || arr.length === 0) return null;
      const merged = mergeGeometries(arr, false);
      arr.length = 0;
      const m = new THREE.Mesh(merged, mat);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      grp.add(m);
      return m;
    };
    push(B.lit,  MAT_LIT);
    push(B.glow, MAT_GLOW);
    const cm = push(B.ceilParts, MAT_CEIL);
    if (cm) ceilMeshes.push(cm);
    B.lit = B.glow = B.ceilParts = null;
    for (const c of B.colliders) ALL_COLLIDERS.push(c);
    B.colliders = null;
    scene.add(grp);
    return grp;
  }

  const _t0 = performance.now();
  finalize(buildMansion());
  console.log("[mansion] built in " + (performance.now() - _t0).toFixed(0) +
              " ms · colliders: " + ALL_COLLIDERS.length);

  /* ============================================================
     5. PLAYER / CAMERA CONTROLLER  (verbatim from reference)
     ============================================================ */
  const EYE = 1.65;
  const SPAWN = { x: 24.0, z: 2.6, yaw: Math.PI, level: 0 };

  const player = { x: SPAWN.x, z: SPAWN.z, y: EYE };
  let yaw = SPAWN.yaw, pitch = 0, level = 0;

  function inStairs(x, z){
    return x >= STAIR_X0 && x <= STAIR_X1 && z >= STAIR_Z0 && z <= STAIR_Z1;
  }
  function groundY(x, z, lv){
    if (inStairs(x, z)){
      const t = (z - STAIR_Z0) / (STAIR_Z1 - STAIR_Z0);
      return MANSION_ROOF_Y * Math.max(0, Math.min(1, t));
    }
    return lv * MANSION_ROOF_Y;
  }
  player.y = groundY(player.x, player.z, level) + EYE;

  const keys = Object.create(null);
  const kd = e => { keys[e.code] = true; };
  const ku = e => { keys[e.code] = false; };
  window.addEventListener('keydown', kd, { passive:true });
  window.addEventListener('keyup',   ku, { passive:true });

  const joy  = { on:false, id:-1, bx:0, by:0, x:0, y:0 };
  const look = { on:false, id:-1, px:0, py:0 };

  /* dynamically create joystick UI */
  const padEl = document.createElement('div');
  padEl.style.cssText = "position:fixed;width:118px;height:118px;border-radius:50%;" +
    "background:rgba(255,255,255,.10);border:2px solid rgba(255,255,255,.30);" +
    "pointer-events:none;display:none;z-index:9;transform:translate(-50%,-50%);";
  document.body.appendChild(padEl);
  const knobEl = document.createElement('div');
  knobEl.style.cssText = "position:fixed;width:50px;height:50px;border-radius:50%;" +
    "background:rgba(255,255,255,.42);border:2px solid rgba(255,255,255,.65);" +
    "pointer-events:none;display:none;z-index:9;transform:translate(-50%,-50%);";
  document.body.appendChild(knobEl);

  const LOOK_SENS = 0.0028;

  const onDown = (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
    const leftSide = e.clientX < innerWidth * 0.45;
    if (leftSide && !joy.on){
      joy.on = true; joy.id = e.pointerId;
      joy.bx = e.clientX; joy.by = e.clientY; joy.x = 0; joy.y = 0;
      padEl.style.display = 'block';
      knobEl.style.display = 'block';
      padEl.style.left  = e.clientX + 'px';
      padEl.style.top   = e.clientY + 'px';
      knobEl.style.left = e.clientX + 'px';
      knobEl.style.top  = e.clientY + 'px';
    } else if (!look.on){
      look.on = true; look.id = e.pointerId;
      look.px = e.clientX; look.py = e.clientY;
    }
  };
  const onMove = (e) => {
    if (joy.on && e.pointerId === joy.id){
      const R = 52;
      let dx = e.clientX - joy.bx, dy = e.clientY - joy.by;
      const len = Math.hypot(dx, dy);
      if (len > R){ dx = dx/len*R; dy = dy/len*R; }
      joy.x = dx / R; joy.y = dy / R;
      knobEl.style.left = (joy.bx + dx) + 'px';
      knobEl.style.top  = (joy.by + dy) + 'px';
    } else if (look.on && e.pointerId === look.id){
      const dx = e.clientX - look.px, dy = e.clientY - look.py;
      look.px = e.clientX; look.py = e.clientY;
      yaw   -= dx * LOOK_SENS;
      pitch -= dy * LOOK_SENS;
      pitch = Math.max(-1.35, Math.min(1.35, pitch));
    }
  };
  function endPointer(e){
    if (joy.on && e.pointerId === joy.id){
      joy.on = false; joy.id = -1; joy.x = 0; joy.y = 0;
      padEl.style.display = 'none';
      knobEl.style.display = 'none';
    }
    if (look.on && e.pointerId === look.id){
      look.on = false; look.id = -1;
    }
  }
  canvas.addEventListener('pointerdown', onDown, { passive:false });
  canvas.addEventListener('pointermove', onMove, { passive:false });
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  const ctxMenu = e => e.preventDefault();
  canvas.addEventListener('contextmenu', ctxMenu);

  const P_RADIUS = 0.34;
  function resolve(px, pz, lv){
    const r = P_RADIUS;
    for (let it = 0; it < 2; it++){
      for (let i = 0; i < ALL_COLLIDERS.length; i++){
        const b = ALL_COLLIDERS[i];
        if (b.level !== lv) continue;
        if (px < b.minX - r || px > b.maxX + r || pz < b.minZ - r || pz > b.maxZ + r) continue;
        const cx = px < b.minX ? b.minX : (px > b.maxX ? b.maxX : px);
        const cz = pz < b.minZ ? b.minZ : (pz > b.maxZ ? b.maxZ : pz);
        const dx = px - cx, dz = pz - cz;
        const d2 = dx*dx + dz*dz;
        if (d2 < r*r){
          if (d2 > 1e-7){
            const d = Math.sqrt(d2);
            const k = (r - d) / d;
            px += dx * k; pz += dz * k;
          } else {
            const dl = px - b.minX, dr = b.maxX - px;
            const db = pz - b.minZ, dt = b.maxZ - pz;
            const m = Math.min(dl, dr, db, dt);
            if (m === dl) px = b.minX - r;
            else if (m === dr) px = b.maxX + r;
            else if (m === db) pz = b.minZ - r;
            else pz = b.maxZ + r;
          }
        }
      }
    }
    return [px, pz];
  }

  /* ============================================================
     6. UI -- ceiling toggle + fps badge (created dynamically)
     ============================================================ */
  const ceilBtn = document.createElement("button");
  ceilBtn.textContent = "Ceiling ON";
  ceilBtn.style.cssText =
    /* Below the phone/wallet pill (right:14px, top:+58px) so it doesn't
       sit on top of it. */
    "position:fixed;top:calc(env(safe-area-inset-top) + 116px);right:14px;" +
    "z-index:20;font-size:11px;padding:9px 14px;border-radius:20px;" +
    "border:1px solid rgba(94,224,255,.5);background:rgba(8,16,28,.85);" +
    "color:#eaf6ff;font-family:Inter,system-ui,sans-serif;font-weight:800;" +
    "letter-spacing:.14em;cursor:pointer;backdrop-filter:blur(10px);";
  document.body.appendChild(ceilBtn);
  let ceilOn = true;
  const ceilToggle = () => {
    ceilOn = !ceilOn;
    ceilBtn.textContent = 'CEILING ' + (ceilOn ? 'ON' : 'OFF');
    for (const m of ceilMeshes) m.visible = ceilOn;
  };
  ceilBtn.addEventListener('click', ceilToggle);
  /* also allow key "C" like reference didn't have -- keep reference */
  ceilBtn.addEventListener('pointerdown', e => e.stopPropagation());

  const statsEl = document.createElement("div");
  statsEl.style.cssText =
    "position:fixed;left:14px;bottom:calc(env(safe-area-inset-bottom) + 34px);" +
    "z-index:20;color:#fff;font:800 10px Inter,system-ui,sans-serif;" +
    "letter-spacing:.14em;text-shadow:0 1px 3px rgba(0,0,0,.8);" +
    "pointer-events:none;";
  document.body.appendChild(statsEl);

  let _fpsAcc = 0, _fpsFrames = 0, _fps = 0;

  /* ============================================================
     7. RETURN
     ============================================================ */
  console.log("[mansion] ready");

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "MY HOUSE",
    title: "THE MANSION",
    subtitle: "WALK \u00B7 SIT \u00B7 CARRY",
    hint: "LEFT: MOVE  \u00B7  RIGHT: LOOK",
    dispose: () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('contextmenu', ctxMenu);
      try { padEl.remove(); } catch(_) {}
      try { knobEl.remove(); } catch(_) {}
      try { ceilBtn.remove(); } catch(_) {}
      try { statsEl.remove(); } catch(_) {}
    },
    update: (dt, t) => {
      let mf = 0, ms = 0;
      if (keys.KeyW || keys.ArrowUp)    mf += 1;
      if (keys.KeyS || keys.ArrowDown)  mf -= 1;
      if (keys.KeyD || keys.ArrowRight) ms += 1;
      if (keys.KeyA || keys.ArrowLeft)  ms -= 1;
      mf -= joy.y;
      ms += joy.x;
      const mag = Math.hypot(mf, ms);
      if (mag > 1){ mf /= mag; ms /= mag; }
      const speed = (keys.ShiftLeft || keys.ShiftRight) ? 5.2 : 3.0;
      if (mf !== 0 || ms !== 0){
        const sy = Math.sin(yaw), cy = Math.cos(yaw);
        const dx = (-sy * mf + cy * ms) * speed * dt;
        const dz = (-cy * mf - sy * ms) * speed * dt;
        const [nx, nz] = resolve(player.x + dx, player.z + dz, level);
        player.x = nx; player.z = nz;
      }
      const gy = groundY(player.x, player.z, level);
      if (inStairs(player.x, player.z)){
        if (gy > 2.5)      level = 1;
        else if (gy < 1.5) level = 0;
      }
      player.y = groundY(player.x, player.z, level) + EYE;

      camera.position.set(player.x, player.y, player.z);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      _fpsFrames++; _fpsAcc += dt;
      if (_fpsAcc >= 0.5){
        _fps = Math.round(_fpsFrames / _fpsAcc);
        _fpsFrames = 0; _fpsAcc = 0;
        const info = renderer.info.render;
        statsEl.textContent = _fps + " fps \u00B7 " + info.calls +
          " draws \u00B7 " + (info.triangles/1000).toFixed(1) + "k tris";
      }
    },
  };
}

