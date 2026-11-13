/* Pleasure Park — colourful family-entertainment landmark exterior. */
import * as THREE from "three";
import { M, EM, textLabel } from "../../core/kit.js";
import meta from "./meta.js";
export function buildExterior(){
 const g=new THREE.Group();
 const mat=(c,r=.78,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
 const grass=mat(0x55a94f), path=mat(0xe8d6b6), red=mat(0xe84b58), blue=mat(0x348bd0), yellow=mat(0xffcf43), purple=mat(0x8755bb), teal=mat(0x35b7a0), white=mat(0xf8f1df), metal=mat(0x687681,.38,.65);
 const add=(geo,ma,x,y,z,rx=0,ry=0,rz=0)=>{const o=new THREE.Mesh(geo,ma);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const box=(w,h,d,x,y,z,ma,ry=0)=>add(new THREE.BoxGeometry(w,h,d),ma,x,y,z,0,ry,0);
 box(76,.3,68,0,-.15,0,grass);box(16,.12,65,0,.04,0,path);box(70,.12,9,0,.04,0,path);
 // Entrance arch and ticket booths.
 for(const x of [-10,10]){box(1.6,6,1.5,x,3,26,blue);box(1.9,.35,1.8,x,6.15,26,yellow);}
 box(22,1.1,1.7,0,6.0,26,red);box(22.5,.25,1.9,0,6.65,26,yellow);
 const sign=textLabel("PLEASURE PARK","FAMILY FUN · RIDES · GAMES · PORT HARCOURT");sign.position.set(0,7.5,26);sign.scale.setScalar(1.15);g.add(sign);
 for(const x of [-5,5]){box(4,2.4,3,x,1.2,22,white);box(4.1,.25,3.1,x,2.5,22,red);box(2.8,.8,.12,x,1.45,20.43,blue);}
 // Ferris wheel silhouette with gondolas, supports and coloured rim.
 const wx=-20,wz=-5,wy=13;add(new THREE.TorusGeometry(8,.28,10,64),metal,wx,wy,wz,Math.PI/2,0,0);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const x=wx+Math.cos(a)*8,z=wz+Math.sin(a)*8;add(new THREE.SphereGeometry(.48,10,8),[red,blue,yellow,purple,teal][i%5],x,wy+Math.sin(a)*8,z);const spoke=box(.12,15.6,.12,wx,wy,wz,white);spoke.rotation.z=a;}
 for(const x of [-24,-16])box(.65,7,.65,x,3.5,-5,metal);
 box(1,1,1,wx,wy,wz,yellow);
 // Roller coaster: coloured supports, rails and hills.
 const railPts=[[-8,2,0],[-4,8,-2],[0,12,-3],[5,5,-2],[10,10,0],[15,3,2],[21,7,3],[26,2,4]];
 for(let i=0;i<railPts.length-1;i++){const a=railPts[i],b=railPts[i+1];const p1=new THREE.Vector3(a[0],a[1],a[2]),p2=new THREE.Vector3(b[0],b[1],b[2]);const d=p2.clone().sub(p1);const rail=add(new THREE.CylinderGeometry(.18,.18,d.length(),8),i%2?red:blue,...p1.clone().add(p2).multiplyScalar(.5).toArray());rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());for(const s of [-1,1])box(.18,a[1],.18,a[0]+s*.8,a[1]/2,a[2],metal);}
 // Carousel pavilion, canopy and horses.
 add(new THREE.CylinderGeometry(5.2,5.5,.65,32),white,0,.45,-17);add(new THREE.CylinderGeometry(5.1,5.1,.18,32),yellow,.0,.88,-17);
 add(new THREE.ConeGeometry(5.7,3.2,32),red,0,2.7,-17);add(new THREE.CylinderGeometry(.2,.3,4.2,10),yellow,0,2.7,-17);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*3.6,z=-17+Math.sin(a)*3.6;add(new THREE.CylinderGeometry(.08,.08,2.1,8),metal,x,1.95,z);add(new THREE.SphereGeometry(.48,10,8),[blue,teal,purple,red][i%4],x,1.35,z);}
 // Splash pool with fountain jets.
 add(new THREE.CylinderGeometry(6,6.4,.5,32),blue,25,.3,-16);add(new THREE.CylinderGeometry(5.5,5.5,.08,32),mat(0x4ed4e8,.12),25,.58,-16);
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;add(new THREE.ConeGeometry(.13,2.4,8),new THREE.MeshBasicMaterial({color:0xb7f5ff,transparent:true,opacity:.8}),25+Math.cos(a)*2.2,1.65,-16+Math.sin(a)*2.2);}
 // Food court kiosks with vivid awnings.
 const kioskCols=[red,yellow,blue,teal];for(let i=0;i<4;i++){const x=-28+i*9;box(6,3.2,5,x,1.6,17,white);box(6.4,.45,5.3,x,3.35,17,kioskCols[i]);box(4,.9,.12,x,2.15,14.43,darkMat());box(6.4,.16,.4,x,2.9,14.35,kioskCols[i]);}
 function darkMat(){return mat(0x39454a);}
 // Colourful flower beds, trees, benches and path lights.
 for(let i=0;i<14;i++){const x=-33+(i%7)*11,z=i<7?31:-29;add(new THREE.BoxGeometry(5,.45,2.8),mat(0x76543b),x,.2,z);add(new THREE.BoxGeometry(4.8,.2,2.5),mat(0x287e43),x,.52,z);for(let j=0;j<5;j++)add(new THREE.SphereGeometry(.3,8,6),[red,yellow,purple,white,teal][(i+j)%5],x-1.7+j*.85,.85,z);}
 for(const x of [-33,-27,27,33])for(const z of [-24,0,24]){add(new THREE.CylinderGeometry(.22,.3,3.8,8),mat(0x765039),x,1.9,z);add(new THREE.SphereGeometry(1.7,10,8),mat(0x318b43),x,4,z);}
 for(const x of [-12,12]){box(2.6,.2,.8,x,.65,8,mat(0x8b542e));for(const dx of [-.8,.8])box(.16,.65,.65,x+dx,.32,8,metal);add(new THREE.CylinderGeometry(.07,.1,4,8),metal,x+2,2,8);add(new THREE.SphereGeometry(.25,8,6),EM(0xffe8a2,1.4),x+2,4.1,8);}
 return g;
}
