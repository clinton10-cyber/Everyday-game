import * as THREE from "three";
import { M, box } from "./kit.js";
import { Crime } from "./crime.js";
import { Combat } from "./combat.js";
import { Sfx } from "./sfx.js";

export const Freezer={
  make(parent,x,y,z,ry=0){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;
    // chest freezer
    const body=box(1.5,.9,.7,M(0xdfe4e9,.35,.5),0,.45,0);g.add(body);
    // lid
    box(1.52,.06,.72,M(0xc6cbd0,.3,.6),0,.93,0,g);
    // handle
    const h=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.8,8),
      new THREE.MeshStandardMaterial({color:0x9aa2ab,metalness:.8,roughness:.2}));
    h.rotation.z=Math.PI/2;h.position.set(0,.96,.34);g.add(h);
    // lock dot
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.04,8,8),
      new THREE.MeshStandardMaterial({color:0x5ee0ff,emissive:0x5ee0ff,emissiveIntensity:1}));
    dot.position.set(.65,.9,.36);g.add(dot);
    parent.add(g);
    return {
      mesh:body,label:"OPEN FREEZER",
      onInteract:(controls)=>{
        try{Sfx.play("fridge_open");}catch(_){}
        // if the local player is downed, offer to hide self? — skip
        // if any downed remote (from Multiplayer), hide it
        const mp=window.__ph3d_mp;
        let target=null;
        if(mp)mp.players.forEach(p=>{if(p.state==="downed")target=p;});
        if(target){
          Crime.addEvent("hideBody",60,"You");
          target.state="stored";
          window.__ph3d_phone&&window.__ph3d_phone._toast("Body hidden in freezer");
        }else{
          window.__ph3d_phone&&window.__ph3d_phone._toast("Freezer is empty");
        }
      }
    };
  }
};

