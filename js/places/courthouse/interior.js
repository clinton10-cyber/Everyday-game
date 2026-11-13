/* Purpose-built walkable Nigerian High Court courtroom. */
import * as THREE from "three";
import { ThirdPersonControls } from "../../core/thirdperson.js";
import { Justice } from "../../core/justice.js";
export async function buildInterior(router){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x171b24);scene.fog=new THREE.Fog(0x171b24,28,75);
 const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,120);
 scene.add(new THREE.HemisphereLight(0xfff2d9,0x34313a,1.25));
 const sun=new THREE.DirectionalLight(0xffe6bd,1.15);sun.position.set(-8,18,12);scene.add(sun);
 const W=26,D=32,H=8,world=new THREE.Group();scene.add(world);const solid=[],uses=[];
 const boxGeo=new THREE.BoxGeometry(1,1,1),cylGeo=new THREE.CylinderGeometry(.5,.5,1,12),sphereGeo=new THREE.SphereGeometry(.5,12,8),mats=new Map();
 const mat=(c)=>{if(!mats.has(c))mats.set(c,new THREE.MeshLambertMaterial({color:c}));return mats.get(c)};
 function box(w,h,d,x,y,z,c,collide=false){const m=new THREE.Mesh(boxGeo,mat(c));m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;world.add(m);if(collide)solid.push({x,z,hw:w/2,hd:d/2});return m;}
 function cyl(r,h,x,y,z,c){const m=new THREE.Mesh(cylGeo,mat(c));m.scale.set(r*2,h,r*2);m.position.set(x,y,z);world.add(m);return m;}
 function human(x,z,coat,role){const g=new THREE.Group();const torso=new THREE.Mesh(new THREE.CylinderGeometry(.28,.36,.9,10),mat(coat));torso.position.y=1.05;g.add(torso);const head=new THREE.Mesh(sphereGeo,mat(0x8b5b3d));head.scale.set(.34,.38,.32);head.position.y=1.72;g.add(head);const legs=new THREE.Mesh(new THREE.BoxGeometry(.18,.65,.2),mat(0x20242c));legs.position.set(-.13,.32,0);g.add(legs);const leg2=legs.clone();leg2.position.x=.13;g.add(leg2);g.position.set(x,0,z);world.add(g);solid.push({x,z,hw:.4,hd:.4});return g;}
 // court shell, polished wood floor, cream walls and dark timber trim
 box(W,.25,D,0,-.13,0,0x6a4a32);box(W,H,.35,0,H/2,-D/2,0xe7dfcf,true);box(.35,H,D,-W/2,H/2,0,0xe7dfcf,true);box(.35,H,D,W/2,H/2,0,0xe7dfcf,true);box(W,H,.35,0,H/2,D/2,0xe7dfcf,true);box(W,.25,D,0,H+.12,0,0xddd3c1);
 // wall panelling and gallery rail
 for(let x=-11;x<=11;x+=2.2){box(.08,3,.12,x,1.5,-15.7,0x68452d);box(.08,3,.12,x,1.5,15.7,0x68452d);}
 box(W-.6,.18,.2,0,3.1,-15.55,0x68452d);box(W-.6,.18,.2,0,3.1,15.55,0x68452d);
 // judge's raised dais and bench at front
 box(13,.55,4,0,.28,-10.8,0x5d3b27,true);box(12,1.35,1.1,0,1.15,-12.4,0x4b2d20,true);box(12,.16,1.25,0,1.9,-12.25,0x8b673c);
 // high-backed judge chair
 box(1.7,2.5,.35,0,2.3,-13.4,0x321f19,true);box(2.3,.25,1.1,0,1.25,-13.25,0x321f19,true);
 // court seal and national colours above bench
 cyl(1.0,.12,0,5.5,-15.35,0xc8a85c).rotation.x=Math.PI/2;box(3,.16,.12,0,6.4,-15.35,0x087a48);box(3,.16,.12,0,6.18,-15.35,0xffffff);box(3,.16,.12,0,5.96,-15.35,0x087a48);
 // witness stand and counsel tables
 box(2.8,1.5,1.8,-8,.75,-5,0x68452d,true);box(2.8,1.5,1.8,8,.75,-5,0x68452d,true);box(2.1,1.7,1.8,0,.85,-6.5,0x765137,true);
 // bar tables
 for(const x of [-7,7]){box(5,1,2.2,x,.5,-2.2,0x5d3b27,true);for(const dx of [-1.8,1.8])for(const z of [-.7,.7])cyl(.08,.85,x+dx,.42,-2.2+z,0x3c3027);}
 // public gallery benches, multiple rows
 for(let row=0;row<5;row++){const z=2+row*2.45;for(let x=-8;x<=8;x+=4){box(3.3,.25,.85,x,.65,z,0x754b2e,true);box(3.3,.8,.22,x,1.05,z-.32,0x5a3825,true);}}
 // clerk station near entrance and evidence desk
 box(4,1.1,1.3,-8,.55,12,0x68452d,true);box(3,.95,1.2,8,.48,12,0x6e5238,true);
 // main entrance door (front wall) and exit
 box(2.6,3.4,.12,0,1.7,D/2-.25,0x3b2a1f);box(2.9,.2,.2,0,3.5,D/2-.25,0xc8a85c);
 // lights
 for(let x of [-8,0,8])for(let z of [-8,2,12]){box(2.2,.08,1.2,x,7.65,z,0xfff1d0);const l=new THREE.PointLight(0xffe8c7,1.0,17);l.position.set(x,6.8,z);scene.add(l);}
 // courtroom officials and participants as visible figures
 human(-8, -8,0x1c2e49,"prosecutor");human(8,-8,0x253c32,"defence");human(0,-14,0x241f1c,"judge");human(-4,3,0x4a2830,"court officer");human(4,5,0x263a58,"visitor");
 uses.push({kind:"hearing",label:"APPROACH THE BAR · START COURT HEARING",x:0,z:-4.2,y:0,level:0,r:2.4});
 uses.push({kind:"exit",label:"LEAVE COURTHOUSE",x:0,z:14.4,y:0,level:0,r:2.0});
 uses.push({kind:"clerk",label:"COURT REGISTRY · CHECK CASE",x:-8,z:10.2,y:0,level:0,r:2.0});
 for(const b of [{x:0,z:-D/2+.25,hw:W/2,hd:.4},{x:0,z:D/2-.25,hw:W/2,hd:.4},{x:-W/2+.25,z:0,hw:.4,hd:D/2},{x:W/2-.25,z:0,hw:.4,hd:D/2}])solid.push(b);
 const cols=solid.map(b=>({minX:b.x-b.hw,maxX:b.x+b.hw,minZ:b.z-b.hd,maxZ:b.z+b.hd,y0:0,y1:60,level:0}));
 const bounds={minX:-W/2+.5,maxX:W/2-.5,minZ:-D/2+.5,maxZ:D/2-.5};
 const w={colliders:cols,seats:[],uses,stairs:[],platforms:[],levelHeight:()=>0,ceilingHeight:H,bounds};
 const toast=m=>{try{window.__ph3d_phone?._toast(m)}catch(_){}};
 const ctl=new ThirdPersonControls(camera,router.renderer.domElement,w,{scene,x:0,z:13,yaw:Math.PI,level:0,onUse:(use)=>{
   if(use.kind==="hearing"){const result=Justice.requestTrial();if(result.ok){toast(`COURT JUDGMENT: ${result.outcome}${result.fine?` · Fine ₦${result.fine.toLocaleString("en-NG")}`:""}`);const P=window.__ph3d_prison;if(P&&P.inJail){setTimeout(()=>{try{toast("Taken into custody · back to the cell block");router.go("prisonScene")}catch(_){}},2500);}else if(result.status==="acquitted"){setTimeout(()=>toast("Case dismissed. You are free to go."),1200);}}else toast(result.reason==="no_trial"?"No active case is ready for hearing. Check the Justice app.":result.reason==="funds"?"You need ₦25,000 for the court hearing.":"Court hearing unavailable.");}
   else if(use.kind==="exit"){const P=window.__ph3d_prison;try{if(P&&P.inJail){P.courtEscort=false;router.go("prisonScene");}else router.go("city");}catch(_){}}
   else if(use.kind==="clerk"){const s=Justice.snapshot();toast(s.active?`Registry: ${s.active.id} · ${s.active.status.replaceAll("_"," ")}`:"Registry: No active case on record.");}
 }});
 return {three:scene,camera,controls:{update:()=>{}},crumb:"HIGH COURT",title:"RIVERS STATE HIGH COURT",subtitle:"COURTROOM 1 · PUBLIC HEARING",hint:"WALK TO THE BAR AND PRESS E TO START A HEARING · VISIT REGISTRY FOR CASE STATUS",isInterior:true,sceneId:"courthouse",update:dt=>{let r=Math.min(dt,.25);while(r>1e-6){const t=Math.min(r,1/60);ctl.update(t);r-=t;}},dispose:()=>ctl.dispose()};
}
