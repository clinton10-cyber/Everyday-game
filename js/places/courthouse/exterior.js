import * as THREE from "three";
export function buildExterior(){
 const g=new THREE.Group(); const stone=new THREE.MeshStandardMaterial({color:0xd8d0bf,roughness:.86}), roof=new THREE.MeshStandardMaterial({color:0x343d4b}), glass=new THREE.MeshStandardMaterial({color:0x52758a,metalness:.2,roughness:.25});
 const base=new THREE.Mesh(new THREE.BoxGeometry(19,7,13),stone);base.position.y=3.5;g.add(base);
 const top=new THREE.Mesh(new THREE.BoxGeometry(20,1,14),roof);top.position.y=7.5;g.add(top);
 const steps=new THREE.Mesh(new THREE.BoxGeometry(9,.35,4),stone);steps.position.set(0,.18,8);g.add(steps);
 for(let x=-7;x<=7;x+=3.5){const col=new THREE.Mesh(new THREE.CylinderGeometry(.42,.52,6,12),stone);col.position.set(x,3,6.2);g.add(col);}
 const sign=new THREE.Mesh(new THREE.BoxGeometry(9,1.1,.25),roof);sign.position.set(0,6.6,6.9);g.add(sign);
 const win=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.7,.12),glass);for(let x of [-7,-3.5,3.5,7]){win.position.set(x,3,-6.56);g.add(win.clone());}
 return {group:g, height:8};
}
export default {buildExterior};
