/* Isaac Boro Memorial Park — rebuilt exterior landmark.
 * Bright, walkable-looking memorial frontage with layered landscaping,
 * ceremonial gate, monument, water feature and recreation silhouettes. */
import * as THREE from "three";
import { M, EM, textLabel } from "../../core/kit.js";
import meta from "./meta.js";

export function buildExterior() {
  const g = new THREE.Group();
  const mat = (c, r=.86, m=0) => new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:m});
  const grass=mat(0x4e9b4c), grass2=mat(0x78b957), path=mat(0xd8c9a9), stone=mat(0xd5d0c3), dark=mat(0x39454a), bronze=mat(0x95643d,.42,.55), water=new THREE.MeshStandardMaterial({color:0x39bddd,roughness:.12,metalness:.25,transparent:true,opacity:.88});
  const add=(geo,ma,x,y,z,rx=0,ry=0,rz=0)=>{const o=new THREE.Mesh(geo,ma);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
  const box=(w,h,d,x,y,z,ma,ry=0)=>add(new THREE.BoxGeometry(w,h,d),ma,x,y,z,0,ry,0);
  const ground=box(54,.3,48,0,-.15,0,grass); ground.receiveShadow=true;
  // Interlocking entrance paths and a broad central promenade.
  box(10,.12,43,0,.04,0,path); box(40,.12,7,0,.04,1,path);
  for(let i=0;i<6;i++) box(1.1,.13,1.1,0,.12,-19+i*7,mat(0xf0e6d2));
  // Monumental entrance portal with green-and-gold identity.
  for(const x of [-8,8]){box(1.25,5.8,1.2,x,2.9,20,stone);box(1.5,.28,1.45,x,5.85,20,mat(0x1f6a42));box(.18,5.2,.18,x,2.9,19.32,mat(0xcaa64a));}
  box(18,1.0,1.5,0,6.0,20,mat(0x1e6740));box(18.4,.22,1.65,0,6.55,20,mat(0xd8b653));
  const gateLabel=textLabel("ISAAC BORO PARK","MEMORIAL GARDENS · PORT HARCOURT");gateLabel.position.set(0,7.25,20);gateLabel.scale.setScalar(1.05);g.add(gateLabel);
  // Low perimeter walls, decorative piers and railings.
  for(const z of [-22,22]){box(52,.75,.5,0,.38,z,stone);for(let x=-24;x<=24;x+=4){box(.55,1.45,.65,x,.72,z,mat(0xe9e1d2));box(.68,.16,.78,x,1.52,z,mat(0x267348));}}
  for(const x of [-26,26]) box(.5,.8,43,x,.4,0,stone);
  // Memorial plaza and bronze bust silhouette.
  add(new THREE.CylinderGeometry(4.3,4.8,.55,32),stone,0,.32,-5);
  add(new THREE.CylinderGeometry(3.75,3.75,.12,32),mat(0xb4a88e),0,.66,-5);
  box(2.8,.7,2.8,0,1.1,-5,mat(0x9c9a8e));box(2.1,.5,2.1,0,1.7,-5,mat(0x6c705f));
  add(new THREE.CylinderGeometry(.72,.9,1.5,12),bronze,0,2.65,-5);
  add(new THREE.SphereGeometry(.72,16,12),bronze,0,3.7,-5);
  add(new THREE.SphereGeometry(.16,10,8),mat(0x34271d),-.26,3.78,-4.38);add(new THREE.SphereGeometry(.16,10,8),mat(0x34271d),.26,3.78,-4.38);
  // Reflecting fountain and water jets.
  add(new THREE.CylinderGeometry(3.0,3.4,.5,32),stone,15,.28,-7);add(new THREE.CylinderGeometry(2.65,2.65,.08,32),water,15,.57,-7);
  add(new THREE.CylinderGeometry(.5,.75,1.1,12),mat(0xc4b99f),15,1.1,-7);
  for(let i=0;i<5;i++){const jet=add(new THREE.ConeGeometry(.12,1.2,8),new THREE.MeshBasicMaterial({color:0x9deeff,transparent:true,opacity:.72}),15+Math.sin(i*1.25)*1.4,1.65,-7+Math.cos(i*1.25)*1.4);}
  // Colourful planted beds, flowering shrubs and palms.
  const flowerMats=[0xf05c79,0xffcf4a,0x8b6ee8,0xfff1e0].map(c=>mat(c));
  for(let i=0;i<12;i++){
    const x=-22+(i%6)*8.8,z=i<6?-14:13;
    add(new THREE.BoxGeometry(5.8,.45,3.2),mat(0x73563a),x,.22,z);
    add(new THREE.BoxGeometry(5.5,.24,2.9),mat(0x3e8b43),x,.55,z);
    for(let j=0;j<7;j++){const fx=x-2.3+(j%4)*1.45,fz=z-0.8+Math.floor(j/4)*1.2;add(new THREE.SphereGeometry(.27,8,6),flowerMats[(i+j)%4],fx,.88,fz);}
  }
  const tree=(x,z,s=1)=>{add(new THREE.CylinderGeometry(.22*s,.34*s,3.4*s,8),mat(0x765039),x,1.7*s,z);add(new THREE.SphereGeometry(1.65*s,10,8),mat(0x287a42),x,4.1*s,z);add(new THREE.SphereGeometry(1.05*s,9,7),mat(0x4d9d4d),x-.55*s,4.55*s,z+.25*s);};
  for(const x of [-22,-15,15,22])for(const z of [-17,0,16])tree(x,z,.9);
  // Benches, lamps and small recreation/play area.
  for(const [x,z] of [[-8,-10],[8,-10],[-8,10],[8,10],[20,4],[-20,4]]){
    box(2.2,.18,.7,x,.65,z,mat(0x8b542e));for(const dx of [-.8,.8])box(.16,.65,.55,x+dx,.34,z,dark);
    box(.12,3,.12,x+1.5,1.5,z,mat(0x4c5553));add(new THREE.SphereGeometry(.25,8,6),EM(0xffe6a1,1.3),x+1.5,3.08,z);
  }
  // A bright playground corner with slide and climbing frame.
  box(9,.18,7,-17,.15,7,mat(0xf1d4a0));
  for(let x of [-20,-14]){add(new THREE.CylinderGeometry(.12,.12,3,8),mat(0xe34d55),x,1.7,7);}
  box(6,.18,.2,-17,3.1,7,mat(0x2e83cb));
  const slide=add(new THREE.BoxGeometry(2.8,.16,3.4),mat(0xf2a53a),-17,1.25,9,.48,0,0);
  // Park signboards and flagpoles.
  for(const x of [-11,11]){box(1.8,2.2,.2,x,1.5,17,dark);box(1.55,1.85,.08,x,1.55,16.87,mat(0x1b6842));}
  const lbl=textLabel("ISAAC BORO MEMORIAL PARK","GARDENS · CULTURE · RECREATION");lbl.position.set(0,8.4,20);g.add(lbl);
  return g;
}
