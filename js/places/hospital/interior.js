/* hospital/interior.js -- converted from the standalone prototype "hospital.html".
   World-building code is the prototype's own; the touch controls, loop and
   renderer were replaced by the game's ThirdPersonControls (player avatar,
   wardrobe, phone, weapons...). Collision boxes are converted below. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { Economy } from "../../core/economy.js";

export async function buildInterior(router) {
  /* ======== prototype kit + world ======== */
  /* ================= SHARED KIT ================= */
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x0a0c10);
  scene.fog=new THREE.Fog(0x0a0c10,30,90);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,200);
  camera.rotation.order='YXZ';
  scene.add(new THREE.HemisphereLight(0xdfe8ff,0x3a3a44,1.2));
  const L1=new THREE.DirectionalLight(0xffffff,1.0); L1.position.set(9,16,7); scene.add(L1);
  const L2=new THREE.DirectionalLight(0xbcd2ff,.45); L2.position.set(-9,8,-8); scene.add(L2);

  const BOXG=new THREE.BoxGeometry(1,1,1),
        CYLG=new THREE.CylinderGeometry(.5,.5,1,10),
        SPHG=new THREE.SphereGeometry(.5,10,8);
  const MC=new Map();
  function mat(c,o){
    if(o&&o.map) return new THREE.MeshLambertMaterial(Object.assign({color:c},o));
    const k=c+'|'+JSON.stringify(o||0); let m=MC.get(k);
    if(!m){m=new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));MC.set(k,m);}
    return m;
  }
  const glow=c=>new THREE.MeshBasicMaterial({color:c});
  const world=new THREE.Group(); scene.add(world);
  const solid=[];
  const seats=[];
  function box(w,h,d,x,y,z,m,o){
    o=o||{};
    const s=new THREE.Mesh(BOXG,typeof m==='number'?mat(m):m);
    s.scale.set(w,h,d); s.position.set(x,y,z); s.rotation.set(o.rx||0,o.ry||0,o.rz||0);
    world.add(s);
    if(o.solid){const c=Math.abs(Math.cos(o.ry||0)),n=Math.abs(Math.sin(o.ry||0));
      solid.push({x,z,hw:(c*w+n*d)/2,hd:(n*w+c*d)/2});}
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

  /* ================= HOSPITAL WARD ================= */
  const W=11,D=13,H=3.2,ROOM={x:W/2-.7,z:D/2-.7};
  const START={x:0,z:D/2-1.6,yaw:0};

  const floorTex=tex(64,64,g=>{
    g.fillStyle='#e8edf0'; g.fillRect(0,0,64,64);
    g.fillStyle='#d9e0e4'; g.fillRect(0,0,32,32); g.fillRect(32,32,32,32);
    g.strokeStyle='#c7cfd5'; g.lineWidth=2;
    g.strokeRect(1,1,62,62); g.strokeRect(1,1,30,30); g.strokeRect(33,33,30,30);
  },W/1.4,D/1.4);

  const wallM=mat(0xe9eef1), ceilM=mat(0xf2f5f7), floorM=mat(0xffffff,{map:floorTex});
  const metal=mat(0x9aa4ad), white=mat(0xf7f9fa), dark=mat(0x39424d), bbM=mat(0xcfd6db);

  /* shell */
  box(W,.2,D,0,-.1,0,floorM);
  box(W,.2,D,0,H+.1,0,ceilM);
  box(W,H,.2,0,H/2,-D/2,wallM,{solid:true});
  box(W,H,.2,0,H/2,D/2,wallM,{solid:true});
  box(.2,H,D,-W/2,H/2,0,wallM,{solid:true});
  box(.2,H,D,W/2,H/2,0,wallM,{solid:true});
  /* baseboards */
  box(W,.13,.06,0,.065,-D/2+.14,bbM); box(W,.13,.06,0,.065,D/2-.14,bbM);
  box(.06,.13,D,-W/2+.14,.065,0,bbM); box(.06,.13,D,W/2-.14,.065,0,bbM);

  /* window with blinds on back wall */
  box(4.8,2.2,.06,0,1.9,-D/2+.11,glow(0xcbe6f7));
  box(5.0,.1,.16,0,3.0,-D/2+.14,white);
  box(5.0,.1,.16,0,.8,-D/2+.14,white);
  box(.1,2.3,.16,-2.45,1.9,-D/2+.14,white);
  box(.1,2.3,.16,2.45,1.9,-D/2+.14,white);
  for(let i=0;i<10;i++) box(4.7,.045,.1,0,.85+i*.22,-D/2+.2,mat(0xeef3f5));

  /* ceiling light panels */
  for(let i=0;i<3;i++) for(let j=0;j<3;j++)
    box(1.3,.06,.7,-3.2+i*3.2,H-.06,-4+j*4,glow(0xf6faff));

  /* --- furniture builders --- */
  function bed(x,z){
    [[-.45,-.92],[.45,-.92],[-.45,.92],[.45,.92]].forEach(p=>cyl(.05,.55,x+p[0],.28,z+p[1],metal));
    box(1.06,.14,2.0,x,.6,z,metal,{solid:true});
    box(1.0,.24,1.94,x,.79,z,mat(0xf4f4ee));
    box(.62,.14,.34,x,.95,z-.72,white);
    box(1.0,.1,1.15,x,.92,z+.4,mat(0x7fb6dd));
    box(1.1,.75,.09,x,.93,z-1.03,mat(0xdfe6ea));
    box(1.1,.48,.09,x,.73,z+1.03,mat(0xdfe6ea));
    [-.53,.53].forEach(s=>{
      cyl(.03,.34,x+s,.95,z-.45,metal);
      cyl(.03,.34,x+s,.95,z+.35,metal);
      cyl(.03,.85,x+s,1.12,z-.05,metal,{rx:Math.PI/2});
    });
  }
  function cabinet(x,z){
    box(.52,.62,.46,x,.62,z,mat(0xdde3e7),{solid:true});
    box(.56,.05,.5,x,.95,z,white);
    box(.3,.025,.05,x,.78,z+.23,dark);
    box(.3,.025,.05,x,.56,z+.23,dark);
    cyl(.035,.05,x+.18,.99,z-.12,metal);
    cyl(.035,.16,x+.18,1.05,z-.12,metal);
    cyl(.09,.14,x+.18,1.16,z-.12,glow(0xa8e6c8));
  }
  function overbed(x,z){
    box(.75,.05,.46,x,.98,z,mat(0xe9e2d2),{solid:true});
    cyl(.04,.98,x,.49,z-.2,metal);
    box(.44,.05,.4,x,.05,z-.2,metal);
  }
  function chair(x,z,ry,c){
    ry=ry||0; const cs=Math.cos(ry),sn=Math.sin(ry);
    const put=(w,h,d,ox,oy,oz,m)=>box(w,h,d,x+ox*cs+oz*sn,oy,z-ox*sn+oz*cs,m,{ry});
    put(.5,.07,.5,0,.45,0,mat(c||0x5b7f9c));
    put(.5,.5,.07,0,.72,-.22,mat(c||0x5b7f9c));
    [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]].forEach(p=>
      cyl(.025,.45,x+p[0]*cs+p[1]*sn,.22,z-p[0]*sn+p[1]*cs,metal));
  }
  function screen(x,z,ry,w,h){
    box(w+.1,h+.1,.07,x,1.5,z,mat(0x2a3038),{ry});
    box(w,h,.03,x,1.5,z+.05,glow(0xffffff),{ry});
  }

  /* --- place everything --- */
  bed(-3.1,-3.2);
  bed(3.1,-3.2);
  seats.push(
    { type:"lie", label:"LIE ON HOSPITAL BED", x:-3.1, z:-3.2, yaw:0, h:0.91, level:0, taken:false },
    { type:"lie", label:"LIE ON HOSPITAL BED", x:3.1, z:-3.2, yaw:0, h:0.91, level:0, taken:false }
  );
  cabinet(-4.55,-3.2);
  cabinet(4.55,-3.2);
  overbed(-3.1,-3.0);
  overbed(3.1,-3.0);
  chair(-3.2,-.2,Math.PI);
  chair(3.2,-.2,Math.PI);
  seats.push(
    { type:"sit", label:"SIT", x:-3.2, z:-.2, yaw:Math.PI, h:0.485, level:0, taken:false },
    { type:"sit", label:"SIT", x:3.2, z:-.2, yaw:Math.PI, h:0.485, level:0, taken:false }
  );

  /* privacy curtain between beds */
  cyl(.03,3.0,0,1.6,-4.6,metal,{rx:Math.PI/2});
  box(.06,2.0,4.6,0,1.05,-2.2,mat(0xbfd8cf,{transparent:true,opacity:.85}));

  /* wall monitor above bed A */
  screen(-3.1,-D/2+.25,0,1.0,.62);
  /* wall clock */
  cyl(.24,.05,3.9,2.5,D/2-.16,white,{rx:Math.PI/2});
  box(.02,.16,.03,3.9,2.56,D/2-.2,dark);
  box(.14,.02,.03,3.96,2.5,D/2-.2,dark);

  /* sink unit on right wall */
  box(1.6,.1,.6,W/2-.36,1.0,-1.2,mat(0xe6ebee),{solid:true});
  box(1.4,.55,.5,W/2-.36,.72,-1.2,mat(0xd6dde1));
  box(1.0,.16,.34,W/2-.36,1.03,-1.2,mat(0xaeb9c0));
  cyl(.04,.34,W/2-.5,1.2,-1.2,metal);
  cyl(.03,.2,W/2-.62,1.3,-1.2,metal,{rz:Math.PI/2});
  box(1.2,.9,.02,W/2-.06,1.7,-1.2,mat(0xd9e3e8));
  box(.35,.45,.08,W/2-.14,1.55,-2.3,mat(0xf2f6f8));

  /* door on front wall */
  box(1.5,2.3,.1,-3.0,1.15,D/2-.12,mat(0xd6b98f),{solid:true});
  box(1.65,.14,.14,-3.0,2.36,D/2-.12,white);
  box(.06,.62,.06,-2.4,1.15,D/2-.2,metal);
  box(.5,.3,.03,-3.0,1.75,D/2-.2,glow(0xdff0fa));

  /* Hospital reception, triage and pharmacy details */
  box(3.6,1.05,.9,0,.55,2.15,mat(0x9c7652),{solid:true});
  box(3.7,.12,1.0,0,1.12,2.15,mat(0xe8ecee));
  box(2.1,.55,.08,0,1.58,1.66,mat(0x176b65));
  box(1.7,.08,.04,0,1.58,1.60,glow(0xeafff8));
  box(2.3,.7,.08,3.9,1.45,2.4,mat(0xe8eef0));
  box(1.7,.18,.1,3.9,1.45,2.32,mat(0x176b65));
  box(2.0,.12,.1,3.9,.98,2.32,mat(0x9aa4ad));
  box(1.8,.75,.08,-4.2,1.55,2.4,mat(0xe7f0f2));
  box(1.3,.12,.1,-4.2,1.12,2.32,mat(0x176b65));
  /* wall signs use high-contrast colour blocks that remain legible on low-end phones */
  box(2.7,.65,.08,0,2.55,-.2,mat(0x176b65));
  box(1.9,.08,.04,0,2.55,-.25,glow(0xffffff));
  box(1.8,.55,.08,4.4,2.45,-.2,mat(0x2d7192));
  box(1.2,.07,.04,4.4,2.45,-.25,glow(0xffffff));
  /* hospital staff */
  const staff=(x,z,coat)=>{
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.25,.31,.85,10),mat(coat));body.position.set(x,1.05,z);world.add(body);
    const head=new THREE.Mesh(SPHG,mat(0x87583f));head.scale.set(.29,.32,.28);head.position.set(x,1.68,z);world.add(head);
    const badge=box(.12,.16,.035,x+.13,1.28,z+.26,glow(0xffffff));
    return body;
  };
  staff(-1.1,1.25,0xe9f4f4); staff(3.4,1.4,0xdcecf2); staff(-3.7,1.2,0xf4f4ed);

  /* misc props */
  cyl(.18,.5,4.4,.25,2.4,mat(0x8c979e),{solid:true});
  cyl(.19,.04,4.4,.5,2.4,dark);
  box(.9,.7,.05,-5.0,1.6,1.0,mat(0x9bc7e0));
  box(.7,.5,.05,5.0,1.7,-4.6,mat(0xe0c79b));
  box(.5,.9,.1,-W/2+.15,1.4,-3.6,mat(0xf0f4f6));
  box(.28,.5,.14,-W/2+.2,1.35,-3.6,glow(0x9fe7c8));
  /* ======== game glue ======== */
  camera.fov = 95; camera.updateProjectionMatrix();
  const __cols = [];
  for (const b of solid) {
    const mk = (level) => ({ minX: b.x - b.hw, maxX: b.x + b.hw, minZ: b.z - b.hd, maxZ: b.z + b.hd, y0: 0, y1: 60, level });
    __cols.push(mk(0));
  }
  const uses = [
    { kind: "triage", label: "RECEPTION / TRIAGE · CHECK IN", x: 0, z: 2.9, y: 0, level: 0, r: 2.0 },
    { kind: "doctor", label: "DOCTOR CONSULTATION · ₦7,500", x: 0, z: -1.0, y: 0, level: 0, r: 2.0 },
    { kind: "pharmacy", label: "HOSPITAL PHARMACY · ₦3,000", x: 4.1, z: 1.0, y: 0, level: 0, r: 1.8 },
  ];
  const __world = {
    colliders: __cols, seats, uses,
    stairs: [],
    platforms: [],
    levelHeight: () => 0,
    ceilingHeight: H,
    bounds: { minX: -ROOM.x, maxX: ROOM.x, minZ: -ROOM.z, maxZ: ROOM.z },
  };

  const ctl = new ThirdPersonControls(camera, router.renderer.domElement, __world, {
    scene, x: START.x, z: START.z, yaw: Math.PI + (START.yaw || 0), level: 0,
    onUse: (use) => {
      const toast = (msg) => window.__ph3d_phone?._toast(msg);
      const hp = window.__ph3d_combat;
      if (use.kind === "triage") {
        const n = Number(localStorage.getItem("ph3d.hospital.visits") || 0) + 1;
        localStorage.setItem("ph3d.hospital.visits", String(n));
        toast(`CITY HOSPITAL · Triage registered. Visit #${n}. Proceed to the doctor.`);
      } else if (use.kind === "doctor") {
        if (!hp || hp.hp >= hp.maxHp) { toast("Doctor: Your health is stable. No treatment is required."); return; }
        const fee = 7500;
        if (Economy.balance < fee) { toast("Doctor: Consultation and treatment costs ₦7,500. Insufficient funds."); return; }
        Economy.withdraw(fee); hp.heal(Math.min(65, hp.maxHp - hp.hp));
        toast("Doctor: Treatment completed. ₦7,500 paid · Health restored.");
      } else if (use.kind === "pharmacy") {
        const inv = window.__ph3d_inv;
        if (!inv || typeof inv.add !== "function") { toast("Pharmacy inventory is unavailable."); return; }
        if (Economy.balance < 3000) { toast("Pharmacy: ₦3,000 required for a medical kit."); return; }
        Economy.withdraw(3000); inv.add({ id: "medkit", name: "MEDICAL KIT", type: "consumable" });
        toast("Pharmacy: Medical kit purchased for ₦3,000 and added to inventory.");
      } else toast(use.label || "USE");
    },
  });

  return {
    three: scene,
    camera,
    controls: { update: () => {} },
    crumb: "CITY HOSPITAL",
    title: "WARD \u00b7 24H CARE",
    subtitle: "",
    hint: "CHECK IN AT RECEPTION · VISIT DOCTOR FOR TREATMENT · PHARMACY FOR MEDKIT · E: INTERACT",
    isInterior: true,
    sceneId: "hospital",
    update: (dt) => {
      ctl.update(dt);
    },
    dispose: () => ctl.dispose(),
  };
}

