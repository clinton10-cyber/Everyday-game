/* lagosflat/interior.js -- converted from the standalone prototype "lgs.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0a0c10);
  scene.fog=new THREE.Fog(0x0a0c10,60,180);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,350);
  camera.rotation.order='YXZ';

  scene.add(new THREE.HemisphereLight(0xfff4e8,0x3a3028,1.05));
  const sun=new THREE.DirectionalLight(0xfff4d6,1.1);
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
  const netM=mat(0xffffff,{transparent:true,opacity:.22});
  const glassM=mat(0xb8d8e8,{transparent:true,opacity:.28});
  const world=new THREE.Group(); scene.add(world);
  const solid=[];
  const seats=[];
  const uses=[];

  function box(w,h,d,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(BOXG,typeof m==='number'?mat(m):m);
    s.scale.set(w,h,d); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid){
      const c=Math.abs(Math.cos(o.ry||0)),n=Math.abs(Math.sin(o.ry||0));
      solid.push({x,z,hw:(c*w+n*d)/2,hd:(n*w+c*d)/2});
    }
    return s;
  }
  function cyl(r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CYLG,typeof m==='number'?mat(m):m);
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid) solid.push({x,z,hw:r,hd:r});
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

  /* ================= LAGOS APARTMENT ================= */
  const W=22, D=26, H=3.4;
  const ROOM={x:W/2-1, z:D/2-1};
  const START={x:0, z:11, yaw:0};

  /* --- textures --- */
  const marbleTex=tex(128,128,g=>{
    g.fillStyle='#f2ede4'; g.fillRect(0,0,128,128);
    g.strokeStyle='#e0d8cc'; g.lineWidth=2;
    for(let i=0;i<14;i++){
      g.beginPath(); g.moveTo(Math.random()*128,0); g.lineTo(Math.random()*128,128); g.stroke();
      g.beginPath(); g.moveTo(0,Math.random()*128); g.lineTo(128,Math.random()*128); g.stroke();
    }
    g.fillStyle='#e8e2d6';
    for(let i=0;i<50;i++){g.fillRect(Math.random()*128,Math.random()*128,4,4);}
  },6,7);

  const tileTex=tex(64,64,g=>{
    g.fillStyle='#e8e4dc'; g.fillRect(0,0,64,64);
    g.strokeStyle='#d0c8bc'; g.lineWidth=2;
    g.strokeRect(1,1,62,62);
  },8,8);

  const woodTex=tex(128,128,g=>{
    g.fillStyle='#b8865a'; g.fillRect(0,0,128,128);
    g.strokeStyle='#9a6a42'; g.lineWidth=2;
    for(let i=0;i<8;i++){g.beginPath();g.moveTo(0,i*16);g.lineTo(128,i*16);g.stroke();}
    g.strokeStyle='#8a5a32'; g.lineWidth=1;
    for(let i=0;i<30;i++){const x=Math.random()*128;g.beginPath();g.moveTo(x,0);g.lineTo(x+6,128);g.stroke();}
  },7,8);

  const marbleM=mat(0xffffff,{map:marbleTex});
  const tileM=mat(0xffffff,{map:tileTex});
  const woodFloorM=mat(0xffffff,{map:woodTex});
  const wallM=mat(0xf5f0e8), ceilM=mat(0xfaf8f4),
        darkWood=mat(0x3a2010), wood=mat(0x8a5a32),
        metal=mat(0xc0c8d0), white=mat(0xfafafa),
        cream=mat(0xe8e0d0), dark=mat(0x1a1a1a),
        leather=mat(0x4a3a2a), leather2=mat(0x6a5040),
        blackM=mat(0x0a0a0a);

  /* ===== SHELL ===== */
  /* living/dining floor (marble) */
  box(W,.2,16,0,-.1,5,marbleM);
  /* kitchen floor (tile) */
  box(11,.2,10,-5.5,-.1,-8,tileM);
  /* bedroom floor (wood) */
  box(11,.2,10,5.5,-.1,-8,woodFloorM);
  /* ceiling */
  box(W,.2,D,0,H+.1,0,ceilM);
  /* outer walls */
  box(W,H,.25,0,H/2,-D/2,wallM,{solid:true});
  box(W,H,.25,0,H/2,D/2,wallM,{solid:true});
  box(.25,H,D,-W/2,H/2,0,wallM,{solid:true});
  box(.25,H,D,W/2,H/2,0,wallM,{solid:true});
  /* baseboards */
  box(W,.14,.06,0,.07,-D/2+.15,darkWood);
  box(W,.14,.06,0,.07,D/2-.15,darkWood);
  box(.06,.14,D,-W/2+.15,.07,0,darkWood);
  box(.06,.14,D,W/2-.15,.07,0,darkWood);

  /* ===== INTERIOR WALLS ===== */
  /* divider between kitchen (left) and bedroom (right) */
  box(.2,H,10,0,H/2,-8,wallM,{solid:true});
  /* bedroom front wall with door gap at x 1.5–3.0 */
  box(1.5,H,.2,.75,H/2,-3,wallM,{solid:true});
  box(8,H,.2,7,H/2,-3,wallM,{solid:true});
  /* bathroom partition inside bedroom (corner x 7–11, z -13 to -10) */
  box(.15,H,3,7,H/2,-11.5,wallM,{solid:true});
  box(2,H,.15,8,H/2,-10,wallM,{solid:true});
  box(.5,H,.15,10.75,H/2,-10,wallM,{solid:true});

  /* ===== LIVING ROOM (z 4 → 13) ===== */
  /* rug -- sized/centered to sit under the whole seating group (main sofa,
     second sofa, armchair, coffee table) instead of only the main sofa */
  box(7,.03,6.6,-5.5,.02,9,mat(0x6a5a4a));
  box(6.6,.04,6.2,-5.5,.03,9,mat(0x8a7a6a));

  /* sofa builder — back is at -z locally, ry rotates */
  function couch(x,z,w,d,ry,c){
    ry=ry||0;
    const cs=Math.cos(ry), sn=Math.sin(ry);
    const put=(ww,hh,dd,ox,oy,oz,m,sol)=>{
      const wx=x+ox*cs+oz*sn, wz=z-ox*sn+oz*cs;
      return box(ww,hh,dd,wx,oy,wz,m,{ry,solid:sol!==false});
    };
    put(w,.32,d,0,.32,0,mat(c));            /* base */
    put(w,.62,.2,0,.63,-d/2+.1,mat(c));     /* back */
    put(.2,.62,d,-w/2+.1,.63,0,mat(c));     /* left arm */
    put(.2,.62,d,w/2-.1,.63,0,mat(c));      /* right arm */
    /* seat cushions */
    const n=Math.max(2,Math.floor(w/.65));
    for(let i=0;i<n;i++){
      const lx=-w/2+(i+.5)*(w/n);
      put(w/n-.05,.14,d-.25,lx,.52,.1,mat(c+0x0a0a0a));
      const sx=x+lx*cs+.1*sn;
      const sz=z-lx*sn+.1*cs;
      seats.push({ type:"sit", label:"SIT", x:sx, z:sz, yaw:ry, h:0.55, level:0, taken:false });
    }
    /* legs */
    [[-w/2+.15,-d/2+.1],[w/2-.15,-d/2+.1],[-w/2+.15,d/2-.1],[w/2-.15,d/2-.1]].forEach(p=>
      box(.06,.14,.06,x+p[0]*cs+p[1]*sn,.07,z-p[0]*sn+p[1]*cs,metal));
  }

  /* main 3-seater facing left wall (TV) */
  couch(-4,8,4.0,1.3,-Math.PI/2,0x4a3a2a);
  /* second sofa at the back of the rug */
  couch(-4,11.4,3.4,1.3,Math.PI,0x4a3a2a);
  /* armchair */
  couch(-7.5,11.0,1.5,1.3,Math.PI*0.75,0x5a4a3a);

  /* Ankara throw pillows (bright) */
  [[ -5.2,8.6,-Math.PI/2,0xe87a20 ],[-4.9,7.2,-Math.PI/2,0x2a8a5a ],
   [ -3.4,10.6,Math.PI,0xf0c020 ],[ -4.6,10.6,Math.PI,0xd83a3a ]].forEach(p=>{
    box(.5,.5,.14,p[0],.85,p[1],mat(p[3]),{ry:p[2]});
  });

  /* coffee table (solid) */
  box(2.4,.08,1.3,-7.5,.42,8,wood,{solid:true});
  box(2.2,.06,1.1,-7.5,.46,8,glassM);
  [[-1.0,-.5],[1.0,-.5],[-1.0,.5],[1.0,.5]].forEach(p=>
    box(.05,.42,.05,-7.5+p[0],.21,8+p[1],metal));
  /* kola nut bowl + decor */
  cyl(.22,.12,-8.0,.55,8,mat(0xc8a850));
  sph(.06,-8.05,.6,7.95,mat(0x3a1a08));
  sph(.06,-7.95,.6,8.05,mat(0x3a1a08));
  sph(.06,-7.9,.6,7.9,mat(0x3a1a08));
  /* magazine */
  box(.5,.03,.35,-7.0,.53,8.1,mat(0xe8e0d0));

  /* TV wall unit on left wall */
  box(.4,.5,4.5,-W/2+.45,.25,8,wood,{solid:true});
  box(.35,.06,4.2,-W/2+.45,.53,8,dark);
  box(.08,2.0,3.6,-W/2+.5,1.7,8,blackM);
  box(.03,1.8,3.4,-W/2+.55,1.7,8,glow(0x14243a));
  /* speakers flanking TV */
  box(.35,1.2,.35,-W/2+.6,.9,5.6,dark);
  box(.35,1.2,.35,-W/2+.6,.9,10.4,dark);

  /* floor lamp */
  cyl(.03,1.9,-10.4,.95,11.0,metal);
  cyl(.28,.38,-10.4,1.95,11.0,mat(0xf0e8d0));
  sph(.24,-10.4,1.95,11.0,glow(0xfff4d0));
  /* plant */
  cyl(.26,.42,3.6,.21,11.5,mat(0xb07040),{solid:true});
  sph(.48,3.6,.92,11.5,mat(0x2e6a2e));
  sph(.36,3.3,1.2,11.3,mat(0x3e7a3e));

  uses.push({ kind:"use", label:"WATCH TV", x:-9, z:8, y:0, level:0, r:3.0 });

  /* ceiling fan (animated) */
  const fanGroup=new THREE.Group();
  fanGroup.position.set(-4,H-.35,8);
  const hub=new THREE.Mesh(CYLG,mat(0x9a8a7a)); hub.scale.set(.3,.16,.3); fanGroup.add(hub);
  const fanRod=new THREE.Mesh(CYLG,metal); fanRod.scale.set(.05,.5,.05); fanRod.position.y=.35; fanGroup.add(fanRod);
  for(let i=0;i<4;i++){
    const blade=new THREE.Mesh(BOXG,mat(0xd8d0c0));
    blade.scale.set(1.7,.04,.26);
    blade.position.set(Math.cos(i*Math.PI/2)*.95,-.04,Math.sin(i*Math.PI/2)*.95);
    blade.rotation.y=i*Math.PI/2; fanGroup.add(blade);
  }
  world.add(fanGroup);

  /* split AC unit (living room) */
  box(1.1,.32,.22,10.6,2.9,8,white);
  box(.9,.06,.24,10.6,2.72,8,dark);

  /* ===== DINING (z -3 → 4, right) ===== */
  box(3.8,.1,1.5,5,1.0,0.5,wood,{solid:true});
  box(3.6,.08,1.3,5,1.05,0.5,mat(0x8a6a4a));
  [[-1.6,-.55],[1.6,-.55],[-1.6,.55],[1.6,.55]].forEach(p=>
    box(.12,1.0,.12,5+p[0],.5,0.5+p[1],metal));
  function chair(x,z,ry){
    ry=ry||0; const c=Math.cos(ry),s=Math.sin(ry);
    const bx=x-.22*s, bz=z-.22*c; /* backrest offset rotated with the chair */
    box(.5,.05,.5,x,.5,z,mat(0x3a2010),{ry,solid:true});
    box(.5,.5,.06,bx,.72,bz,mat(0x3a2010),{ry});
    [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]].forEach(p=>
      box(.04,.45,.04,x+p[0]*c+p[1]*s,.25,z-p[0]*s+p[1]*c,metal));
    seats.push({ type:"sit", label:"SIT", x, z, yaw:ry, h:0.55, level:0, taken:false });
  }
  for(let i=0;i<3;i++){ chair(4.0+i*1.0,-.6,0); chair(4.0+i*1.0,1.6,Math.PI); }
  /* chandelier */
  cyl(.02,1.0,5,H-.5,0.5,metal);
  cyl(.45,.18,5,H-1.05,0.5,mat(0xc8a850));
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2;
    cyl(.04,.12,5+Math.cos(a)*.36,H-1.14,0.5+Math.sin(a)*.36,glow(0xfff4d0));
  }
  /* sideboard with family photos */
  box(3.2,.85,.45,9.6,1.05,-1.5,wood,{solid:true});
  box(3.1,.06,.4,9.6,1.48,-1.5,cream);
  [[9.0,1.75,-1.5,0.5,0.4,0x3a6a8a],[9.7,1.78,-1.5,0.4,0.5,0x8a3a3a],[10.2,1.72,-1.5,0.45,0.35,0x3a7a5a]].forEach(p=>{
    box(p[3]+.06,p[4]+.06,.04,p[0],p[1],p[2],mat(0x2a1a0a));
    box(p[3],p[4],.02,p[0],p[1],p[2]+.03,mat(p[5]));
  });
  /* NEPA bill slip */
  box(.3,.02,.22,8.8,1.53,-1.4,white);

  /* ===== KITCHEN (z -13 → -3, left) ===== */
  /* back counter */
  box(9.5,.9,.7,-5.5,.45,-12.4,wood,{solid:true});
  box(9.7,.08,.8,-5.5,.94,-12.4,marbleM);
  box(9.5,.8,.55,-5.5,.4,-12.7,darkWood);
  /* upper cabinets */
  box(9.5,.8,.4,-5.5,2.5,-12.6,cream);
  box(9.5,.02,.4,-5.5,2.1,-12.6,dark);
  /* sink */
  box(1.0,.08,.45,-7.5,.98,-12.4,metal);
  cyl(.05,.35,-7.5,1.15,-12.2,metal);
  cyl(.03,.2,-7.6,1.28,-12.2,metal,{rz:Math.PI/2});
  /* gas cooker with pots */
  box(1.3,.06,.7,-3.2,.98,-12.4,dark);
  for(let i=0;i<4;i++)
    cyl(.14,.02,-3.6+(i%2)*.8,1.02,-12.6+Math.floor(i/2)*.3,glow(0x3a3a3a));
  cyl(.22,.25,-3.6,1.15,-12.6,mat(0x9a9a94));
  cyl(.18,.2,-2.8,1.12,-12.6,mat(0x8a8a84));
  /* hood */
  box(1.3,.3,.7,-3.2,2.2,-12.5,metal);
  /* blender */
  cyl(.12,.3,-5.5,1.1,-12.4,white);
  cyl(.08,.2,-5.5,1.35,-12.4,glassM);
  /* fridge */
  box(1.1,2.0,.75,-10.0,1.0,-12.3,metal,{solid:true});
  box(1.1,.02,.75,-10.0,1.3,-12.3,dark);
  box(.02,.9,.65,-10.0,1.0,-12.3,dark);
  /* fridge magnets */
  box(.12,.12,.03,-10.2,1.5,-11.9,mat(0xd83a3a));
  box(.1,.1,.03,-9.8,1.7,-11.9,mat(0x3a7ac8));
  /* water dispenser */
  box(.55,1.1,.5,-10.0,.55,-6.5,white,{solid:true});
  cyl(.2,.55,-10.0,1.4,-6.5,glassM);
  /* island */
  box(4.5,.9,1.7,-5.5,.45,-7,wood,{solid:true});
  box(4.7,.1,1.9,-5.5,.95,-7,marbleM);
  box(.1,.9,1.7,-7.85,.45,-7,marbleM);
  box(.1,.9,1.7,-3.15,.45,-7,marbleM);
  /* island stools */
  for(let i=0;i<3;i++){
    const sx=-6.6+i*1.2;
    cyl(.2,.06,sx,.7,-5.7,mat(0x3a2010));
    cyl(.03,.65,sx,.35,-5.7,metal);
    cyl(.18,.04,sx,.04,-5.7,metal);
    seats.push({ type:"sit", label:"SIT AT ISLAND", x:sx, z:-5.7, yaw:0, h:0.72, level:0, taken:false });
  }
  /* fruit basket on island */
  cyl(.28,.1,-6.5,1.02,-7.2,mat(0x8a6a3a));
  sph(.09,-6.55,1.1,-7.15,mat(0xe8b020));
  sph(.09,-6.4,1.08,-7.25,mat(0xd83a3a));
  sph(.09,-6.6,1.08,-7.3,mat(0x3a9a3a));

  uses.push({ kind:"cook", label:"COOK", x:-3.2, z:-11.7, y:0, level:0, r:1.8 });
  uses.push({ kind:"sink", label:"WASH", x:-7.5, z:-11.7, y:0, level:0, r:1.5 });
  uses.push({ kind:"fridge", label:"OPEN FRIDGE", x:-10, z:-11.5, y:0, level:0, r:1.5 });

  /* ===== BEDROOM (z -13 → -3, right) ===== */
  /* bed */
  const BX=3.5, BZ=-11;
  box(2.2,.35,2.4,BX,.18,BZ,wood,{solid:true});
  box(2.1,.25,2.3,BX,.48,BZ,white);
  box(1.9,.15,2.1,BX,.68,BZ,mat(0x8a9aaa));
  /* pillows */
  box(.7,.16,.4,BX-.5,.8,BZ-1.0,white);
  box(.7,.16,.4,BX+.5,.8,BZ-1.0,white);
  /* headboard */
  box(2.3,1.1,.12,BX,.95,BZ-1.3,wood);
  /* nightstands */
  box(.55,.55,.5,BX-1.55,.28,BZ-1.0,wood,{solid:true});
  cyl(.12,.24,BX-1.55,.78,BZ-1.0,mat(0xc8a850));
  cyl(.1,.28,BX-1.55,.92,BZ-1.0,glow(0xfff4d0));
  box(.55,.55,.5,BX+1.55,.28,BZ-1.0,wood,{solid:true});
  /* Ankara pillow on bed */
  box(.55,.5,.16,BX-.6,.85,BZ+.4,mat(0xe87a20));
  box(.55,.5,.16,BX+.6,.85,BZ+.4,mat(0x2a8a5a));
  seats.push({ type:"lie", label:"SLEEP", x:BX, z:BZ, yaw:0, h:0.74, level:0, taken:false });

  /* mosquito net */
  [[-1.25,-1.4],[1.25,-1.4],[-1.25,1.4],[1.25,1.4]].forEach(p=>
    cyl(.03,2.05,BX+p[0],1.02,BZ+p[1],metal));
  box(2.6,.04,2.9,BX,2.05,BZ,netM);
  box(.04,1.7,2.9,BX-1.28,1.15,BZ,netM);
  box(.04,1.7,2.9,BX+1.28,1.15,BZ,netM);
  box(2.6,1.7,.04,BX,1.15,BZ+1.43,netM);

  /* wardrobe against right wall */
  box(.75,2.4,3.2,10.4,1.2,-5.5,cream,{solid:true});
  box(.05,2.2,3.1,10.4,1.2,-5.5,darkWood);
  box(.04,2.2,.03,10.02,1.2,-4.2,metal);
  box(.04,2.2,.03,10.02,1.2,-6.8,metal);
  uses.push({ kind:"wardrobe", label:"USE WARDROBE", x:9.6, z:-5.5, y:0, level:0, r:1.6 });

  /* dresser */
  box(.7,.9,1.8,10.4,.45,-8.5,wood,{solid:true});
  box(.65,.7,1.7,10.45,.45,-8.5,cream);
  for(let i=0;i<3;i++) box(.6,.02,1.6,10.45,.2+i*.24,-8.5,darkWood);
  box(.05,1.4,1.0,10.75,1.7,-8.5,mat(0xd8e8f0));

  /* standing fan */
  cyl(.28,.04,7.5,.04,-6,metal);
  cyl(.04,.9,7.5,.5,-6,metal);
  cyl(.38,.05,7.5,1.0,-6,metal);
  box(.7,.05,.18,7.5,1.0,-6,mat(0xd8d0c0),{ry:0.4});
  box(.7,.05,.18,7.5,1.0,-6,mat(0xd8d0c0),{ry:0.4+Math.PI/2});

  /* split AC in bedroom */
  box(1.1,.32,.22,10.6,2.9,-8,white);
  box(.9,.06,.24,10.6,2.72,-8,dark);

  /* ===== BATHROOM (corner) ===== */
  cyl(.35,.45,9,.22,-12.2,white,{solid:true});
  box(.7,.45,.5,9,.55,-12.5,white);
  seats.push({ type:"toilet", label:"USE TOILET", x:9, z:-12.2, yaw:0, h:0.55, level:0, taken:false });
  box(1.2,.15,.55,10.2,.9,-11,white,{solid:true});
  box(1.1,.5,.45,10.2,.65,-11,cream);
  cyl(.1,.12,10.2,1.02,-11,metal);
  box(1.0,1.2,.04,10.2,1.6,-10.7,mat(0xd8e8f0));
  uses.push({ kind:"sink", label:"WASH", x:10.2, z:-11, y:0, level:0, r:1.5 });
  /* shower screen */
  box(.04,2.0,1.6,8.3,1.0,-11.2,glassM);
  box(1.6,2.0,.04,9.1,1.0,-12.0,glassM);
  uses.push({ kind:"shower", label:"TAKE SHOWER", x:9, z:-11.5, y:0, level:0, r:1.6 });

  /* ===== DECOR ===== */
  /* Nigerian flag on living room wall */
  box(.06,.85,.55,10.85,2.3,8,mat(0x008751));
  box(.06,.85,.18,10.85,2.3,8,white);
  box(.06,.85,.55,10.85,2.3,8,mat(0x008751));
  /* actually build flag properly as 3 vertical stripes */
  box(.05,.8,.5,10.82,2.3,8.2,mat(0x008751));
  box(.05,.8,.2,10.82,2.3,8.2,white);
  box(.05,.8,.5,10.82,2.3,7.7,mat(0x008751));

  /* wall art */
  box(1.6,1.2,.06,-6,2.2,-D/2+.15,blackM);
  box(1.4,1.0,.02,-6,2.2,-D/2+.18,mat(0x3a6a8a));
  box(1.4,1.6,.06,6,2.0,-D/2+.15,blackM);
  box(1.2,1.4,.02,6,2.0,-D/2+.18,mat(0x8a5a4a));

  /* wall clock */
  cyl(.26,.05,8,2.6,12.8,white,{rx:Math.PI/2});
  box(.03,.18,.04,8,2.66,12.75,dark);
  box(.14,.03,.04,8.06,2.6,12.75,dark);

  /* front window (double height) */
  box(6.0,4.0,.1,0,3.0,D/2-.12,glow(0xbfe0f5));
  box(6.2,.15,.2,0,5.05,D/2-.14,wood);
  box(.2,4.1,.2,-3.05,3.0,D/2-.14,wood);
  box(.2,4.1,.2,3.05,3.0,D/2-.14,wood);
  box(.15,4.0,.15,0,3.0,D/2-.18,wood);
  /* curtains */
  box(.5,3.6,.06,-3.0,2.8,D/2-.28,mat(0xc8b8a0));
  box(.5,3.6,.06,3.0,2.8,D/2-.28,mat(0xc8b8a0));

  /* front door */
  box(2.0,2.6,.12,0,1.3,D/2-.14,mat(0x2a1a0a),{solid:true});
  box(2.2,.15,.18,0,2.65,D/2-.14,wood);
  box(.08,.8,.08,.75,1.3,D/2-.22,metal);
  box(.2,2.7,.2,-1.1,1.35,D/2-.14,wood);
  box(.2,2.7,.2,1.1,1.35,D/2-.14,wood);

  /* foyer console */
  box(2.0,.08,.45,0,.9,11.5,wood,{solid:true});
  box(1.9,.7,.35,0,.45,11.5,mat(0x5a3a2a));
  box(.3,.4,.25,0,1.15,11.5,mat(0xc8a850));

  /* ceiling lights */
  for(let i=0;i<3;i++) for(let j=0;j<3;j++)
    box(1.2,.06,.7,-6+i*6,H-.06,-6+j*7,glow(0xfff8ee));
  /* kitchen extra light */
  box(1.0,.06,.6,-5.5,H-.06,-9,glow(0xfff8ee));
  /* bedroom light */
  box(1.2,.06,.7,5.5,H-.06,-8,glow(0xfff8ee));

  /* ===== OUTER COLLISION BOUNDS ===== */
  solid.push({x:0,z:-D/2+.1,hw:W/2,hd:.1});
  solid.push({x:0,z:D/2-.1,hw:W/2,hd:.1});
  solid.push({x:-W/2+.1,z:0,hw:.1,hd:D/2});
  solid.push({x:W/2-.1,z:0,hw:.1,hd:D/2});

  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const __cols = [];
  for (const b of solid) {
    const mk = (level) => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level });
    __cols.push(mk(0));
  }
  const __world = {
    colliders: __cols, seats, uses,
    stairs: [],
    platforms: [],
    levelHeight: () => 0,
    ceilingHeight: H,
    bounds: { minX: -ROOM.x, maxX: ROOM.x, minZ: -ROOM.z, maxZ: ROOM.z },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: 0, z: 10, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (use) => { if (window.__ph3d_phone) window.__ph3d_phone._toast(use.label || "USE"); },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "LAGOS LIFE APARTMENT",
    title: "FLAT · VICTORIA ISLAND",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "lagosflat",
    update: (dt) => {
      ctl.update(dt);
      fanGroup.rotation.y += dt * 2.2;
    },
    dispose: () => ctl.dispose(),
  };
}
