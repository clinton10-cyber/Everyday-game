import * as THREE from "three";

const live = new Map();
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const palettes = {
  "Superhero": {wall:0x18233f,floor:0x202a3c,accent:0xffc857,light:0x83bfff,cloth:[0x315fd1,0x9b344d]},
  "Science Fiction": {wall:0x102d3c,floor:0x142d38,accent:0x4cf0db,light:0x66dfff,cloth:[0x2a9b9a,0x5969c8]},
  "Fantasy": {wall:0x352447,floor:0x45354a,accent:0xf2c66d,light:0xd8a5ff,cloth:[0x6c3f9d,0x3b785e]},
  "Horror": {wall:0x211a25,floor:0x30262d,accent:0xb64f55,light:0xffbd77,cloth:[0x48505b,0x6d343b]},
  "Crime / Noir": {wall:0x29323b,floor:0x343a3d,accent:0xe6b86d,light:0xf5d39b,cloth:[0x3d4b5a,0x6a4141]},
  "Adventure": {wall:0x394238,floor:0x786246,accent:0xf0c36a,light:0xffd88a,cloth:[0x8a5735,0x39736a]}
};
function mat(color, roughness=.86, extra={}) { if (roughness && typeof roughness === "object") { extra=roughness; roughness=extra.roughness ?? .86; } return new THREE.MeshStandardMaterial({color,roughness,flatShading:true,...extra}); }
function box(scene,w,h,d,x,y,z,m,rz=0) { const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.rotation.z=rz;scene.add(o);return o; }
function cylinder(scene,r1,r2,h,x,y,z,m,segments=7) { const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),m);o.position.set(x,y,z);scene.add(o);return o; }
function limb(group,a,b,r,m,segments=6) { const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),dir=new THREE.Vector3().subVectors(vb,va);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*.78,r,dir.length(),segments),m);mesh.position.copy(va).add(vb).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());group.add(mesh);return mesh; }
function makeCharacter(scene,x,z,clothColor,skinColor,pose=0,accessory=0) {
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  const skin=mat(skinColor),cloth=mat(clothColor),dark=mat(0x20232a),shoe=mat(0x17191e),hair=mat(0x252027);
  // Faceted, deliberately low-poly body and head.
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.34,.43,.92,6,1),cloth);torso.position.y=1.28;g.add(torso);
  const hips=new THREE.Mesh(new THREE.IcosahedronGeometry(.36,0),cloth);hips.scale.set(1,.55,.72);hips.position.y=.83;g.add(hips);
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.29,1),skin);head.position.set(0,2.02,0);g.add(head);
  const hairCap=new THREE.Mesh(new THREE.IcosahedronGeometry(.295,0),hair);hairCap.scale.set(1,.48,1);hairCap.position.set(0,2.19,-.015);g.add(hairCap);
  const eyeMat=mat(0x171717,{roughness:1});
  for(const ex of [-.105,.105]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.025,5,4),eyeMat);eye.position.set(ex,2.04,.255);g.add(eye);}
  const shoulderL=[-.36,1.62,0],shoulderR=[.36,1.62,0];
  const handL=pose===1?[-.78,1.22,.08]:[-.54,.65,.05],handR=pose===2?[.78,1.28,.1]:[.54,.65,.05];
  limb(g,shoulderL,handL,.13,cloth);limb(g,shoulderR,handR,.13,cloth);
  const palmL=new THREE.Mesh(new THREE.IcosahedronGeometry(.11,0),skin);palmL.position.set(...handL);g.add(palmL);
  const palmR=new THREE.Mesh(new THREE.IcosahedronGeometry(.11,0),skin);palmR.position.set(...handR);g.add(palmR);
  limb(g,[-.16,.82,0],[-.2,.12,.02],.15,dark);limb(g,[.16,.82,0],[.2,.12,.02],.15,dark);
  const footL=box(g,.25,.13,.4,-.2,.08,.1,shoe),footR=box(g,.25,.13,.4,.2,.08,.1,shoe);
  if(accessory===1){const cape=box(g,.62,.9,.08,0,1.27,-.3,mat(0x9c2949));cape.rotation.x=-.12;}
  if(accessory===2){const badge=new THREE.Mesh(new THREE.IcosahedronGeometry(.1,0),mat(0xf2c66d,{metalness:.25}));badge.position.set(.12,1.42,.32);g.add(badge);}
  if(accessory===3){const pack=box(g,.42,.55,.22,0,1.35,-.31,mat(0x2a5960));}
  g.rotation.y=(x<0?-.13:.13)+(pose*.08);
  return g;
}
function addWindow(scene,x,y,z,w,h,accent) {
  box(scene,w+.18,h+.18,.13,x,y,z,mat(0x665a55));
  box(scene,w,h,.1,x,y,z+.075,mat(0x6b9eb5,.25,{emissive:0x244c67,emissiveIntensity:.55}));
  box(scene,.07,h+.08,.16,x,y,z+.15,mat(0xb6a18a));box(scene,w+.08,.07,.16,x,y,z+.15,mat(0xb6a18a));
  // distant angular skyline / landscape visible through the window
  for(let i=0;i<6;i++){const bh=.5+(i%3)*.42;box(scene,.38,bh,.12,x-w*.42+i*w*.16,y-h*.35+bh*.5,z+.22,mat(i%2?0x344e62:0x536c7c));}
  box(scene,.04,h,.12,x,y,z+.2,mat(accent));
}
function addInterior(scene,genre,p,story,page) {
  const wall=mat(p.wall),floor=mat(p.floor),trim=mat(0x8d806f),accent=mat(p.accent,{metalness:.12}),dark=mat(0x171d27),wood=mat(0x594337),glow=mat(p.light,.5,{emissive:p.light,emissiveIntensity:.23});
  box(scene,15,.22,10,0,-.12,0,floor);
  box(scene,15,6,.22,0,3,-4.9,wall);
  box(scene,.22,6,10,-7.4,3,0,wall);box(scene,.22,6,10,7.4,3,0,wall);
  // architectural beams frame the open-front cinematic composition
  for(const x of [-6.7,-3.4,0,3.4,6.7])box(scene,.12,5.9,.16,x,3,-4.72,trim);
  box(scene,15,.22,.35,0,5.85,-4.75,trim);
  // Floor inlays guide the eye into the scene.
  for(let i=-2;i<=2;i++)box(scene,.045,.012,8,i*1.1,.005,.1,accent);
  if(genre==="Superhero"){
    addWindow(scene,0,3,-4.72,4.8,2.8,p.accent);
    for(let i=0;i<5;i++){const h=1+(i%3)*.7;box(scene,.7,h,.35,-5.4+i*2.7,h/2,-4.35,mat(0x263c59));}
    box(scene,3,.85,1.1,0,.45,-1.5,dark);for(let i=-1;i<=1;i++)box(scene,.65,.08,.5,i*.85,.95,-1.5,glow);
    cylinder(scene,.38,.38,.16,-4.9,.08,1.4,accent,8);
  } else if(genre==="Science Fiction") {
    addWindow(scene,0,3,-4.72,5.5,3,p.accent);
    for(let i=0;i<4;i++){box(scene,1.15,1.1,.65,-5.2+i*3.45,.55,-1.7,dark);box(scene,.9,.08,.5,-5.2+i*3.45,1.14,-1.7,glow);}
    for(let i=0;i<3;i++){cylinder(scene,.04,.04,3,-5+i*2.1,2.8,-3.9,accent,6);}
    // greenhouse planters and angular plants
    for(let i=0;i<3;i++){box(scene,.9,.4,.8,-5+i*5, .2,2.4,wood);cylinder(scene,.035,.14,.9,-5+i*5,.82,2.4,mat(0x4b9a68),5);}
  } else if(genre==="Fantasy") {
    for(const x of [-5.6,-2.8,2.8,5.6]){cylinder(scene,.38,.52,5.4,x,2.7,-3.6,trim,7);cylinder(scene,.58,.58,.22,x,5.45,-3.6,accent,7);}
    box(scene,2.4,.4,1.1,0,.25,-2.7,wood);box(scene,1.9,1.5,.55,0,1.05,-3.1,mat(0x72538e));
    for(let i=0;i<5;i++){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.18),accent);gem.position.set(-3.6+i*1.8,4.1,-4.2);scene.add(gem);}
    addWindow(scene,0,3.4,-4.7,2.2,2.6,p.accent);
  } else if(genre==="Horror") {
    for(let i=0;i<3;i++){box(scene,1.55,3.4,.15,-4.8+i*4.8,1.7,-4.7,dark);box(scene,.08,3.2,.2,-4.8+i*4.8,1.7,-4.58,trim);}
    box(scene,2.5,.6,1.3,-2,.32,-.7,wood);box(scene,1.3,1.1,.9,4,.55,1.8,dark);
    for(let i=0;i<4;i++){cylinder(scene,.05,.05,1.3,-5+i*3.3,4.8,-4.2,glow,5);}
    addWindow(scene,5,3,-4.7,1.5,2.4,p.accent);
  } else if(genre==="Crime / Noir") {
    addWindow(scene,0,3.5,-4.72,4.5,2.5,p.accent);
    for(let i=0;i<9;i++)box(scene,4.6,.06,.06,0,2.6+i*.2,-4.48,trim);
    box(scene,3.2,.35,1.5,0,.75,-1.7,wood);box(scene,.2,.9,.2,-1.1,1.32,-1.7,wood);box(scene,.2,.9,.2,1.1,1.32,-1.7,wood);
    for(let i=0;i<4;i++){box(scene,.8,1.5,.65,-5.5+i*3.65,.75,2.4,dark);for(let j=0;j<3;j++)box(scene,.65,.035,.68,-5.5+i*3.65,.35+j*.4,2.05,trim);}
    cylinder(scene,.08,.08,1.4,3.4,4.2,-2.6,glow,6);
  } else {
    for(const x of [-5.4,-2.7,2.7,5.4]){cylinder(scene,.5,.65,4.8,x,2.4,-3.4,trim,6);cylinder(scene,.75,.75,.2,x,4.85,-3.4,accent,6);}
    box(scene,2.2,.6,1.5,0,.3,-2.4,wood);box(scene,1.3,.8,.8,3,.4,1.5,mat(0x82603d));
    for(let i=0;i<4;i++){const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.5+i*.04,0),mat(i%2?0x76644a:0x5e6048));rock.position.set(-5+i*3.2,.28,3.1);scene.add(rock);}
    addWindow(scene,0,3.4,-4.7,2.8,2.5,p.accent);
  }
  // overhead practical lights, kept simple for mobile rendering
  for(const x of [-4.8,0,4.8]){const lamp=new THREE.Mesh(new THREE.OctahedronGeometry(.18),glow);lamp.position.set(x,5.55,-1.5);scene.add(lamp);}
}
function buildScene(canvas,genre,title,page) {
  const p=palettes[genre]||palettes.Adventure, scene=new THREE.Scene();scene.background=new THREE.Color(0x111827);scene.fog=new THREE.Fog(0x111827,18,34);
  const camera=new THREE.PerspectiveCamera(36,16/9,.1,80);camera.position.set(page%3===1?1.4:0,5.4,15.6);camera.lookAt(0,2.05,-.25);
  scene.add(new THREE.HemisphereLight(0xdcecff,0x55443a,2.0));const key=new THREE.DirectionalLight(0xffe4bd,2.2);key.position.set(-5,9,7);scene.add(key);const fill=new THREE.DirectionalLight(p.light,1.1);fill.position.set(6,5,-5);scene.add(fill);
  addInterior(scene,genre,p,title,page);
  const colors=p.cloth;const skin=[0x8a5539,0x5d392d,0xc18b63][page%3];
  makeCharacter(scene,-2.25,1.15,colors[0],skin,page%3,genre==="Superhero"?1:genre==="Crime / Noir"?2:genre==="Science Fiction"?3:0);
  makeCharacter(scene,2.2,-.05,colors[1],[0x70452f,0x9b694a,0x4c3028][(page+1)%3],(page+1)%3,genre==="Fantasy"?1:0);
  if(page%3===2){makeCharacter(scene,.05,2.6,0x777b86,0x865c43,1,0);}
  // A small story-specific prop in the foreground anchors each scene.
  if(/signal|radio|emergency|relay/i.test(title)){box(scene,.8,.35,.45,-.6,.25,1.9,mat(0x273b4b));const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.2),mat(0xff4747,{emissive:0xff2424,emissiveIntensity:.8}));beacon.position.set(-.6,.58,1.9);scene.add(beacon);}
  if(/court|case|alibi|detective|debt/i.test(title)){box(scene,1.3,.12,.8,.5,.95,1.8,mat(0x74543b));}
  if(/garden|orchard|plant|forest/i.test(title)){for(let i=0;i<3;i++)cylinder(scene,.035,.2,.8,3.7+i*.45,.7,2.3,mat(0x4e9560),5);}
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,preserveDrawingBuffer:true,powerPreference:"low-power"});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));renderer.setSize(960,540,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.render(scene,camera);
  return {scene,camera,renderer,zoom:36};
}
export function disposeComicScenes(root=document) {
  if(!root)return;
  root.querySelectorAll("canvas[data-comic-scene]").forEach(canvas=>{
    const key=canvas.dataset.comicScene,rec=live.get(key);if(!rec)return;
    try{rec.renderer.dispose();rec.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}catch(_){}
    live.delete(key);
  });
}
export function mountComicScenes(root=document) {
  if(!root)return;
  root.querySelectorAll("canvas[data-comic-scene]").forEach(canvas=>{
    const key=canvas.dataset.comicScene;if(live.has(key))return;
    try{const record=buildScene(canvas,canvas.dataset.genre||"Adventure",canvas.dataset.title||"Everyday Story",Number(canvas.dataset.page)||0);live.set(key,record);}
    catch(err){console.warn("[comic 3D scene]",err);const ctx=canvas.getContext("2d");if(ctx){canvas.width=960;canvas.height=540;ctx.fillStyle="#172235";ctx.fillRect(0,0,960,540);ctx.fillStyle="#fff";ctx.font="28px sans-serif";ctx.fillText("3D scene unavailable on this device",40,270);}}
  });
}
export async function captureComicScene(root,key,title,page) {
  const canvas=root?.querySelector(`canvas[data-comic-scene="${key}"]`);if(!canvas)return false;
  try{const url=canvas.toDataURL("image/jpeg",.88);const {Photos}=await import("../core/photos.js");Photos.add(url,`${title} — Scene ${page+1}`,{tag:"comic",who:[],where:"Everyday Comics"});window.__ph3d_phone?._toast("3D comic scene saved to Gallery");return true;}
  catch(err){console.warn("[comic capture]",err);window.__ph3d_phone?._toast("Could not save comic scene");return false;}
}
export function openComicSceneViewer(comic,page) {
  const key=`viewer-${comic.id}-${page}-${Date.now()}`;const overlay=document.createElement("div");overlay.className="comic-scene-viewer";overlay.innerHTML=`<div class="csv-head"><div><small>EVERYDAY COMICS · 3D SCENE</small><b>${String(comic.title).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}</b><span>SCENE ${page+1} · FIXED CINEMATIC CAMERA</span></div><button data-close>✕</button></div><div class="csv-stage"><canvas data-comic-scene="${key}" data-genre="${comic.genre}" data-title="${String(comic.title).replace(/"/g,"&quot;")}" data-page="${page}"></canvas></div><div class="csv-controls"><button data-zoom="-">− ZOOM OUT</button><button data-zoom="+">+ ZOOM IN</button><button data-capture>▣ CAPTURE TO GALLERY</button></div><p>Camera angle is fixed to preserve the intended story composition. Zoom changes framing only; the scene cannot be rotated.</p>`;
  const style=document.createElement("style");style.textContent=`.comic-scene-viewer{position:fixed;inset:0;z-index:100010;background:#080c16;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:14px;box-sizing:border-box;font-family:inherit}.comic-scene-viewer .csv-head{display:flex;justify-content:space-between;align-items:center;gap:12px;width:min(100%,1100px);margin:0 auto 12px}.comic-scene-viewer small,.comic-scene-viewer span{display:block;color:#c5cbe0;font-size:10px;letter-spacing:.12em}.comic-scene-viewer b{display:block;font-size:18px;margin:4px 0}.comic-scene-viewer button{border:0;border-radius:10px;padding:12px 14px;background:#28364b;color:white;font-weight:900}.comic-scene-viewer .csv-stage{width:min(100%,1100px);margin:0 auto;border:1px solid #53627b;border-radius:14px;overflow:hidden;background:#111}.comic-scene-viewer canvas{display:block;width:100%;height:auto;aspect-ratio:16/9}.comic-scene-viewer .csv-controls{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:14px auto 4px}.comic-scene-viewer [data-capture]{background:#f0bd69;color:#20180d}.comic-scene-viewer p{text-align:center;color:#b7c1d3;font-size:11px;line-height:1.5;margin:8px auto;max-width:760px}`;overlay.appendChild(style);document.body.appendChild(overlay);mountComicScenes(overlay);
  const rec=live.get(key);overlay.querySelector("[data-close]").onclick=()=>{if(rec){rec.renderer.dispose();rec.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});live.delete(key);}overlay.remove();};
  overlay.querySelectorAll("[data-zoom]").forEach(b=>b.onclick=()=>{const r=live.get(key);if(!r)return;r.zoom=clamp(r.zoom+(b.dataset.zoom==="+"?-3:3),25,48);r.camera.fov=r.zoom;r.camera.updateProjectionMatrix();r.renderer.render(r.scene,r.camera);});
  overlay.querySelector("[data-capture]").onclick=()=>captureComicScene(overlay,key,comic.title,page);
}
