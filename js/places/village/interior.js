/* village/interior.js -- converted from the standalone prototype "zoom.html".
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
  scene.fog=new THREE.Fog(0xa8ccdf,60,170);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,350);
  camera.rotation.order='YXZ';

  scene.add(new THREE.HemisphereLight(0xdff0ff,0x4a4a30,1.05));
  const sun=new THREE.DirectionalLight(0xfff0d0,1.25);
  sun.position.set(40,60,30); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xa8c8e8,.35);
  fill.position.set(-30,25,-30); scene.add(fill);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,12),
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
  const waterM=mat(0x4a8ab0,{transparent:true,opacity:.85});
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

  /* ================= VILLAGE ================= */
  const HALF=70;
  const ROOM={x:HALF-4, z:HALF-4};
  const START={x:0, z:9, yaw:0};

  /* --- textures --- */
  const grassTex=tex(128,128,g=>{
    g.fillStyle='#6a9a44'; g.fillRect(0,0,128,128);
    g.fillStyle='#5e8e38';
    for(let i=0;i<400;i++){g.fillRect(Math.random()*128,Math.random()*128,3,3);}
    g.fillStyle='#7aaa54';
    for(let i=0;i<220;i++){g.fillRect(Math.random()*128,Math.random()*128,2,2);}
    g.strokeStyle='#4e7a2c'; g.lineWidth=1;
    for(let i=0;i<35;i++){
      g.beginPath(); g.moveTo(Math.random()*128,Math.random()*128);
      g.lineTo(Math.random()*128,Math.random()*128); g.stroke();
    }
  },22,22);

  const dirtTex=tex(64,64,g=>{
    g.fillStyle='#b09068'; g.fillRect(0,0,64,64);
    g.fillStyle='#a08058';
    for(let i=0;i<70;i++){g.fillRect(Math.random()*64,Math.random()*64,3,3);}
    g.fillStyle='#c0a078';
    for(let i=0;i<50;i++){g.fillRect(Math.random()*64,Math.random()*64,2,2);}
  },6,6);

  const mudTex=tex(64,64,g=>{
    g.fillStyle='#a87a52'; g.fillRect(0,0,64,64);
    g.fillStyle='#966a44';
    for(let i=0;i<80;i++){g.fillRect(Math.random()*64,Math.random()*64,4,3);}
    g.fillStyle='#b88a60';
    for(let i=0;i<50;i++){g.fillRect(Math.random()*64,Math.random()*64,3,2);}
  },2,2);

  const grassM=mat(0xffffff,{map:grassTex});
  const dirtM=mat(0xffffff,{map:dirtTex});
  const mudM=mat(0xffffff,{map:mudTex});

  const thatchM=mat(0xb89a52), thatchDark=mat(0x967c3c),
        woodM=mat(0x8a5f3a), woodDark=mat(0x5a3f26),
        stoneM=mat(0xa8a094), stoneDark=mat(0x8a8278),
        darkM=mat(0x3a3028), strawM=mat(0xd8c070),
        leafM=mat(0x3a7a30), leafM2=mat(0x2e6424), leafM3=mat(0x4a8a3c),
        barkM=mat(0x6a4a32), clothM=mat(0xc85a3a), clothM2=mat(0x3a6a9a),
        potM=mat(0x9a5a3a), whiteM=mat(0xe8e4d8);

  /* ===== GROUND ===== */
  box(2*HALF,.2,2*HALF,0,-.1,0,grassM);

  /* ===== CENTRAL PLAZA ===== */
  cyl(11,.05,0,.02,0,dirtM);
  cyl(11.4,.04,0,.01,0,stoneDark);

  /* ===== PATHS (4 directions) ===== */
  box(6,.04,46,0,.025,-32,dirtM);
  box(6,.04,48,0,.025,31,dirtM);
  box(46,.04,6,30,.025,0,dirtM);
  box(58,.04,6,-38,.025,0,dirtM);
  /* path edging stones */
  [-3.1,3.1].forEach(o=>{
    for(let i=0;i<10;i++){
      sph(.4,o,.12,-52+i*5,stoneM);
      sph(.4,o,.12,-52+i*5,stoneM);
    }
  });

  /* ===== CENTRAL MEETING TREE ===== */
  cyl(1.15,6.5,0,3.25,0,barkM,{solid:true});
  /* buttress roots */
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2;
    box(.5,1.4,.9,Math.cos(a)*1.1,.7,Math.sin(a)*1.1,barkM,{ry:a});
  }
  /* wide canopy */
  sph(4.2,0,7.2,0,leafM);
  sph(3.4,-3.0,6.6,0.6,leafM2);
  sph(3.4,3.0,6.6,-0.6,leafM3);
  sph(3.0,0.4,6.4,3.0,leafM2);
  sph(3.0,-0.4,6.4,-3.0,leafM3);
  sph(2.6,0,8.6,0,leafM);
  /* stone seating ring */
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2;
    const sx=Math.cos(a)*3.4, sz=Math.sin(a)*3.4;
    box(1.2,.4,.6,sx,.2,sz,stoneM,{ry:-a});
    seats.push({ type:"sit", label:"SIT AT MEETING TREE", x:sx, z:sz, yaw:a, h:0.40, level:0, taken:false });
  }

  /* ===== HUT BUILDER (enterable) ===== */
  function hut(cx,cz,R,doorAng){
    const n=9, wallH=2.3, seg=2*Math.PI/n;
    const segW=2*R*Math.sin(Math.PI/n)+.14;
    /* floor */
    cyl(R,.08,cx,.04,cz,mat(0x9a8a70));
    /* wall segments, skipping the doorway */
    for(let i=0;i<n;i++){
      const a=(i+.5)*seg;
      /* is this segment the door? */
      let da=Math.abs(((a-doorAng+Math.PI*3)%(Math.PI*2))-Math.PI);
      if(da<seg*.62) continue;
      box(segW,wallH,.3,cx+Math.cos(a)*R,wallH/2,cz+Math.sin(a)*R,mudM,{ry:-(a+Math.PI/2),solid:true});
    }
    /* doorway lintel + posts */
    const dx=Math.cos(doorAng)*(R+.05), dz=Math.sin(doorAng)*(R+.05);
    box(.24,wallH,.24,cx+Math.cos(doorAng-.36)*R,wallH/2,cz+Math.sin(doorAng-.36)*R,woodDark,{ry:-doorAng});
    box(.24,wallH,.24,cx+Math.cos(doorAng+.36)*R,wallH/2,cz+Math.sin(doorAng+.36)*R,woodDark,{ry:-doorAng});
    box(2*R*Math.sin(.38),.22,.3,cx+dx,wallH-.1,cz+dz,woodDark,{ry:-(doorAng+Math.PI/2)});
    /* conical thatch roof */
    cone(R+1.0,2.7,cx,wallH+1.35,cz,thatchM);
    cone(R+0.5,1.6,cx,wallH+2.9,cz,thatchDark);
    /* roof finial */
    cyl(.09,.6,cx,wallH+3.9,cz,woodDark);
    /* interior furnishing */
    const ix=cx-Math.cos(doorAng)*1.2, iz=cz-Math.sin(doorAng)*1.2;
    /* sleeping mat */
    box(1.0,.06,2.0,ix,.1,iz,strawM,{ry:-doorAng});
    box(.5,.16,.7,ix-Math.cos(doorAng)*.2,.16,iz-Math.sin(doorAng)*.6,clothM,{ry:-doorAng});
    /* clay pots */
    cyl(.26,.42,ix+.9,.21,iz+.7,potM);
    sph(.24,ix+.9,.42,iz+.7,potM);
    cyl(.2,.34,ix+1.3,.17,iz+.1,mat(0x8a4a2a));
    /* stool */
    cyl(.28,.1,ix+.2,.42,iz-1.0,woodM);
    cyl(.06,.4,ix+.2,.2,iz-1.0,woodDark);
    /* hearth stones */
    for(let i=0;i<5;i++){
      const a=i/5*Math.PI*2;
      sph(.18,ix+Math.cos(a)*.5,.1,iz-1.4+Math.sin(a)*.5,stoneM);
    }
    sph(.16,ix,.16,iz-1.4,mat(0x2a2a2a));
    /* storage basket */
    cyl(.32,.5,cx+Math.cos(doorAng+.9)*(R-.5),.25,cz+Math.sin(doorAng+.9)*(R-.5),strawM);

    seats.push({ type:"lie", label:"LIE ON MAT", x:ix, z:iz, yaw:doorAng+Math.PI, h:0.15, level:0, taken:false });
    seats.push({ type:"sit", label:"SIT ON STOOL", x:ix+.2, z:iz-1.0, yaw:doorAng, h:0.47, level:0, taken:false });
    uses.push({ kind:"use", label:"TEND HEARTH", x:ix, z:iz-1.4, y:0, level:0, r:1.2 });
  }

  /* 8 huts in a ring, doors facing the plaza */
  for(let i=0;i<8;i++){
    const a=(22.5+i*45)*Math.PI/180;
    const r=20;
    hut(Math.cos(a)*r, Math.sin(a)*r, 3.6, a+Math.PI);
  }

  /* ===== WELL ===== */
  const WX=7, WZ=13;
  cyl(1.5,.85,WX,.42,WZ,stoneM,{solid:true});
  cyl(1.55,.1,WX,.88,WZ,stoneDark);
  cyl(1.15,.1,WX,.86,WZ,mat(0x2a3a4a));  /* water inside */
  /* posts + crossbeam */
  box(.2,2.4,WX-1.2,1.2,WZ,woodDark,{solid:true});
  box(.2,2.4,WX+1.2,1.2,WZ,woodDark,{solid:true});
  cyl(.12,2.9,WX,2.35,WZ,woodM,{rz:Math.PI/2});
  /* bucket on rope */
  cyl(.02,1.2,WX,1.75,WZ,darkM);
  cyl(.26,.34,WX,1.1,WZ,woodDark);
  cyl(.24,.28,WX,1.12,WZ,mat(0x3a4a5a));
  uses.push({ kind:"use", label:"DRAW WATER", x:WX, z:WZ+2, y:0, level:0, r:2.0 });

  /* ===== MARKET STALLS ===== */
  function stall(cx,cz,ry,clothColor){
    const c=Math.cos(ry), s=Math.sin(ry);
    const put=(w,h,d,ox,oy,oz,m,sol)=>box(w,h,d,cx+ox*c+oz*s,oy,cz-ox*s+oz*c,m,{ry,solid:sol!==false});
    /* four posts */
    put(.14,2.3,.14,-1.5,1.15,-1.0,woodDark,true);
    put(.14,2.3,.14, 1.5,1.15,-1.0,woodDark,true);
    put(.14,2.3,.14,-1.5,1.15, 1.0,woodDark,true);
    put(.14,2.3,.14, 1.5,1.15, 1.0,woodDark,true);
    /* canopy */
    put(3.6,.1,2.6,0,2.35,0,clothColor,false);
    put(3.7,.32,.18,0,2.18,-1.25,clothColor,false);
    put(3.7,.32,.18,0,2.18, 1.25,clothColor,false);
    /* display table */
    put(3.0,.1,1.0,0,.85,0,woodM,true);
    put(2.9,.7,.9,0,.45,0,woodDark,false);
    /* goods */
    for(let i=0;i<4;i++){
      sph(.2,-1.0+i*.66,1.0,.1,glow([0xe85a2a,0xe8b020,0x4a9a3a,0xd84a6a][i]));
    }
    for(let i=0;i<3;i++){
      cyl(.16,.22,-.9+i*.9,1.0,-.35,strawM);
    }
    /* hanging cloth */
    put(.06,1.5,1.6,1.55,1.3,0,clothM2,false);

    const sx=cx+Math.sin(ry)*2.0;
    const sz=cz+Math.cos(ry)*2.0;
    seats.push({ type:"sit", label:"SIT AT STALL", x:sx, z:sz, yaw:ry+Math.PI, h:0.55, level:0, taken:false });
    uses.push({ kind:"use", label:"BROWSE STALL", x:cx, z:cz, y:0, level:0, r:1.8 });
  }
  stall(30,9,0,clothM);
  stall(36,9,0,clothM2);
  stall(30,-9,Math.PI,clothM2);
  stall(36,-9,Math.PI,clothM);
  /* baskets on the ground */
  [[27,-6],[33,6],[39,6],[27,6]].forEach(p=>{
    cyl(.4,.5,p[0],.25,p[1],strawM);
    cyl(.42,.06,p[0],.5,p[1],mat(0xb8a060));
  });

  /* ===== LIVESTOCK PEN ===== */
  const LPX=0, LPZ=-32;
  /* fence rails */
  box(9,.12,.14,LPX,.6,LPZ-5,woodM,{solid:true});
  box(9,.12,.14,LPX,1.0,LPZ-5,woodM);
  box(9,.12,.14,LPX,.6,LPZ+5,woodM,{solid:true});
  box(.14,.12,10,LPX-4.5,.6,LPZ,woodM,{solid:true});
  box(.14,.12,10,LPX+4.5,.6,LPZ,woodM,{solid:true});
  /* posts */
  for(let i=0;i<5;i++){
    box(.16,1.2,.16,LPX-4.5+i*2.25,0.6,LPZ-5,woodDark);
    box(.16,1.2,.16,LPX-4.5+i*2.25,0.6,LPZ+5,woodDark);
  }
  for(let i=0;i<4;i++){
    box(.16,1.2,.16,LPX-4.5,0.6,LPZ-4+i*2.6,woodDark);
    box(.16,1.2,.16,LPX+4.5,0.6,LPZ-4+i*2.6,woodDark);
  }
  /* shelter */
  box(3.0,.15,2.4,LPX,.85,LPZ-3.6,thatchM);
  for(const p of [[-1.3,-3.4],[1.3,-3.4],[-1.3,-1.8],[1.3,-1.8]])
    box(.14,1.7,.14,LPX+p[0],.85,LPZ+p[1],woodDark);
  /* goats */
  function goat(x,z,ry){
    ry=ry||0;
    box(.55,.42,.95,x,.62,z,mat(0xd8d0c0),{ry});
    box(.34,.34,.4,x+Math.cos(ry)*.55,.78,z-Math.sin(ry)*.55,mat(0xe8e0d0),{ry});
    box(.16,.16,.14,x+Math.cos(ry)*.72,.86,z-Math.sin(ry)*.72,mat(0xc8c0b0),{ry});
    for(const p of [[-.2,-.35],[.2,-.35],[-.2,.35],[.2,.35]])
      box(.09,.42,.09,x+p[0],.21,z+p[1],mat(0xc0b8a8));
  }
  goat(LPX-2.2,LPZ+1.0,.3);
  goat(LPX+1.4,LPZ-1.2,-1.1);
  goat(LPX+2.6,LPZ+2.2,2.0);
  goat(LPX-1.0,LPZ-2.4,1.6);
  /* water trough */
  box(1.8,.3,.6,LPX+3.2,.35,LPZ-3.0,woodDark,{solid:true});
  box(1.6,.12,.42,LPX+3.2,.44,LPZ-3.0,mat(0x4a7a9a));

  /* ===== FARM PLOTS ===== */
  function plot(cx,cz,w,d){
    /* soil */
    box(w,.08,d,cx,.05,cz,mat(0x6a4a30));
    /* fence */
    box(w+.6,.12,.12,cx,.7,cz-d/2-.2,woodM,{solid:true});
    box(w+.6,.12,.12,cx,.7,cz+d/2+.2,woodM,{solid:true});
    box(.12,.12,d+.6,cx-w/2-.2,.7,cz,woodM,{solid:true});
    box(.12,.12,d+.6,cx+w/2+.2,.7,cz,woodM,{solid:true});
    /* posts */
    for(let i=0;i<4;i++){
      box(.14,1.0,.14,cx-w/2-.2+i*(w+.6)/3,.5,cz-d/2-.2,woodDark);
      box(.14,1.0,.14,cx-w/2-.2+i*(w+.6)/3,.5,cz+d/2+.2,woodDark);
    }
    /* crop rows */
    const rows=4, cols=5;
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const px=cx-w/2+.8+(c/(cols-1))*(w-1.6);
        const pz=cz-d/2+.6+(r/(rows-1))*(d-1.2);
        cone(.22,.65,px,.42,pz,leafM2);
        sph(.16,px,.72,pz,leafM3);
      }
    }
    uses.push({ kind:"use", label:"TEND CROPS", x:cx, z:cz, y:0, level:0, r:2.5 });
  }
  plot(-32,-9,7,7);
  plot(-32,4,7,7);
  plot(-40,-3,6,6);
  /* scarecrow */
  box(.18,2.2,-24,.18,-2,woodDark);
  box(1.8,.12,.12,-24,1.5,-2,woodM);
  sph(.34,-24,2.1,-2,strawM);
  box(.9,.7,.2,-24,1.4,-2,clothM);
  sph(.14,-24.5,1.5,-2,strawM);
  sph(.14,-23.5,1.5,-2,strawM);

  /* ===== RAISED GRANARY (walk under) ===== */
  const GX=-14, GZ=-16;
  /* stilts */
  for(const p of [[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]])
    cyl(.16,2.0,GX+p[0],1.0,GZ+p[1],woodDark,{solid:true});
  /* platform */
  cyl(2.2,.16,GX,2.06,GZ,mudM);
  /* body */
  cyl(1.9,1.6,GX,2.94,GZ,mudM);
  /* thatch cap */
  cone(2.6,1.5,GX,4.5,GZ,thatchM);
  cyl(.08,.5,GX,5.4,GZ,woodDark);
  /* ladder */
  for(let i=0;i<5;i++) box(.7,.06,.06,GX+2.1,.35+i*.4,GZ,woodM);
  box(.06,2.0,.06,GX+2.1,1.0,GZ-.35,woodM);
  box(.06,2.0,.06,GX+2.1,1.0,GZ+.35,woodM);

  /* ===== STREAM + BRIDGE ===== */
  const SX=-50;
  /* banks */
  box(13,.06,120,SX,.02,0,mat(0x8a7a5a));
  /* water */
  box(10,.05,120,SX,.05,0,waterM);
  /* stones along the bank */
  for(let i=0;i<22;i++){
    const z=-58+i*5.4;
    sph(.45+Math.random()*.3,SX-6.2,.18,z,stoneM);
    sph(.45+Math.random()*.3,SX+6.2,.18,z,stoneM);
  }
  /* bridge */
  box(14,.16,4.2,SX,.55,0,woodM);
  for(let i=0;i<7;i++) box(14,.06,.12,SX,.65,-1.9+i*.63,woodDark);
  /* bridge rails */
  box(14,.9,.12,SX,1.05,-2.05,woodDark,{solid:true});
  box(14,.9,.12,SX,1.05,2.05,woodDark,{solid:true});
  for(let i=0;i<5;i++){
    box(.16,1.0,.16,SX-5.5+i*2.75,.6,-2.05,woodM);
    box(.16,1.0,.16,SX-5.5+i*2.75,.6,2.05,woodM);
  }
  uses.push({ kind:"use", label:"LOOK AT STREAM", x:SX, z:0, y:0, level:0, r:3.5 });

  /* ===== TREES ===== */
  function tree(x,z,s){
    s=s||1;
    const th=2.8*s;
    cyl(.22*s,th,x,th/2,z,barkM,{solid:true});
    cone(1.9*s,2.2*s,x,th+.9*s,z,leafM);
    cone(1.5*s,1.9*s,x,th+2.0*s,z,leafM2);
    cone(1.0*s,1.7*s,x,th+2.9*s,z,leafM3);
  }
  /* keep trees clear of village features */
  function clearOfVillage(x,z){
    if(Math.hypot(x,z)<13) return false;          /* plaza + tree */
    if(Math.hypot(x-7,z-13)<3.5) return false;    /* well */
    if(Math.abs(x)<4.5 && Math.abs(z)<58) return false;   /* N-S path */
    if(Math.abs(z)<4.5 && x>-6 && x<58) return false;     /* E path */
    if(Math.abs(z)<4.5 && x<-6 && x>-46) return false;    /* W path */
    if(Math.abs(x-33)<9 && Math.abs(z)<12) return false;  /* market */
    if(Math.abs(x)<6 && Math.abs(z+32)<7) return false;   /* pen */
    if(x<-24 && x>-45 && z>-13 && z<9) return false;      /* farm */
    if(Math.hypot(x+14,z+16)<4) return false;             /* granary */
    if(x<-44 && x>-56 && Math.abs(z)<62) return false;    /* stream/bridge */
    /* huts */
    for(let i=0;i<8;i++){
      const a=(22.5+i*45)*Math.PI/180;
      if(Math.hypot(x-Math.cos(a)*20, z-Math.sin(a)*20)<6) return false;
    }
    return true;
  }
  let placed=0;
  for(let attempt=0; attempt<260 && placed<26; attempt++){
    const x=(Math.random()*2-1)*(HALF-6);
    const z=(Math.random()*2-1)*(HALF-6);
    if(!clearOfVillage(x,z)) continue;
    tree(x,z,.85+Math.random()*.5);
    placed++;
  }

  /* ===== BUSHES ===== */
  function bush(x,z,s){
    s=s||1;
    sph(.6*s,x,.38*s,z,leafM2);
    sph(.45*s,x+.45*s,.3*s,z+.2*s,leafM3);
  }
  for(let i=0;i<14;i++){
    const x=(Math.random()*2-1)*(HALF-6);
    const z=(Math.random()*2-1)*(HALF-6);
    if(!clearOfVillage(x,z)) continue;
    bush(x,z,.7+Math.random()*.5);
  }

  /* ===== LAMP / FIRE POSTS around plaza ===== */
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2+Math.PI/8;
    const x=Math.cos(a)*12.5, z=Math.sin(a)*12.5;
    cyl(.1,1.8,x,.9,z,woodDark,{solid:true});
    sph(.22,x,1.9,z,glow(0xffc060));
  }

  /* ===== DISTANT HILLS ===== */
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2+.3;
    const r=HALF+38+Math.random()*14;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    cone(24+Math.random()*12, 30+Math.random()*16, x, 0, z, mat(0x7a8a6a));
  }

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
    crumb: "VILLAGE",
    title: "MARKET & FARMS",
    subtitle: "",
    hint: "LEFT: MOVE · RIGHT: LOOK · E: INTERACT",
    isInterior: true,
    sceneId: "village",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}
