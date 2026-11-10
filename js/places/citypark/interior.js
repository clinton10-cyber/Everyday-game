/* citypark/interior.js -- converted from the standalone prototype "park.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x9ec4e0);
  scene.fog=new THREE.Fog(0x9ec4e0,60,180);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,350);
  camera.rotation.order='YXZ';

  scene.add(new THREE.HemisphereLight(0xd8eaff,0x3a4a30,1.0));
  const sun=new THREE.DirectionalLight(0xfff4d6,1.2);
  sun.position.set(35,60,25); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xa8c8e8,.4);
  fill.position.set(-25,20,-25); scene.add(fill);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,10),
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
  const waterM=mat(0x3a86b8,{transparent:true,opacity:.78});
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

  /* ================= PARK ================= */
  const HALF=48;
  const ROOM={x:HALF-4, z:HALF-4};
  const START={x:0, z:6, yaw:0};

  /* --- textures --- */
  const grassTex=tex(128,128,g=>{
    g.fillStyle='#5a8a3a'; g.fillRect(0,0,128,128);
    g.fillStyle='#4e7e30';
    for(let i=0;i<420;i++){g.fillRect(Math.random()*128,Math.random()*128,3,3);}
    g.fillStyle='#6a9a44';
    for(let i=0;i<260;i++){g.fillRect(Math.random()*128,Math.random()*128,2,2);}
    g.strokeStyle='#3e6a24'; g.lineWidth=1;
    for(let i=0;i<40;i++){
      g.beginPath(); g.moveTo(Math.random()*128,Math.random()*128);
      g.lineTo(Math.random()*128,Math.random()*128); g.stroke();
    }
  },24,24);

  const pathTex=tex(64,64,g=>{
    g.fillStyle='#b8a888'; g.fillRect(0,0,64,64);
    g.fillStyle='#a89878';
    for(let i=0;i<50;i++){g.fillRect(Math.random()*64,Math.random()*64,3,3);}
    g.fillStyle='#c8b898';
    for(let i=0;i<40;i++){g.fillRect(Math.random()*64,Math.random()*64,2,2);}
    g.strokeStyle='#8a7a5a'; g.lineWidth=1;
    g.strokeRect(1,1,62,62);
  },6,6);

  const plazaTex=tex(64,64,g=>{
    g.fillStyle='#c8bcac'; g.fillRect(0,0,64,64);
    g.strokeStyle='#a89a8a'; g.lineWidth=2;
    g.strokeRect(0,0,32,32); g.strokeRect(32,32,32,32);
    g.fillStyle='#b8ac9c';
    for(let i=0;i<40;i++){g.fillRect(Math.random()*64,Math.random()*64,2,2);}
  },8,8);

  const grassM=mat(0xffffff,{map:grassTex});
  const pathM=mat(0xffffff,{map:pathTex});
  const plazaM=mat(0xffffff,{map:plazaTex});
  const stoneM=mat(0x9a9488), stoneLight=mat(0xb8b0a0),
        woodM=mat(0x8a5f3a), woodDark=mat(0x5a3f26),
        steel=mat(0x8a8e94), dark=mat(0x2a2c30),
        white=mat(0xf0f0ec), brickM=mat(0xa85a3a),
        sandM=mat(0xd8c090), leafM=mat(0x3a6a28),
        leafM2=mat(0x2e5a20), leafM3=mat(0x4a7a30),
        barkM=mat(0x5a4030), waterM2=waterM;

  /* ===== GROUND ===== */
  box(2*HALF,.2,2*HALF,0,-.1,0,grassM);

  /* ===== PLAZA (center) ===== */
  box(18,.04,18,0,.02,0,plazaM);
  /* plaza border ring (thicker stone) */
  box(18.6,.08,.4,0,.04,-9.1,stoneM,{solid:true});
  box(18.6,.08,.4,0,.04, 9.1,stoneM,{solid:true});
  box(.4,.08,18.6,-9.1,.04,0,stoneM,{solid:true});
  box(.4,.08,18.6, 9.1,.04,0,stoneM,{solid:true});

  /* ===== PATHS (4 radial) ===== */
  box(4,.03,36,0,.015,-27,pathM);
  box(4,.03,36,0,.015, 27,pathM);
  box(36,.03,4,-27,.015,0,pathM);
  box(36,.03,4, 27,.015,0,pathM);
  /* path borders */
  [-2.2,2.2].forEach(off=>{
    box(.15,.05,36,off,.03,-27,stoneLight);
    box(.15,.05,36,off,.03, 27,stoneLight);
    box(36,.05,.15,-27,.03,off,stoneLight);
    box(36,.05,.15, 27,.03,off,stoneLight);
  });

  /* ===== CENTRAL FOUNTAIN ===== */
  const FFR=3.6;
  /* stone rim */
  cyl(FFR+.35,.55,0,.275,0,stoneM,{solid:true});
  cyl(FFR+.2,.06,0,.56,0,stoneLight);
  /* water */
  cyl(FFR,.02,0,.32,0,waterM2);
  /* inner basin rim */
  cyl(FFR-.15,.4,0,.2,0,stoneM);
  /* central pillar */
  cyl(.5,.8,0,.8,0,stoneM);
  cyl(.4,1.2,0,1.6,0,stoneLight);
  /* top bowl */
  cyl(1.1,.18,0,2.2,0,stoneM);
  cyl(1.0,.02,0,2.29,0,waterM2);
  /* upper tier */
  cyl(.3,.5,0,2.5,0,stoneLight);
  cyl(.6,.14,0,2.82,0,stoneM);
  cyl(.55,.02,0,2.89,0,waterM2);
  sph(.18,0,3.0,0,stoneLight);
  /* water jets */
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2;
    const jx=Math.cos(a)*.9, jz=Math.sin(a)*.9;
    cyl(.05,.9,jx,2.55,jz,glow(0xbfe0f0),{});
  }

  /* ===== GAZEBO (north, at 0,-30) ===== */
  const GZ={x:0,z:-30,r:3.4};
  seats.push({ type: "sit", label: "SIT IN GAZEBO", x: GZ.x, z: GZ.z, yaw: 0, h: 0.2, level: 0, taken: false });
  /* raised base */
  cyl(GZ.r+.6,.18,GZ.x,.09,GZ.z,stoneM);
  cyl(GZ.r+.35,.14,GZ.x,.16,GZ.z,stoneLight);
  /* 8 posts around, missing the south one (entrance) */
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    /* skip the one facing the path (south = +z direction, angle PI/2) */
    if(Math.abs(a-Math.PI/2)<.01) continue;
    const px=GZ.x+Math.cos(a)*GZ.r, pz=GZ.z+Math.sin(a)*GZ.r;
    box(.28,3.0,.28,px,1.68,pz,woodM,{solid:true});
    /* beam brackets */
    box(.5,.12,.5,px,3.1,pz,woodDark);
  }
  /* top ring beam */
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const a2=(i+1)/8*Math.PI*2;
    const x1=GZ.x+Math.cos(a)*GZ.r, z1=GZ.z+Math.sin(a)*GZ.r;
    const x2=GZ.x+Math.cos(a2)*GZ.r, z2=GZ.z+Math.sin(a2)*GZ.r;
    const mx=(x1+x2)/2, mz=(z1+z2)/2;
    const dx=x2-x1, dz=z2-z1;
    const len=Math.hypot(dx,dz);
    const ang=Math.atan2(dx,dz);
    box(.16,.22,len,mx,3.28,mz,woodDark,{ry:ang});
  }
  /* roof (8-sided pyramid) */
  const roofGeo=new THREE.ConeGeometry(GZ.r+0.9, 1.8, 8);
  const roof=new THREE.Mesh(roofGeo, mat(0x6a3a2a));
  roof.position.set(GZ.x, 4.2, GZ.z);
  roof.rotation.y = Math.PI/8;
  world.add(roof);
  /* roof finial */
  sph(.2,GZ.x,5.25,GZ.z,mat(0xc8a850));
  cyl(.05,.35,GZ.x,5.05,GZ.z,mat(0xc8a850));
  /* inner bench ring (4 sections) */
  for(let i=0;i<4;i++){
    const a=i/4*Math.PI*2 + Math.PI/4;
    if(Math.abs(((a% (Math.PI*2))+Math.PI*2)%(Math.PI*2) - Math.PI/2)<.5) continue;
    const bx=GZ.x+Math.cos(a)*(GZ.r-0.55);
    const bz=GZ.z+Math.sin(a)*(GZ.r-0.55);
    box(1.5,.08,.35,bx,.6,bz,woodM,{ry:a+Math.PI/2,solid:true});
    box(1.5,.5,.08,bx,.86,bz+Math.sin(a+Math.PI/2)*.14,woodM,{ry:a+Math.PI/2});
  }
  /* central garden table */
  cyl(.5,.08,GZ.x,.72,GZ.z,woodM);
  cyl(.08,.65,GZ.x,.4,GZ.z,woodDark);

  /* ===== PLAYGROUND (east, at 30,0) ===== */
  const PG={x:30,z:0};
  /* sandbox */
  box(8,.05,7,PG.x,.02,PG.z,sandM);
  box(8.2,.35,.25,PG.x,.17,PG.z-3.6,woodM,{solid:true});
  box(8.2,.35,.25,PG.x,.17,PG.z+3.6,woodM,{solid:true});
  box(.25,.35,7.2,PG.x-4.1,.17,PG.z,woodM,{solid:true});
  box(.25,.35,7.2,PG.x+4.1,.17,PG.z,woodM,{solid:true});

  /* swing set (north side of playground) */
  function swingSet(x,z){
    /* A-frame legs */
    [[-1.6,-.8],[-1.6,.8],[1.6,-.8],[1.6,.8]].forEach(p=>{
      const legX=x+p[0]*1.5;
      const legZ=z+p[1];
      box(.12,2.8,.12,legX,1.4,legZ,steel,{solid:true});
    });
    /* crossbar */
    box(.14,.14,3.2,x,2.75,z,steel);
    /* swings */
    [-.7,.7].forEach(sx=>{
      /* chains */
      box(.04,1.5,.04,x+sx-.3,1.95,z,steel);
      box(.04,1.5,.04,x+sx+.3,1.95,z,steel);
      /* seat */
      box(.7,.06,.28,x+sx,1.15,z,mat(0x2a2c30));
    });
  }
  swingSet(PG.x-1.5,PG.z-1.5);

  /* slide (south side of playground) */
  function slide(x,z){
    /* platform */
    box(1.4,1.6,1.4,x,1.0,z,steel,{solid:true});
    box(1.5,.12,1.5,x,1.85,z,mat(0xc84a3a));
    /* support posts */
    [[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]].forEach(p=>
      box(.1,1.85,.1,x+p[0],.92,z+p[1],steel));
    /* ladder */
    for(let i=0;i<4;i++)
      box(1.2,.06,.06,x-.55,0.3+i*.4,z-1.4,steel);
    /* slide surface (angled) */
    box(1.0,.06,3.6,x-1.6,.7,z,mat(0xc84a3a),{rx:.28,ry:Math.PI/2});
    /* slide side rails */
    box(.06,.2,3.6,x-1.6,.9,z-.55,mat(0xc84a3a),{rx:.28,ry:Math.PI/2});
    box(.06,.2,3.6,x-1.6,.9,z+.55,mat(0xc84a3a),{rx:.28,ry:Math.PI/2});
    solid.push({x:x-1.6,z,hw:1.8,hd:.6});
  }
  slide(PG.x+.5,PG.z+1.8);

  /* small bouncy rocker */
  box(.9,.4,.4,PG.x+2.5,.3,PG.z-.5,mat(0xc84a3a),{solid:true});
  box(.15,.3,.15,PG.x+2.1,.15,PG.z-.5,steel);
  box(.15,.3,.15,PG.x+2.9,.15,PG.z-.5,steel);

  /* ===== POND (west, at -30,0) ===== */
  const PD={x:-30,z:0,r:6};
  uses.push({ kind: "sink", label: "DRINK FROM FOUNTAIN", x: 0, z: 0, y: 0, level: 0, r: 3.0 });
  /* stone rim ring (12 segments) */
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    const a2=(i+1)/16*Math.PI*2;
    const x1=PD.x+Math.cos(a)*(PD.r+.2), z1=PD.z+Math.sin(a)*(PD.r+.2);
    const x2=PD.x+Math.cos(a2)*(PD.r+.2), z2=PD.z+Math.sin(a2)*(PD.r+.2);
    const mx=(x1+x2)/2, mz=(z1+z2)/2;
    const dx=x2-x1, dz=z2-z1;
    const len=Math.hypot(dx,dz);
    const ang=Math.atan2(dx,dz);
    box(.6,.35,len+.1,mx,.17,mz,stoneM,{ry:ang,solid:true});
  }
  /* water */
  cyl(PD.r,.06,PD.x,.18,PD.z,waterM2);
  /* inner depression */
  cyl(PD.r-.3,.1,PD.x,.1,PD.z,mat(0x2a5a4a));
  /* lily pads */
  [[-28.5,-1],[ -31,1.5],[-31.5,-2],[-28,2.5],[-30,3],[-32,0]].forEach(p=>{
    cyl(.35,.03,p[0],.23,p[1],mat(0x3a7a3a));
  });
  /* a few bright flowers on pads */
  sph(.1,-28.5,.3,-1,glow(0xf08a9a));
  sph(.1,-31,.3,1.5,glow(0xffe08a));
  /* reeds along bank */
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2+.3;
    const rx=PD.x+Math.cos(a)*(PD.r+.4), rz=PD.z+Math.sin(a)*(PD.r+.4);
    cyl(.03,.9,rx,.45,rz,mat(0x5a7a3a));
    sph(.08,rx,.95,rz,mat(0x8a6a3a));
  }

  /* ===== BENCHES along paths ===== */
  function bench(x,z,ry){
    ry=ry||0;
    const c=Math.cos(ry), s=Math.sin(ry);
    const put=(w,h,d,ox,oy,oz,m,sol)=>box(w,h,d,x+ox*c+oz*s,oy,z-ox*s+oz*c,m,{ry,solid:sol!==false});
    put(2.0,.1,.5,0,.5,0,woodM);              /* seat */
    put(2.0,.5,.1,0,.85,-.2,woodM);           /* back */
    /* armrests */
    put(.1,.4,.5,-1.0,.65,0,woodDark);
    put(.1,.4,.5, 1.0,.65,0,woodDark);
    /* legs */
    put(.12,.5,.12,-.85,.25,0,steel);
    put(.12,.5,.12, .85,.25,0,steel);
    seats.push({ type: "sit", label: "SIT", x, z, yaw: ry, h: 0.5, level: 0, taken: false });
  }
  /* along south path */
  bench(-3.5,14,Math.PI);
  bench( 3.5,18,Math.PI);
  bench(-3.5,26,Math.PI);
  bench( 3.5,30,Math.PI);
  /* along north path */
  bench(-3.5,-14,0);
  bench( 3.5,-20,0);
  bench(-3.5,-24,0);
  /* along east path */
  bench(14,-3.5,-Math.PI/2);
  bench(20,3.5,-Math.PI/2);
  bench(28,-3.5,-Math.PI/2);
  bench(34,3.5,-Math.PI/2);
  /* along west path */
  bench(-14,3.5,Math.PI/2);
  bench(-20,-3.5,Math.PI/2);
  bench(-40,3.5,Math.PI/2);
  /* around pond */
  bench(-22,-5,Math.PI/2+.2);
  bench(-22,5,Math.PI/2-.2);
  /* around plaza corners */
  bench(-8,-8,Math.PI/4);
  bench(8,-8,-Math.PI/4);
  bench(-8,8,3*Math.PI/4);
  bench(8,8,-3*Math.PI/4);

  /* ===== LAMP POSTS ===== */
  function lamp(x,z){
    cyl(.08,3.5,x,1.75,z,dark,{solid:true});
    box(.35,.1,.35,x,3.55,z,dark);
    cyl(.28,.5,x,3.85,z,glow(0xfff0c0));
    sph(.22,x,3.85,z,glow(0xfff4d0));
    box(.5,.12,.5,x,3.6,z,dark);
  }
  lamp(-4.5,10); lamp(4.5,10);
  lamp(-4.5,-10); lamp(4.5,-10);
  lamp(-4.5,20); lamp(4.5,20);
  lamp(-4.5,32); lamp(4.5,32);
  lamp(-4.5,-20); lamp(4.5,-20);
  lamp(-4.5,-32); lamp(4.5,-32);
  lamp(10,-4.5); lamp(10,4.5);
  lamp(20,-4.5); lamp(20,4.5);
  lamp(32,-4.5); lamp(32,4.5);
  lamp(-10,4.5); lamp(-10,-4.5);
  lamp(-20,-4.5); lamp(-20,4.5);
  lamp(-40,4.5);
  /* plaza lamps */
  lamp(-7.5,-7.5); lamp(7.5,-7.5); lamp(-7.5,7.5); lamp(7.5,7.5);

  /* ===== TREES ===== */
  function tree(x,z,s){
    s=s||1;
    const th=2.4*s, tr=.24*s;
    cyl(tr,th,x,th/2,z,barkM,{solid:true});
    /* foliage */
    cone(1.9*s,2.1*s,x,th+.9*s,z,leafM);
    cone(1.5*s,1.9*s,x,th+1.9*s,z,leafM2);
    cone(1.0*s,1.7*s,x,th+2.9*s,z,leafM3);
  }
  /* ring of trees at various radii, avoiding paths/features */
  function notOnFeature(x,z){
    if(Math.abs(x)<2.5 && Math.abs(z)<40) return false;   /* N-S path */
    if(Math.abs(z)<2.5 && Math.abs(x)<40) return false;   /* E-W path */
    if(Math.hypot(x,z)<11) return false;                    /* plaza/fountain */
    if(Math.hypot(x-GZ.x,z-GZ.z)<6) return false;           /* gazebo */
    if(Math.abs(x-PG.x)<6.5 && Math.abs(z-PG.z)<5.5) return false; /* playground */
    if(Math.hypot(x-PD.x,z-PD.z)<PD.r+2) return false;      /* pond */
    return true;
  }
  /* outer ring */
  for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2;
    const r=HALF-4;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    if(notOnFeature(x,z)) tree(x,z,.9+Math.random()*.4);
  }
  /* mid ring */
  for(let i=0;i<28;i++){
    const a=i/28*Math.PI*2+.3;
    const r=20+Math.random()*6;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    if(notOnFeature(x,z)) tree(x,z,.8+Math.random()*.5);
  }
  /* scattered random */
  for(let i=0;i<40;i++){
    const x=(Math.random()*2-1)*(HALF-6);
    const z=(Math.random()*2-1)*(HALF-6);
    if(notOnFeature(x,z)) tree(x,z,.7+Math.random()*.7);
  }

  /* ===== BUSHES ===== */
  function bush(x,z,s){
    s=s||1;
    sph(.55*s,x,.35*s,z,leafM2);
    sph(.42*s,x+.4*s,.28*s,z+.2*s,leafM);
    sph(.38*s,x-.35*s,.26*s,z-.2*s,leafM3);
  }
  for(let i=0;i<30;i++){
    const a=Math.random()*Math.PI*2;
    const r=8+Math.random()*(HALF-12);
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    if(notOnFeature(x,z)) bush(x,z,.7+Math.random()*.6);
  }
  /* around plaza border */
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2;
    const x=Math.cos(a)*10, z=Math.sin(a)*10;
    if(Math.abs(x)>2.5 && Math.abs(z)>2.5) bush(x,z,.8);
  }

  /* ===== FLOWER BEDS ===== */
  function flowerBed(x,z,rx,rz,colors){
    box(rx*2,.15,rz*2,x,.075,z,mat(0x6a4a2a),{solid:true});
    box(rx*2-.1,.05,rz*2-.1,x,.16,z,mat(0x4a3020));
    const n=Math.floor(rx*rz*2);
    for(let i=0;i<n;i++){
      const fx=x+(Math.random()-.5)*rx*1.7;
      const fz=z+(Math.random()-.5)*rz*1.7;
      cyl(.015,.2,fx,.26,fz,mat(0x3a6a2a));
      sph(.07,fx,.38,fz,glow(colors[i%colors.length]));
    }
  }
  const fcols=[0xff6a8a,0xffd04a,0xa06aff,0xff8a4a,0xffffff];
  flowerBed(-10,-10,1.5,1.5,fcols);
  flowerBed( 10,-10,1.5,1.5,fcols);
  flowerBed(-10, 10,1.5,1.5,fcols);
  flowerBed( 10, 10,1.5,1.5,fcols);
  flowerBed(-10,0,1.0,3.0,fcols);
  flowerBed( 10,0,1.0,3.0,fcols);
  flowerBed(0,-10,3.0,1.0,fcols);
  flowerBed(0, 10,3.0,1.0,fcols);

  /* ===== ROCKS ===== */
  function rock(x,z,s){
    s=s||1;
    const r=new THREE.Mesh(SPHG,mat(0x8a8a82));
    r.scale.set(1.1*s,.6*s,1.0*s); r.position.set(x,.3*s,z);
    r.rotation.y=Math.random()*Math.PI; world.add(r);
    solid.push({x,z,hw:.5*s,hd:.5*s});
  }
  for(let i=0;i<15;i++){
    const a=Math.random()*Math.PI*2;
    const r=12+Math.random()*(HALF-15);
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    if(notOnFeature(x,z)) rock(x,z,.5+Math.random()*.7);
  }

  /* ===== TRASH BINS ===== */
  function bin(x,z){
    cyl(.28,.7,x,.35,z,mat(0x3a5a3a),{solid:true});
    cyl(.3,.08,x,.72,z,dark);
    cyl(.32,.05,x,.02,z,dark);
  }
  bin(-6,4); bin(6,-4); bin(-6,-14); bin(6,14);
  bin(10,6); bin(-10,-6); bin(16,-6); bin(-16,6);

  /* ===== CENTRAL MONUMENT PLAQUES ===== */
  box(1.2,.6,.08,-4,.3,4.5,stoneM);
  box(1.0,.45,.03,-4,.3,4.46,glow(0xe8e0d0));
  box(1.2,.6,.08,4,.3,-4.5,stoneM);
  box(1.0,.45,.03,4,.3,-4.46,glow(0xe8e0d0));

  /* ===== SKY DOME (subtle gradient) ===== */
  const skyGeo=new THREE.SphereGeometry(180,16,10);
  const skyMat=new THREE.MeshBasicMaterial({color:0xc8e0f5,side:THREE.BackSide});
  const sky=new THREE.Mesh(skyGeo,skyMat); scene.add(sky);
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
    crumb: "CITY PARK",
    title: "FOUNTAIN & GAZEBO",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "citypark",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}

