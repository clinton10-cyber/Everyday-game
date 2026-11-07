/* zoo/interior.js -- converted from the standalone prototype "zoo.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xa8ccdf);
  scene.fog=new THREE.Fog(0xa8ccdf,70,190);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,400);
  camera.rotation.order='YXZ';

  scene.add(new THREE.HemisphereLight(0xdff0ff,0x4a5a30,1.05));
  const sun=new THREE.DirectionalLight(0xfff0d0,1.2);
  sun.position.set(45,70,35); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xa8c8e8,.35);
  fill.position.set(-30,25,-30); scene.add(fill);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,10),
        SPHG=new THREE.SphereGeometry(.5,10,8),
        CONEG=new THREE.ConeGeometry(.5,1,10);
  const MC=new Map();
  function mat(c,o){
    if(o&&o.map) return new THREE.MeshLambertMaterial(Object.assign({color:c},o));
    const k=c+'|'+JSON.stringify(o||0); let m=MC.get(k);
    if(!m){m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));MC.set(k,m);}
    return m;
  }
  const glow=c=>new THREE.MeshBasicMaterial({color:c});
  const waterM=mat(0x3a8ab8,{transparent:true,opacity:.8});
  const glassM=mat(0xcfe4ee,{transparent:true,opacity:.22,side:THREE.DoubleSide});
  const world=new THREE.Group(); scene.add(world);
  const solid=[];
  const seats=[];
  const uses=[];
  const enclosures=[];

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
  function cone(r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CONEG,typeof m==='number'?mat(m):m);
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s); return s;
  }
  function tex(w,h,draw,rx,ry){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx||1,ry||1);
    t.colorSpace=THREE.SRGBColorSpace;
    return t;
  }

  /* --- group builders for animals --- */
  const P3=(m)=> (typeof m==='object') ? m : mat(m);
  function gb(g,w,h,d,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(BOXG,P3(m));
    s.scale.set(w,h,d); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    g.add(s); return s;
  }
  function gc(g,r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CYLG,P3(m));
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    g.add(s); return s;
  }
  function gs(g,r,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(SPHG,P3(m));
    s.scale.set(o.sx||r*2,o.sy||r*2,o.sz||r*2); s.position.set(x,y,z);
    g.add(s); return s;
  }
  function gcon(g,r,h,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(CONEG,P3(m));
    s.scale.set(r*2,h,r*2); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    g.add(s); return s;
  }
  function makeGroup(){ const g=new THREE.Group(); world.add(g); return g; }

  /* ================= ZOO ================= */
  const HALF=70;
  const ROOM={x:HALF-4, z:HALF-4};
  const START={x:0, z:57, yaw:0};
  const animals=[];

  /* --- textures --- */
  const grassTex=tex(128,128,g=>{
    g.fillStyle='#6a9a44'; g.fillRect(0,0,128,128);
    g.fillStyle='#5e8e38';
    for(let i=0;i<400;i++){g.fillRect(Math.random()*128,Math.random()*128,3,3);}
    g.fillStyle='#7aaa54';
    for(let i=0;i<220;i++){g.fillRect(Math.random()*128,Math.random()*128,2,2);}
  },22,22);
  const pathTex=tex(64,64,g=>{
    g.fillStyle='#c0b090'; g.fillRect(0,0,64,64);
    g.fillStyle='#b0a080';
    for(let i=0;i<60;i++){g.fillRect(Math.random()*64,Math.random()*64,3,3);}
    g.fillStyle='#d0c0a0';
    for(let i=0;i<40;i++){g.fillRect(Math.random()*64,Math.random()*64,2,2);}
  },8,8);
  const sandTex=tex(64,64,g=>{
    g.fillStyle='#d8c090'; g.fillRect(0,0,64,64);
    g.fillStyle='#c8b080';
    for(let i=0;i<60;i++){g.fillRect(Math.random()*64,Math.random()*64,3,3);}
  },4,4);

  const grassM=mat(0xffffff,{map:grassTex});
  const pathM=mat(0xffffff,{map:pathTex});
  const sandM=mat(0xffffff,{map:sandTex});
  const stoneM=mat(0xb0a898), stoneLight=mat(0xc8c0b0), stoneDark=mat(0x908878),
        woodM=mat(0x8a5f3a), woodDark=mat(0x5a3f26), metalM=mat(0x9aa0a8),
        darkM=mat(0x3a3028), leafM=mat(0x3a7a30), leafM2=mat(0x2e6424),
        leafM3=mat(0x4a8a3c), barkM=mat(0x6a4a32), wallM=mat(0xd8d0c0),
        roofM=mat(0x7a4a30), clothM=mat(0xc85a3a), clothM2=mat(0x3a6a9a),
        glassHouseM=mat(0xd0e4f0,{transparent:true,opacity:.3,side:THREE.DoubleSide});

  /* ===== GROUND ===== */
  box(2*HALF,.2,2*HALF,0,-.1,0,grassM);

  /* ===== PATHS ===== */
  box(8,.04,32,0,.02,41,pathM);          /* entrance to plaza */
  cyl(12,.05,0,.025,25,pathM);            /* plaza disc */
  box(6,.04,67,0,.02,-8.5,pathM);         /* main N-S */
  box(104,.04,6,0,.02,25,pathM);          /* cross A */
  box(104,.04,6,0,.02,-18,pathM);         /* cross B */

  /* ===== CENTRAL FOUNTAIN ===== */
  cyl(4.2,.6,0,.3,25,stoneM,{solid:true});
  cyl(4.0,.06,0,.62,25,stoneLight);
  cyl(3.7,.08,0,.5,25,waterM);
  cyl(1.0,1.2,0,1.2,25,stoneM);
  cyl(.7,.8,0,2.2,25,stoneLight);
  cyl(1.4,.2,0,2.7,25,stoneM);
  cyl(1.2,.04,0,2.8,25,waterM);
  sph(.7,0,3.2,25,mat(0xc8a850));
  cyl(.1,1.1,0,4.0,25,mat(0xc8a850));
  sph(.22,0,4.6,25,mat(0xc8a850));
  /* jets */
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2;
    cyl(.05,.7,Math.cos(a)*1.6,1.9,25+Math.sin(a)*1.6,glow(0xbfe0f0));
  }

  /* ===== ENTRANCE GATE ===== */
  box(2,6,2,-8,3,54,stoneM,{solid:true});
  box(2,6,2, 8,3,54,stoneM,{solid:true});
  box(2.4,.3,2.4,-8,6.15,54,stoneLight);
  box(2.4,.3,2.4, 8,6.15,54,stoneLight);
  box(18,.5,.6,0,6.2,54,stoneM);
  box(6,1.2,.3,0,5.1,54,mat(0x8a1e1e));
  box(5.4,.9,.15,0,5.1,54.2,glow(0xe8e0d0));
  [-3,3].forEach(x=>{
    cyl(.1,1.1,x,.55,54,metalM);
    box(.7,.1,.1,x,1.1,54,metalM);
  });
  /* ticket booth */
  box(3,2.6,3,-13,1.3,52,wallM,{solid:true});
  box(3.4,.3,3.4,-13,2.75,52,roofM);
  box(1.4,.9,.1,-13,1.7,53.6,glassHouseM);
  box(1.6,.15,.2,-13,1.15,53.6,woodM);

  /* ===== ENCLOSURE BUILDER ===== */
  function enclosure(cx,cz,r,seg,h){
    for(let i=0;i<seg;i++){
      const a0=i/seg*Math.PI*2, a1=(i+1)/seg*Math.PI*2;
      const x1=cx+Math.cos(a0)*r, z1=cz+Math.sin(a0)*r;
      const x2=cx+Math.cos(a1)*r, z2=cz+Math.sin(a1)*r;
      const mx=(x1+x2)/2, mz=(z1+z2)/2;
      const dx=x2-x1, dz=z2-z1;
      const len=Math.hypot(dx,dz);
      const ang=Math.atan2(dx,dz);
      box(.08,.08,len,mx,h*0.35,mz,metalM,{ry:ang});
      box(.08,.08,len,mx,h*0.78,mz,metalM,{ry:ang});
      if(i%2===0) box(.16,h,.16,x1,h/2,z1,woodDark);
    }
    enclosures.push({x:cx,z:cz,r:r});
  }

  /* ===== ENCLOSURES + ANIMALS ===== */

  /* --- ELEPHANT (-32, 5) --- */
  enclosure(-32,5,10,28,1.8);
  cyl(7,.08,-32,.03,5,sandM);
  function elephant(){
    const g=makeGroup();
    const E=0x7a7a78, ED=0x6a6a68, EL=0x8a8a88;
    [[-.9,-1.1],[.9,-1.1],[-.9,1.1],[.9,1.1]].forEach(p=>{
      gc(g,.32,1.4,p[0],.7,p[1],ED);
      gc(g,.36,.18,p[0],.09,p[1],0x5a5a58);
    });
    gb(g,2.6,2.0,3.4,0,1.9,0,E);
    gs(g,.9,0,3.0,-.2,E,{sx:2.4,sy:1.2,sz:2.8});
    gb(g,1.5,1.5,1.3,0,2.2,2.0,E);
    gb(g,.15,1.4,1.0,-.85,2.3,1.7,EL);
    gb(g,.15,1.4,1.0,.85,2.3,1.7,EL);
    gc(g,.22,1.6,0,1.4,2.8,E,{rx:.4});
    gc(g,.07,.6,-.4,1.5,2.7,0xe8e4d8,{rx:-.5});
    gc(g,.07,.6,.4,1.5,2.7,0xe8e4d8,{rx:-.5});
    gs(g,.08,-.45,2.6,2.6,0x1a1a1a);
    gs(g,.08,.45,2.6,2.6,0x1a1a1a);
    gc(g,.05,1.0,0,1.8,-1.7,ED,{rx:-.3});
    return g;
  }
  const ele1=elephant(); ele1.position.set(-32,0,5);
  animals.push({g:ele1,kind:'circle',cx:-32,cz:5,r:4,speed:.12,phase:0});
  const ele2=elephant(); ele2.position.set(-28,0,8); ele2.scale.setScalar(.8);
  animals.push({g:ele2,kind:'circle',cx:-32,cz:5,r:6,speed:.08,phase:2.1});

  /* --- GIRAFFE (32, 5) --- */
  enclosure(32,5,10,28,1.8);
  cyl(7,.08,32,.03,5,sandM);
  function giraffe(){
    const g=makeGroup();
    const Y=0xd8a848, P=0x8a5a2a;
    [[-.6,-1.0],[.6,-1.0],[-.6,1.0],[.6,1.0]].forEach(p=>{
      gc(g,.18,2.4,p[0],1.2,p[1],Y);
      gb(g,.3,.5,.3,p[0],1.4,p[1],P);
    });
    gb(g,1.4,1.4,2.4,0,2.8,0,Y);
    for(let i=0;i<5;i++) gb(g,.35,.35,.35,-.5+((i*7)%3)*.5,2.6+((i*3)%3)*.3,-.9+i*.45,P);
    gb(g,.7,2.6,.7,0,4.5,1.0,Y,{rx:-.15});
    for(let i=0;i<4;i++) gb(g,.3,.3,.35,0,3.8+i*.6,1.1+i*.08,P);
    gb(g,.55,.6,1.0,0,5.9,1.5,Y);
    gc(g,.04,.35,-.15,6.35,1.5,P);
    gc(g,.04,.35,.15,6.35,1.5,P);
    gs(g,.06,-.15,6.55,1.5,0x2a1a0a);
    gs(g,.06,.15,6.55,1.5,0x2a1a0a);
    gs(g,.06,-.22,5.95,1.95,0x1a1a1a);
    gs(g,.06,.22,5.95,1.95,0x1a1a1a);
    gc(g,.04,1.2,0,2.6,-1.3,Y,{rx:-.3});
    gs(g,.08,0,2.0,-1.6,P);
    return g;
  }
  const g1=giraffe(); g1.position.set(32,0,3);
  animals.push({g:g1,kind:'bob',baseY:0,baseRot:0.3,phase:0});
  const g2=giraffe(); g2.position.set(35,0,7); g2.scale.setScalar(.85);
  animals.push({g:g2,kind:'bob',baseY:0,baseRot:-1.2,phase:1.4});

  /* --- LION (-32, -30) --- */
  enclosure(-32,-30,9,26,1.6);
  cyl(6,.08,-32,.03,-30,sandM);
  function lion(){
    const g=makeGroup();
    const T=0xc8a060, M=0x6a3a1a;
    [[-.5,-.9],[.5,-.9],[-.5,.9],[.5,.9]].forEach(p=>{
      gc(g,.18,1.0,p[0],.5,p[1],T);
      gb(g,.32,.16,.38,p[0],.08,p[1],T);
    });
    gb(g,1.1,.95,2.0,0,1.1,0,T);
    gs(g,.55,0,1.1,.9,M);
    gs(g,.95,0,1.5,1.1,M);
    gb(g,.65,.65,.65,0,1.6,1.35,T);
    gs(g,.15,-.3,1.95,1.3,T);
    gs(g,.15,.3,1.95,1.3,T);
    gb(g,.4,.3,.2,0,1.45,1.7,0xe8d8b8);
    gs(g,.07,0,1.5,1.82,0x2a1a0a);
    gs(g,.07,-.2,1.72,1.66,0x1a1a0a);
    gs(g,.07,.2,1.72,1.66,0x1a1a0a);
    gc(g,.05,1.3,0,1.3,-1.1,T,{rx:-.4});
    gs(g,.13,0,.85,-1.55,M);
    return g;
  }
  const l1=lion(); l1.position.set(-32,0,-30);
  animals.push({g:l1,kind:'sway',baseRot:0.4,phase:0});
  const l2=lion(); l2.position.set(-29,0,-32); l2.scale.setScalar(.85);
  animals.push({g:l2,kind:'sway',baseRot:-1.6,phase:1.0});

  /* --- ZEBRA (32, -30) --- */
  enclosure(32,-30,9,26,1.6);
  cyl(6,.08,32,.03,-30,sandM);
  function zebra(){
    const g=makeGroup();
    const W=0xe8e4d8, B=0x1a1a1a;
    [[-.45,-.85],[.45,-.85],[-.45,.85],[.45,.85]].forEach(p=>{
      gc(g,.13,1.0,p[0],.5,p[1],W);
      gb(g,.26,.2,.26,p[0],.1,p[1],B);
    });
    gb(g,1.0,1.0,2.0,0,1.5,0,W);
    for(let i=0;i<5;i++) gb(g,1.02,.15,.2,0,1.5,-.75+i*.38,B);
    gb(g,.6,.9,.6,0,2.15,.9,W,{rx:-.5});
    for(let i=0;i<3;i++) gb(g,.62,.12,.2,0,1.95+i*.24,1.0+i*.1,B);
    gb(g,.45,.5,.9,0,2.6,1.5,W);
    gb(g,.46,.15,.7,0,2.55,1.55,B);
    gc(g,.05,.3,-.15,2.85,1.3,W,{rx:-.4});
    gc(g,.05,.3,.15,2.85,1.3,W,{rx:-.4});
    gs(g,.06,-.2,2.65,1.7,0x1a1a1a);
    gs(g,.06,.2,2.65,1.7,0x1a1a1a);
    for(let i=0;i<5;i++) gb(g,.1,.3,.2,0,2.9,.6+i*.2,B);
    gc(g,.04,.9,0,1.5,-1.1,W,{rx:-.3});
    gs(g,.1,0,1.0,-1.5,B);
    return g;
  }
  const z1=zebra(); z1.position.set(32,0,-30);
  animals.push({g:z1,kind:'circle',cx:32,cz:-30,r:3.5,speed:.18,phase:0});
  const z2=zebra(); z2.position.set(35,0,-32); z2.scale.setScalar(.9);
  animals.push({g:z2,kind:'circle',cx:32,cz:-30,r:2.5,speed:.22,phase:3.0});

  /* --- MONKEY ISLAND (-32, 40) --- */
  enclosure(-32,40,8,22,1.6);
  cyl(4.5,1.8,-32,.9,40,stoneM);
  cyl(3.2,1.2,-32,1.5,40,stoneLight);
  sph(.9,-32,2.4,40,stoneM);
  sph(1.4,-32,2.2,40,leafM);
  sph(1.2,-31.5,2.6,40.5,leafM2);
  function monkey(){
    const g=makeGroup();
    const B=0x6a4a32, T=0xc8a890;
    gs(g,.28,0,.65,0,B,{sx:.55,sy:.65,sz:.5});
    gs(g,.2,0,.62,.1,T,{sx:.4,sy:.5,sz:.3});
    gs(g,.22,0,1.05,0,B);
    gs(g,.16,0,1.03,.1,T);
    gs(g,.08,-.2,1.1,0,B);
    gs(g,.08,.2,1.1,0,B);
    gs(g,.03,-.06,1.08,.15,0x1a1a1a);
    gs(g,.03,.06,1.08,.15,0x1a1a1a);
    gc(g,.06,.45,-.22,.7,.05,B,{rz:.3});
    gc(g,.06,.45,.22,.7,.05,B,{rz:-.3});
    gc(g,.08,.35,-.12,.2,0,B);
    gc(g,.08,.35,.12,.2,0,B);
    gc(g,.04,.8,0,.75,-.25,B,{rx:-.7});
    return g;
  }
  [[-32,39,0],[-31,41,2.1],[-33,41.5,4.2],[-33.5,39,1.3],[-31.5,39.5,3.4]].forEach((p,i)=>{
    const m=monkey(); m.position.set(p[0],2.6,p[1]);
    animals.push({g:m,kind:'bob',baseY:2.6,baseRot:p[2],phase:i*1.2});
  });

  /* --- PENGUIN POOL (32, 40) --- */
  enclosure(32,40,8,22,1.6);
  cyl(5.5,.5,32,.25,40,stoneM);
  cyl(5.0,.12,32,.5,40,waterM);
  cyl(2.5,1.2,32,.6,41,stoneM);
  sph(1.6,32,1.4,41,stoneLight);
  function penguin(){
    const g=makeGroup();
    const B=0x2a2a2a, W=0xf0f0f0, O=0xe8a030;
    gs(g,.32,0,.55,0,B,{sx:.65,sy:1.1,sz:.65});
    gs(g,.24,0,.55,.16,W,{sx:.55,sy:.95,sz:.4});
    gs(g,.22,0,.95,0,B);
    gs(g,.04,-.08,1.0,.16,W);
    gs(g,.04,.08,1.0,.16,W);
    gs(g,.025,-.08,1.0,.18,0x1a1a1a);
    gs(g,.025,.08,1.0,.18,0x1a1a1a);
    gcon(g,.06,.18,0,.96,.22,O,{rx:1.57});
    gb(g,.08,.4,.12,-.32,.55,0,B,{rz:.15});
    gb(g,.08,.4,.12,.32,.55,0,B,{rz:-.15});
    gb(g,.2,.06,.25,-.13,.06,.12,O);
    gb(g,.2,.06,.25,.13,.06,.12,O);
    return g;
  }
  [[31,38.5,0],[33,38,1.2],[32,41,2.4],[33.5,40,3.6],[30.5,40.5,4.8]].forEach((p,i)=>{
    const pg=penguin(); pg.position.set(p[0],.6,p[1]); pg.rotation.y=p[2];
    animals.push({g:pg,kind:'bob',baseY:.6,baseRot:p[2],phase:i*.9});
  });

  /* --- FLAMINGO POND (-14, -45) --- */
  enclosure(-14,-45,8,22,1.4);
  cyl(6,.06,-14,.04,-45,waterM);
  cyl(6.5,.12,-14,.02,-45,sandM);
  function flamingo(){
    const g=makeGroup();
    const P=0xe88a9a, P2=0xd87a8a;
    gc(g,.04,.9,-.08,.45,0,P2);
    gc(g,.04,.9,.08,.45,0,P2);
    gs(g,.35,0,1.1,0,P,{sx:.5,sy:.55,sz:.8});
    gc(g,.06,.5,0,1.4,.15,P,{rx:.3});
    gc(g,.06,.4,0,1.7,.2,P,{rx:-.2});
    gs(g,.14,0,1.85,.22,P);
    gb(g,.1,.08,.25,0,1.82,.4,0xe8d8b8);
    gs(g,.04,0,1.83,.52,0x1a1a1a);
    gs(g,.03,-.08,1.9,.26,0x1a1a1a);
    gs(g,.03,.08,1.9,.26,0x1a1a1a);
    return g;
  }
  [[-16,-44,0],[-13,-43,1.5],[-15,-47,3.0],[-12,-46,4.5],[-17,-46,2.2],[-14,-42,.8]].forEach((p,i)=>{
    const f=flamingo(); f.position.set(p[0],0,p[1]); f.rotation.y=p[2];
    animals.push({g:f,kind:'bob',baseY:0,baseRot:p[2],phase:i*1.1});
  });

  /* --- AVIARY (14, -45) --- */
  enclosure(14,-45,8,22,2.0);
  /* cone net roof */
  const avRoof=new THREE.Mesh(new THREE.ConeGeometry(8,5,20,1,true),
    mat(0x8a9aa8,{transparent:true,opacity:.22,side:THREE.DoubleSide}));
  avRoof.position.set(14,7.5,-45); world.add(avRoof);
  /* perches */
  for(let i=0;i<4;i++){
    const a=i/4*Math.PI*2+.4;
    const px=14+Math.cos(a)*3, pz=-45+Math.sin(a)*3;
    cyl(.1,3.4,px,1.7,pz,woodM);
    box(2.4,.1,.1,px,2.9,pz,woodM);
  }
  function bird(x,y,z,c,ry){
    const g=makeGroup();
    g.position.set(x,y,z); g.rotation.y=ry;
    gs(g,.15,0,0,0,c,{sx:.3,sy:.3,sz:.4});
    gs(g,.1,0,.05,.15,c);
    gcon(g,.04,.12,0,.05,.28,0xe8a030,{rx:1.57});
    gb(g,.1,.02,.3,0,.02,-.3,c);
    gb(g,.04,.15,.25,-.16,.05,0,c,{rz:.2});
    gb(g,.04,.15,.25,.16,.05,0,c,{rz:-.2});
    return g;
  }
  const bColors=[0xd83a3a,0x3a8ad8,0xe8b020,0x3a9a5a,0xd84a9a,0xe8e8e8];
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const r=3+Math.random()*1.5;
    bird(14+Math.cos(a)*r,3.0,-45+Math.sin(a)*r,bColors[i%6],a+Math.PI/2);
  }

  /* ===== REPTILE HOUSE (enterable) (-48, 40) ===== */
  function reptileHouse(cx,cz,w,d,h){
    box(w,.1,d,cx,.05,cz,mat(0x9aa0a8));
    box(w,h,.3,cx,h/2,cz-d/2,wallM,{solid:true});
    box(w/2-.8,h,.3,cx-(w/2+.8)/2,h/2,cz+d/2,wallM,{solid:true});
    box(w/2-.8,h,.3,cx+(w/2+.8)/2,h/2,cz+d/2,wallM,{solid:true});
    box(1.6,.8,.3,cx,h-.4,cz+d/2,wallM);
    box(.3,h,d,cx-w/2,h/2,cz,wallM,{solid:true});
    box(.3,h,d,cx+w/2,h/2,cz,wallM,{solid:true});
    box(w+.5,.35,d+.5,cx,h+.15,cz,roofM);
    box(w+.8,.15,d+.8,cx,h+.4,cz,stoneDark);
  }
  reptileHouse(-48,40,10,10,3.2);
  /* interior: glass terrariums with snakes */
  box(3,1.2,1.6,-49.5,1.2,37.5,glassHouseM,{solid:true});
  box(3.1,.15,1.7,-49.5,.6,37.5,stoneM);
  /* snake coil */
  function snake(x,y,z,s){
    cyl(.18*s,.5*s,x,y,z,mat(0x6a8a3a),{rx:0});
    cyl(.16*s,.5*s,x+.35*s,y+.15,z+.1,mat(0x5a7a2a));
    cyl(.13*s,.5*s,x-.3*s,y+.28,z-.1,mat(0x6a8a3a));
    cyl(.1*s,.5*s,x+.1*s,y+.42,z+.2,mat(0x7a9a4a));
    sph(.13*s,x+.1*s,y+.5,z+.2,mat(0x7a9a4a));
    sph(.03*s,x+.18*s,y+.56,z+.3,0x1a1a1a);
    sph(.03*s,x+.02*s,y+.56,z+.3,0x1a1a1a);
  }
  snake(-49.5,1.5,37.5,1.0);
  /* tortoise */
  box(1.4,.15,1.8,-46,1.15,42,stoneM,{solid:true});
  sph(.9,-46,1.35,42,mat(0x7a6a3a),{sx:1.5,sy:.7,sz:1.7});
  sph(.4,-46,1.3,43.0,mat(0x8a7a4a));
  sph(.05,-46.15,1.4,43.3,0x1a1a1a);
  sph(.05,-45.85,1.4,43.3,0x1a1a1a);
  /* wall displays */
  box(2.4,1.4,.08,-48.5,2.2,34.9,mat(0x3a3028));
  box(2.2,1.2,.03,-48.5,2.2,34.94,glow(0xd8d0c0));
  box(1.6,1.0,.08,-46,2.0,34.9,mat(0x3a3028));
  box(1.4,.8,.03,-46,2.0,34.94,glow(0xd8d0c0));
  /* sign over door */
  box(2.2,.6,.06,-48,3.0,45.1,mat(0x2e5a30));
  box(1.9,.4,.02,-48,3.0,45.14,glow(0xe8e0d0));

  /* ===== CAFÉ (48, 40) ===== */
  box(13,.12,11,48,.06,40,stoneLight);
  [[-5,-4],[5,-4],[-5,4],[5,4]].forEach(p=>{
    box(.3,3.2,.3,48+p[0],1.6,40+p[1],woodM,{solid:true});
  });
  box(12,.18,10,48,3.2,40,clothM);
  box(12.2,.2,10.2,48,3.35,40,mat(0xa84a2a));
  /* counter */
  box(7,1.0,1.2,48,.5,44.5,woodM,{solid:true});
  box(7.2,.12,1.35,48,1.04,44.5,stoneM);
  box(7,.8,.2,48,.5,44.0,woodDark);
  uses.push({ kind: "cook", label: "ORDER AT COUNTER", x: 48, z: 44.5, y: 0, level: 0, r: 1.8 });
  /* coffee machine */
  box(1.2,.8,.7,46,1.4,44.5,darkM);
  box(.8,.5,.05,46,1.5,44.15,glow(0x4a9a3a));
  /* display case */
  box(2.5,.8,.8,50,1.0,44.5,glassHouseM);
  /* tables + stools */
  for(const p of [[-3,-2],[0,-2],[3,-2],[-3,2],[3,2]]){
    const tx=48+p[0], tz=40+p[1];
    cyl(.55,.06,tx,.78,tz,woodM);
    cyl(.07,.75,tx,.38,tz,darkM);
    [[-.9,0],[.9,0],[0,-.9],[0,.9]].forEach(o=>{
      cyl(.22,.06,tx+o[0],.48,tz+o[1],woodM);
      cyl(.04,.45,tx+o[0],.24,tz+o[1],darkM);
    });
    /* tray */
    box(.5,.03,.36,tx,.82,tz,mat(0xc84a2a));
    seats.push({ type: "sit", label: "SIT", x: tx, z: tz, yaw: 0, h: 0.48, level: 0, taken: false });
  }

  /* ===== SIGNS near enclosures ===== */
  function sign(x,z,ry,color){
    cyl(.07,1.4,x,.7,z,woodDark);
    box(1.3,.7,.06,x,1.55,z,color,{ry});
    box(1.1,.12,.02,x,1.68,z,0xf0f0e8,{ry});
    box(.8,.06,.02,x,1.5,z,0xf0f0e8,{ry});
    box(.6,.06,.02,x,1.4,z,0xf0f0e8,{ry});
    uses.push({ kind: "read", label: "READ ANIMAL SIGN", x, z, y: 0, level: 0, r: 1.3 });
  }
  sign(-19,5,Math.PI/2,0x4a7a3a);      /* elephant */
  sign(19,5,-Math.PI/2,0xc89a2a);      /* giraffe */
  sign(-19,-30,Math.PI/2,0xa8742a);    /* lion */
  sign(19,-30,-Math.PI/2,0x4a4a4a);    /* zebra */
  sign(-22,40,Math.PI/2,0x8a5a2a);     /* monkey */
  sign(22,40,-Math.PI/2,0x2a5a7a);     /* penguin */
  sign(-6,-42,0,0xc86a8a);             /* flamingo */
  sign(6,-42,0,0x3a7a5a);              /* aviary */

  /* ===== BENCHES ===== */
  function bench(x,z,ry){
    ry=ry||0;
    const c=Math.cos(ry), s=Math.sin(ry);
    const put=(w,h,d,ox,oy,oz,m,sol)=>box(w,h,d,x+ox*c+oz*s,oy,z-ox*s+oz*c,m,{ry,solid:sol!==false});
    put(1.8,.1,.5,0,.48,0,woodM);
    put(1.8,.5,.08,0,.82,-.21,woodM);
    put(.1,.4,.5,-.9,.62,0,woodDark);
    put(.1,.4,.5,.9,.62,0,woodDark);
    put(.1,.48,.1,-.8,.24,0,metalM);
    put(.1,.48,.1,.8,.24,0,metalM);
    seats.push({ type: "sit", label: "SIT", x, z, yaw: ry, h: 0.48, level: 0, taken: false });
  }
  bench(-8,45,Math.PI);
  bench(8,45,Math.PI);
  bench(-8,12,0);
  bench(8,12,0);
  bench(-8,-8,0);
  bench(8,-8,0);
  bench(-8,-30,0);
  bench(8,-30,0);
  bench(-20,25,Math.PI/2);
  bench(20,25,Math.PI/2);
  bench(-20,-18,Math.PI/2);
  bench(20,-18,Math.PI/2);

  /* ===== LAMP POSTS ===== */
  function lamp(x,z){
    cyl(.08,3.4,x,1.7,z,darkM,{solid:true});
    box(.32,.12,.32,x,3.5,z,darkM);
    cyl(.24,.45,x,3.75,z,glow(0xfff0c0));
    sph(.2,x,3.75,z,glow(0xfff4d0));
  }
  lamp(-5,45); lamp(5,45);
  lamp(-5,30); lamp(5,30);
  lamp(-5,15); lamp(5,15);
  lamp(-5,0); lamp(5,0);
  lamp(-5,-20); lamp(5,-20);
  lamp(-5,-40); lamp(5,-40);
  lamp(-14,22); lamp(14,22);
  lamp(-26,28); lamp(26,28);
  lamp(-14,-15); lamp(14,-15);
  lamp(-26,-21); lamp(26,-21);

  /* ===== TRASH BINS ===== */
  function bin(x,z){
    cyl(.26,.7,x,.35,z,mat(0x3a5a3a),{solid:true});
    cyl(.28,.08,x,.72,z,darkM);
  }
  bin(-6,42); bin(6,42); bin(-6,-10); bin(6,-10);
  bin(-16,25); bin(16,25); bin(-16,-18); bin(16,-18);

  /* ===== TREES ===== */
  function tree(x,z,s){
    s=s||1;
    const th=2.6*s;
    cyl(.22*s,th,x,th/2,z,barkM,{solid:true});
    cone(1.9*s,2.1*s,x,th+.9*s,z,leafM);
    cone(1.5*s,1.9*s,x,th+2.0*s,z,leafM2);
    cone(1.0*s,1.7*s,x,th+2.9*s,z,leafM3);
  }
  function clearOf(x,z){
    if(Math.abs(x)<5 && z>12 && z<58) return false;
    if(Math.abs(x)<4 && z>-42 && z<13) return false;
    if(Math.abs(z-25)<4.5) return false;
    if(Math.abs(z+18)<4.5) return false;
    if(Math.hypot(x,z-25)<14) return false;
    for(const e of enclosures) if(Math.hypot(x-e.x,z-e.z)<e.r+2.5) return false;
    if(Math.abs(x+48)<7 && Math.abs(z-40)<7) return false;
    if(Math.abs(x-48)<8 && Math.abs(z-40)<7) return false;
    if(Math.abs(x)<11 && z>51) return false;
    if(Math.hypot(x,z-25)<6) return false;
    return true;
  }
  let placed=0;
  for(let attempt=0; attempt<300 && placed<22; attempt++){
    const x=(Math.random()*2-1)*(HALF-6);
    const z=(Math.random()*2-1)*(HALF-6);
    if(!clearOf(x,z)) continue;
    tree(x,z,.85+Math.random()*.5);
    placed++;
  }
  /* trees inside enclosures (decorative) */
  tree(-36,2,1.1);
  tree(-27,8,1.0);
  tree(36,2,1.1);
  tree(28,-26,1.0);
  tree(-36,-27,1.0);

  /* ===== BUSHES ===== */
  function bush(x,z,s){
    s=s||1;
    sph(.6*s,x,.38*s,z,leafM2);
    sph(.45*s,x+.45*s,.3*s,z+.2*s,leafM3);
  }
  for(let i=0;i<16;i++){
    const x=(Math.random()*2-1)*(HALF-6);
    const z=(Math.random()*2-1)*(HALF-6);
    if(!clearOf(x,z)) continue;
    bush(x,z,.7+Math.random()*.5);
  }

  /* ===== DISTANT HILLS ===== */
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2+.3;
    const r=HALF+40+Math.random()*14;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    cone(22+Math.random()*10, 28+Math.random()*14, x, 0, z, mat(0x7a8a6a));
  }
  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  let __T = 0;
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
    crumb: "CITY ZOO",
    title: "WILDLIFE PARK",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "zoo",
    update: (dt) => {
      ctl.update(dt);
      __T += dt;
      for (let i = 0; i < animals.length; i++) {
        const a = animals[i];
        if (a.kind === 'circle') {
          const ang = __T * a.speed + a.phase;
          a.g.position.x = a.cx + Math.cos(ang) * a.r;
          a.g.position.z = a.cz + Math.sin(ang) * a.r;
          a.g.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
        } else if (a.kind === 'bob') {
          a.g.position.y = a.baseY + Math.sin(__T * 2 + a.phase) * .06;
          a.g.rotation.y = a.baseRot + Math.sin(__T * .8 + a.phase) * .15;
        } else if (a.kind === 'sway') {
          a.g.rotation.y = a.baseRot + Math.sin(__T * 1.2 + a.phase) * .12;
        }
      }
    },
    dispose: () => ctl.dispose(),
  };
}

