/* duplex/interior.js -- converted from the standalone prototype "duplex.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= SHARED KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0a0c10);
  scene.fog=new THREE.Fog(0x0a0c10,50,160);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,350);
  camera.rotation.order='YXZ';

  scene.add(new THREE.HemisphereLight(0xfff4e8,0x3a3028,1.05));
  const sun=new THREE.DirectionalLight(0xfff4d6,1.15);
  sun.position.set(25,45,18); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xc8d8ff,.5);
  fill.position.set(-18,22,-18); scene.add(fill);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,12),
        SPHG=new THREE.SphereGeometry(.5,10,8),
        CONEG=new THREE.ConeGeometry(.5,1,8);
  const MC=new Map();
  function mat(c,o){
    if(o&&o.map) return new THREE.MeshLambertMaterial(Object.assign({color:c},o));
    const k=c+'|'+JSON.stringify(o||0); let m=MC.get(k);
    if(!m){m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));MC.set(k,m);}
    return m;
  }
  const glow=c=>new THREE.MeshBasicMaterial({color:c});
  const glassM=mat(0xb8d8e8,{transparent:true,opacity:.25});
  const world=new THREE.Group(); scene.add(world);
  const solid=[];
  const seats=[];
  const uses=[];

  /* box helper: o.solid adds collision, o.ground = only blocks ground floor, o.up = only blocks upper floor */
  function box(w,h,d,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(BOXG,typeof m==='number'?mat(m):m);
    s.scale.set(w,h,d); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid){
      const c=Math.abs(Math.cos(o.ry||0)),n=Math.abs(Math.sin(o.ry||0));
      solid.push({x,z,hw:(c*w+n*d)/2,hd:(n*w+c*d)/2, ground:o.ground, up:o.up});
    }
    return s;
  }
  function cyl(r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CYLG,typeof m==='number'?mat(m):m);
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid){
      solid.push({x,z,hw:r,hd:r, ground:o.ground, up:o.up});
    }
    return s;
  }
  function sph(r,x,y,z,m){
    const s=new THREE.Mesh(SPHG,typeof m==='number'?mat(m):m);
    s.scale.setScalar(r*2); s.position.set(x,y,z); world.add(s); return s;
  }
  function tex(w,h,draw,rx,ry){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||1);
    t.colorSpace=THREE.SRGBColorSpace;
    return t;
  }

  /* ================= MODERN DUPLEX — FIXED ================= */
  const W=20, D=26, H=3.6, H2=7.2;
  const ROOM={x:W/2-1, z:D/2-1};
  const START={x:0, z:11, yaw:0};

  /* textures */
  const marbleTex=tex(128,128,g=>{
    g.fillStyle='#f5f2ec'; g.fillRect(0,0,128,128);
    g.strokeStyle='#e0d8cc'; g.lineWidth=2;
    for(let i=0;i<12;i++){
      g.beginPath(); g.moveTo(Math.random()*128,0); g.lineTo(Math.random()*128,128); g.stroke();
      g.beginPath(); g.moveTo(0,Math.random()*128); g.lineTo(128,Math.random()*128); g.stroke();
    }
    g.fillStyle='#ece8e0';
    for(let i=0;i<60;i++){g.fillRect(Math.random()*128,Math.random()*128,5,5);}
  },6,7);

  const woodTex=tex(128,128,g=>{
    g.fillStyle='#b8865a'; g.fillRect(0,0,128,128);
    g.strokeStyle='#9a6a42'; g.lineWidth=2;
    for(let i=0;i<8;i++){g.beginPath();g.moveTo(0,i*16);g.lineTo(128,i*16);g.stroke();}
    g.strokeStyle='#8a5a32'; g.lineWidth=1;
    for(let i=0;i<35;i++){const x=Math.random()*128;g.beginPath();g.moveTo(x,0);g.lineTo(x+6,128);g.stroke();}
  },7,8);

  const marbleM=mat(0xffffff,{map:marbleTex});
  const woodFloorM=mat(0xffffff,{map:woodTex});
  const wallM=mat(0xf5f0e8), ceilM=mat(0xfaf8f4),
        darkWood=mat(0x3a2010), wood=mat(0x8a5a32),
        metal=mat(0xc0c8d0), white=mat(0xfafafa),
        cream=mat(0xe8e0d0), dark=mat(0x1a1a1a),
        fabric=mat(0x5a6a7a), blackM=mat(0x0a0a0a);

  /* ===== SHELL ===== */
  /* ground floor */
  box(W,.2,D,0,-.1,0,marbleM);
  /* upper floor slab — spans z=-13 to 1.5, NOT solid (critical fix) */
  box(W,.25,14.5,0,H-.125,-5.75,woodFloorM);
  /* upper ceiling */
  box(W,.2,D,0,H2+.1,0,ceilM);

  /* outer walls */
  box(W,H2,.25,0,H2/2,-D/2,wallM,{solid:true});
  box(W,H2,.25,0,H2/2,D/2,wallM,{solid:true});
  box(.25,H2,D,-W/2,H2/2,0,wallM,{solid:true});
  box(.25,H2,D,W/2,H2/2,0,wallM,{solid:true});

  /* baseboards */
  box(W,.15,.08,0,.075,-D/2+.15,darkWood);
  box(W,.15,.08,0,.075,D/2-.15,darkWood);
  box(.08,.15,D,-W/2+.15,.075,0,darkWood);
  box(.08,.15,D,W/2-.15,.075,0,darkWood);

  /* ===== STAIRCASE (right wall, x=7.5→10, z=8→1.5) ===== */
  /* floating treads (NOT solid — height function handles) */
  const SX1=7.6, SX2=9.9, SZBOT=8.0, SZTOP=1.5;
  const NSTEPS=16, stepH=H/NSTEPS, stepD=(SZBOT-SZTOP)/NSTEPS;
  for(let i=0;i<NSTEPS;i++){
    const z=SZBOT-i*stepD-stepD/2;
    box(SX2-SX1,stepH,stepD*0.92,(SX1+SX2)/2,stepH*(i+0.5),z,wood);
  }
  /* glass balustrade on the open side of the stairs */
  for(let i=0;i<NSTEPS;i+=2){
    const z=SZBOT-i*stepD-stepD;
    box(.05,1.0,stepD*2,SX1-.02,stepH*(i+0.5)+.5,z,glassM);
  }
  /* steel handrail */
  cyl(.035,6.6,SX1-.05,H*1.05,4.7,metal,{rx:Math.atan2(H,6.5)});

  /* stair side wall — GROUND FLOOR ONLY (blocks side entry, not upper walk) */
  box(.15,H,6.5,SX1-.08,H/2,4.75,glassM,{solid:true, ground:true});
  /* stair front wall — GROUND FLOOR ONLY (blocks entering from kitchen side) */
  box(2.6,H,.15,8.75,H/2,SZTOP,wallM,{solid:true, ground:true});

  /* ===== UPPER FLOOR: ATRIUM RAILING (upper only) ===== */
  box(17.5,1.1,.08,-1.25,H+.55,SZTOP,glassM,{solid:true, up:true});
  cyl(.03,17.5,-1.25,H+1.12,SZTOP,metal,{rz:Math.PI/2});

  /* ===== LIVING ROOM (front, double-height, z=1.5→13) ===== */
  /* rug */
  box(6.5,.03,4.5,-2,.02,6,mat(0x6a5a4a));
  box(6.1,.04,4.1,-2,.03,6,mat(0x7a6a5a));
  /* modern L-sofa facing the left wall */
  function modSofa(x,z,w,d,ry,c){
    ry=ry||0; const cs=Math.cos(ry),sn=Math.sin(ry);
    const put=(ww,hh,dd,ox,oy,oz,m)=>box(ww,hh,dd,x+ox*cs+oz*sn,oy,z-ox*sn+oz*cs,m,{ry,solid:true,ground:true});
    put(w,.32,d,0,.32,0,mat(c||0x5a6a7a));
    put(w,.6,.18,0,.62,-d/2+.09,mat(c||0x5a6a7a));
    put(.18,.6,d,-w/2+.09,.62,0,mat(c||0x5a6a7a));
    put(.18,.6,d,w/2-.09,.62,0,mat(c||0x5a6a7a));
    const n=Math.floor(w/.6);
    for(let i=0;i<n;i++){
      const lx=-w/2+.3+i*.6;
      put(.5,.12,.5,lx,.5,d/2-.25,mat(0x6a7a8a));
      const sx=x+lx*cs+(d/2-.25)*sn;
      const sz=z-lx*sn+(d/2-.25)*cs;
      seats.push({ type:"sit", label:"SIT", x:sx, z:sz, yaw:ry, h:0.56, level:0, taken:false });
    }
    [[-w/2+.15,-d/2+.1],[w/2-.15,-d/2+.1],[-w/2+.15,d/2-.1],[w/2-.15,d/2-.1]].forEach(p=>
      box(.06,.12,.06,x+p[0]*cs+p[1]*sn,.06,z-p[0]*sn+p[1]*cs,metal));
  }
  modSofa(-2,7.5,4.2,1.4,0,0x5a6a7a);
  modSofa(-4.5,9.3,1.2,3.6,0,0x5a6a7a);
  /* armchair */
  modSofa(1.5,9.5,1.5,1.4,Math.PI,0x6a5a5a);
  /* coffee table */
  box(3.2,.08,1.6,-2,.42,6,wood,{solid:true,ground:true});
  box(3.0,.06,1.4,-2,.46,6,glassM);
  [[-1.4,-.65],[1.4,-.65],[-1.4,.65],[1.4,.65]].forEach(p=>
    box(.05,.42,.05,-2+p[0],.21,6+p[1],metal));
  box(.4,.3,.3,-2.6,.6,6,mat(0xc8a850));
  cyl(.12,.25,-1.4,.6,6,white);
  /* TV wall unit on left wall */
  box(.35,.5,4.5,-W/2+.5,.25,6,wood,{solid:true,ground:true});
  box(.3,.06,4.2,-W/2+.5,.53,6,dark);
  box(.08,2.0,4.2,-W/2+.55,1.8,6,blackM);
  box(.04,1.8,4.0,-W/2+.6,1.8,6,glow(0x1a2a4a));
  /* floor lamp */
  cyl(.03,2.0,-4.5,1.0,10.0,metal);
  cyl(.3,.4,-4.5,2.05,10.0,mat(0xf0e8d0));
  sph(.25,-4.5,2.05,10.0,glow(0xfff4d0));
  /* plant */
  cyl(.25,.4,2.5,.2,11.5,mat(0xb07040),{solid:true,ground:true});
  sph(.45,2.5,.9,11.5,mat(0x3a7a3a));
  sph(.35,2.2,1.2,11.3,mat(0x4a8a4a));

  /* ===== KITCHEN (back-left, z=-13→1.5) ===== */
  box(4.5,.9,1.6,-5.5,.45,-3,wood,{solid:true,ground:true});
  box(4.7,.1,1.8,-5.5,.95,-3,marbleM);
  box(.1,.9,1.6,-7.75,.45,-3,marbleM);
  box(.1,.9,1.6,-3.25,.45,-3,marbleM);
  /* island stools */
  for(let i=0;i<3;i++){
    const sx=-6.7+i*1.2;
    cyl(.2,.06,sx,.7,-4.1,mat(0x3a2010));
    cyl(.03,.65,sx,.35,-4.1,metal);
    cyl(.18,.04,sx,.04,-4.1,metal);
    seats.push({ type:"sit", label:"SIT AT ISLAND", x:sx, z:-4.1, yaw:0, h:0.72, level:0, taken:false });
  }
  /* back counter */
  box(7.5,.9,.7,-5.5,.45,-12.3,wood,{solid:true,ground:true});
  box(7.7,.08,.8,-5.5,.94,-12.3,marbleM);
  box(7.5,.8,.6,-5.5,.4,-12.7,darkWood);
  box(7.5,.8,.4,-5.5,2.5,-12.6,cream);
  box(7.5,.02,.4,-5.5,2.1,-12.6,dark);
  box(1.0,.08,.45,-7,.98,-12.3,metal);
  cyl(.05,.35,-7,1.15,-12.1,metal);
  box(1.2,.06,.7,-3.5,.98,-12.3,dark);
  for(let i=0;i<4;i++)
    cyl(.15,.02,-3.9+(i%2)*.8,1.02,-12.5+Math.floor(i/2)*.3,glow(0x3a3a3a));
  box(1.2,.3,.7,-3.5,2.2,-12.4,metal);
  /* fridge */
  box(1.1,2.0,.7,-9,1.0,-12.2,metal,{solid:true,ground:true});
  box(1.1,.02,.7,-9,1.3,-12.2,dark);

  uses.push({ kind:"cook", label:"COOK", x:-3.5, z:-11.8, y:0, level:0, r:1.8 });
  uses.push({ kind:"sink", label:"WASH", x:-7, z:-11.8, y:0, level:0, r:1.5 });
  uses.push({ kind:"fridge", label:"OPEN FRIDGE", x:-9, z:-11.5, y:0, level:0, r:1.5 });

  /* ===== DINING (back-right, z=-13→1.5) ===== */
  box(3.8,.1,1.5,4.5,1.0,-4,wood,{solid:true,ground:true});
  box(3.6,.08,1.3,4.5,1.05,-4,mat(0x8a6a4a));
  [[-1.6,-.6],[1.6,-.6],[-1.6,.6],[1.6,.6]].forEach(p=>
    box(.12,1.0,.12,4.5+p[0],.5,-4+p[1],metal));
  function mChair(x,z,ry){
    ry=ry||0; const c=Math.cos(ry),s=Math.sin(ry);
    box(.5,.05,.5,x,.5,z,mat(0x3a2010),{ry,solid:true,ground:true});
    box(.5,.5,.06,x,.72,z-.22,mat(0x3a2010),{ry});
    [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]].forEach(p=>
      box(.04,.45,.04,x+p[0]*c+p[1]*s,.25,z-p[0]*s+p[1]*c,metal));
    seats.push({ type:"sit", label:"SIT", x, z, yaw:ry, h:0.55, level:0, taken:false });
  }
  for(let i=0;i<3;i++){
    mChair(3.5+i*1.0,-5.0,0);
    mChair(3.5+i*1.0,-3.0,Math.PI);
  }
  /* pendants */
  for(let i=0;i<3;i++){
    cyl(.02,1.2,4.0+i*.5,H-.6,-4,metal);
    cyl(.2,.15,4.0+i*.5,H-1.2,-4,glow(0xfff4d0));
  }
  /* sideboard */
  box(3.2,.85,.45,7.2,1.05,-10,wood,{solid:true,ground:true});
  box(3.1,.06,.4,7.2,1.48,-10,cream);
  box(.6,.5,.3,7.0,1.7,-10,mat(0xc8a850));

  /* ===== FOYER ===== */
  box(2.0,.08,.45,0,.9,12.0,wood,{solid:true,ground:true});
  box(1.9,.7,.35,0,.45,12.0,mat(0x5a3a2a));
  box(.3,.4,.25,0,1.15,12.0,mat(0xc8a850));
  /* front door */
  box(2.0,2.6,.12,0,1.3,D/2-.14,mat(0x2a1a0a),{solid:true});
  box(2.2,.15,.18,0,2.65,D/2-.14,wood);
  box(.08,.8,.08,.75,1.3,D/2-.22,metal);
  box(.2,2.7,.2,-1.1,1.35,D/2-.14,wood);
  box(.2,2.7,.2,1.1,1.35,D/2-.14,wood);
  /* front window (double height) */
  box(6.0,4.5,.1,0,3.2,D/2-.12,glow(0xbfe0f5));
  box(6.2,.15,.2,0,5.5,D/2-.14,wood);
  box(.2,4.6,.2,-3.05,3.2,D/2-.14,wood);
  box(.2,4.6,.2,3.05,3.2,D/2-.14,wood);
  box(.15,4.5,.15,0,3.2,D/2-.18,wood);

  /* ===== UPPER FLOOR: MASTER SUITE ===== */
  /* master bed */
  box(2.4,.35,2.8,-5,H+.18,-8,wood,{solid:true,up:true});
  box(2.3,.25,2.7,-5,H+.48,-8,white);
  box(2.1,.15,2.5,-5,H+.68,-8,mat(0x7a8a9a));
  box(.8,.15,.4,-5.5,H+.8,-9.2,white);
  box(.8,.15,.4,-4.5,H+.8,-9.2,white);
  box(2.5,1.0,.12,-5,H+.9,-9.5,wood);
  box(.6,.55,.5,-6.8,H+.28,-9.2,wood,{solid:true,up:true});
  cyl(.12,.25,-6.8,H+.78,-9.2,mat(0xc8a850));
  cyl(.1,.3,-6.8,H+.9,-9.2,glow(0xfff4d0));
  box(.6,.55,.5,-3.2,H+.28,-9.2,wood,{solid:true,up:true});
  cyl(.12,.25,-3.2,H+.78,-9.2,mat(0xc8a850));
  seats.push({ type:"lie", label:"SLEEP", x:-5, z:-8, yaw:0, h:H+0.74, level:1, taken:false });

  /* wardrobe against back wall */
  box(3.5,2.4,.6,-7,H+1.2,-12.5,cream,{solid:true,up:true});
  box(3.4,.02,.5,-7,H+1.2,-12.5,darkWood);
  box(.05,2.2,.5,-7,H+1.2,-12.2,metal);
  uses.push({ kind:"wardrobe", label:"USE WARDROBE", x:-7, z:-11.8, y:H, level:1, r:1.6 });

  /* dresser */
  box(2.0,.9,.5,-1,H+.5,-12.4,wood,{solid:true,up:true});
  box(1.9,.7,.4,-1,H+.5,-12.5,cream);
  for(let i=0;i<3;i++) box(1.8,.02,.35,-1,H+.2+i*.25,-12.5,darkWood);
  box(1.4,1.8,.06,-1,H+1.7,-12.6,mat(0xd8e8f0));
  /* desk near railing */
  box(2.2,.08,.9,3,H+.85,0.0,wood,{solid:true,up:true});
  box(2.1,.7,.8,3,H+.45,0.0,mat(0x5a3a2a));
  box(.7,.05,.5,3,H+.92,0.0,dark);
  box(.5,.35,.04,3,H+1.15,-.2,glow(0x9fd0ff));
  box(.15,.2,.15,3.5,H+.98,0.0,mat(0xc8a850));
  uses.push({ kind:"work", label:"WORK", x:3, z:0.8, y:H, level:1, r:1.6 });

  /* desk chair */
  box(.5,.05,.5,2.5,H+.5,1.0,mat(0x3a3a3a),{solid:true,up:true});
  box(.5,.5,.06,2.5,H+.72,1.2,mat(0x3a3a3a));
  cyl(.03,.45,2.5,H+.25,1.0,metal);
  seats.push({ type:"sit", label:"SIT AT DESK", x:2.5, z:1.0, yaw:Math.PI, h:H+0.55, level:1, taken:false });

  /* ===== UPPER FLOOR: BATHROOM (back-right, walled) ===== */
  box(.2,H2-H,5,1.5,H+H/2,-10.5,wallM,{solid:true,up:true});
  box(5,H2-H,.2,6.5,H+H/2,-8,wallM,{solid:true,up:true});
  /* toilet */
  cyl(.35,.45,8,H+.22,-12,white,{solid:true,up:true});
  box(.7,.45,.5,8,H+.55,-12.3,white);
  seats.push({ type:"toilet", label:"USE TOILET", x:8, z:-12, yaw:0, h:H+0.55, level:1, taken:false });
  /* vanity */
  box(1.6,.15,.55,8.5,H+.9,-9,white,{solid:true,up:true});
  box(1.5,.5,.45,8.5,H+.65,-9,cream);
  cyl(.12,.12,8.5,H+1.02,-9,metal);
  box(1.4,1.3,.04,8.5,H+1.75,-8.7,mat(0xd8e8f0));
  uses.push({ kind:"sink", label:"WASH", x:8.5, z:-9.5, y:H, level:1, r:1.5 });
  /* walk-in shower */
  box(2.0,.06,2.0,4,H+.03,-12,glassM);
  box(.05,2.0,2.0,3,H+.9,-12,glassM);
  box(2.0,2.0,.05,4,H+.9,-13,glassM);
  uses.push({ kind:"shower", label:"TAKE SHOWER", x:4, z:-12, y:H, level:1, r:1.6 });
  /* bathtub */
  box(2.2,.55,1.1,4,H+.28,-9,white,{solid:true,up:true});
  box(2.0,.45,.9,4,H+.5,-9,mat(0xb8d8e8));
  seats.push({ type:"bath", label:"TAKE BATH", x:4, z:-9, yaw:0, h:H+0.28, level:1, taken:false });

  /* ===== DECOR & LIGHTS ===== */
  box(2.0,1.5,.06,-8,2.4,-D/2+.15,blackM);
  box(1.8,1.3,.02,-8,2.4,-D/2+.18,mat(0x3a6a8a));
  box(1.5,1.8,.06,8,2.2,-D/2+.15,blackM);
  box(1.3,1.6,.02,8,2.2,-D/2+.18,mat(0x8a5a4a));
  box(1.8,1.2,.06,-8,H+2.4,-D/2+.15,blackM);
  box(1.6,1.0,.02,-8,H+2.4,-D/2+.18,mat(0x4a7a5a));

  /* ceiling lights */
  for(let i=0;i<3;i++) for(let j=0;j<3;j++)
    box(1.4,.06,.8,-6+i*6,H-.06,-6+j*6,glow(0xfff8ee));
  for(let i=0;i<2;i++) for(let j=0;j<2;j++)
    box(1.6,.06,.9,-4+i*8,H2-.06,-6+j*10,glow(0xfff8ee));
  /* atrium pendant */
  cyl(.02,1.8,0,H+1.8,6,metal);
  cyl(.55,.35,0,H-.9,6,mat(0xc8a850));
  cyl(.45,.18,0,H-1.25,6,glow(0xfff4d0));

  /* ===== COLLISION BOUNDS (outer) ===== */
  solid.push({x:0,z:-D/2+.1,hw:W/2,hd:.1});
  solid.push({x:0,z:D/2-.1,hw:W/2,hd:.1});
  solid.push({x:-W/2+.1,z:0,hw:.1,hd:D/2});
  solid.push({x:W/2-.1,z:0,hw:.1,hd:D/2});

  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const __cols = [];
  for (const b of solid) {
    const mk = (level) => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level });
    /* upper-floor flags from the prototype: ground = blocks floor 0 only, up = blocks floor 1 only */
    if (b.ground) __cols.push(mk(0));
    else if (b.up) __cols.push(mk(1));
    else { __cols.push(mk(0)); __cols.push(mk(1)); }
  }
  const __world = {
    colliders: __cols, seats, uses,
    stairs: [{ minX: 7.4, maxX: 10.1, minZ: 1.5, maxZ: 8.0, axis: 'z', y0: H, y1: 0, level: 0, toLevel: 1 }],
    platforms: [{ level: 1, minX: -W/2, maxX: W/2, minZ: -D/2, maxZ: 1.7, h: H }],
    levelHeight: () => 0,
    ceilingHeight: H,
    bounds: { minX: -ROOM.x, maxX: ROOM.x, minZ: -ROOM.z, maxZ: ROOM.z },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "MODERN DUPLEX",
    title: "LUXURY HOME · 2 FLOORS",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "duplex",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}
