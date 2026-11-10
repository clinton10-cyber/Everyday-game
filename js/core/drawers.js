import * as THREE from "three";
import { M, box } from "./kit.js";
import { Crime } from "./crime.js";
import { Inventory, ITEMS } from "./inventory.js";
import { Sfx } from "./sfx.js";

// A drawer is a small box in a wall. Tap it: opens (or forces open).
// When opened, its contents are handed to the caller as carryable specs.
export function makeDrawer(parent, opts){
  const {x,y,z,w=0.9,h=0.5,d=0.45,ry=0,owner="myhouse",locked=0,label="DRAWER",contents=[]}=opts;
  const g=new THREE.Group();
  g.position.set(x,y,z);g.rotation.y=ry;
  // cabinet frame
  const frame=box(w,h,d,M(0x2a1f16,1),0,0,0);g.add(frame);
  // front panel
  const front=box(w*.96,h*.9,.06,M(0x5c3a22,1),0,0,d/2+.03);g.add(front);
  // handle
  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,w*.4,8),
    M(0xc9ced6,.2,.9));
  handle.rotation.z=Math.PI/2;
  handle.position.set(0,0,d/2+.08);g.add(handle);
  // lock indicator
  if(locked>0){
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.04,8,8),
      new THREE.MeshStandardMaterial({color:locked>=3?0xff2d2d:locked>=2?0xffaa33:0x88ff88,
        emissive:locked>=3?0xff2d2d:0,emissiveIntensity:locked>=3?1.5:0}));
    dot.position.set(w*.35,0,d/2+.08);g.add(dot);
  }
  parent.add(g);
  // interactable spec
  const drawer={
    mesh:front,label:(locked&&owner!=="myhouse")?"FORCE":"OPEN",
    data:{owner,locked,label,contents,opened:false,g}
  };
  drawer.onInteract=(controls)=>{
    if(drawer.data.opened){drawer.onTake(controls);return;}
    try{Sfx.play("drawer_open");}catch(_){}
    const mine=(owner==="myhouse");
    if(mine||locked===0){
      drawer.data.opened=true;
      if(!mine)Crime.addEvent("openDrawer",15,"You");
    }else{
      // need key
      if(Inventory.has("key_"+owner)){
        drawer.data.opened=true;
        if(!mine)Crime.addEvent("openDrawer",5,"You");
      }else if(locked<3){
        drawer.data.opened=true;
        Crime.addEvent("forceDrawer",15*locked,"You");
        controls&&controls._b&&(controls._b.style.borderColor="#ff5c5c");
      }else{
        Crime.addEvent("forceDrawer",10,"You");
        alert("This drawer needs a key.");
      }
    }
    if(drawer.data.opened)drawer.onOpen&&drawer.onOpen(controls);
  };
  drawer.onOpen=(controls)=>{
    // spawn contents as carryables via the controls' carryables list
    if(!drawer.data.spawned){
      drawer.data.spawned=true;
      drawer.data.items=[];
      contents.forEach((cid,i)=>{
        const spec=ITEMS[cid]||{id:cid,name:cid,type:"junk"};
        // visual mesh
        const mg=new THREE.Group();
        if(spec.type==="weapon"){
          const blade=box(.04,.4,.02,M(0xdcdcdc,.2,.9),0,.2,0,mg);
          const handle=box(.05,.12,.05,M(0x2a1f16,1),0,0,0,mg);
        }else if(spec.type==="deed"){
          const p=box(.35,.28,.03,M(0xf4e8c8,1),0,0,0,mg);
          const seal=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.02,12),
            new THREE.MeshStandardMaterial({color:0xc9a34a,metalness:.9,roughness:.2}));
          seal.rotation.x=Math.PI/2;seal.position.set(.12,-.1,.02);mg.add(seal);
        }else if(spec.type==="key"){
          const kh=box(.04,.14,.04,M(0xc9a34a,.3,.9),0,0,0,mg);
          const bit=box(.08,.03,.03,M(0xc9a34a,.3,.9),0,-.05,0,mg);
        }else if(spec.type==="food"){
          const p=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.06,14),
            new THREE.MeshStandardMaterial({color:0xffd8a8,roughness:.6}));
          mg.add(p);
        }else{
          const b=box(.2,.24,.06,M(0x8a4a4a,1),0,0,0,mg);
        }
        const wx=drawer.data.g.position.x;
        const wy=drawer.data.g.position.y+.05;
        const wz=drawer.data.g.position.z+.6;
        mg.position.set(wx,wy+i*.05,wz);
        parent.add(mg);
        // register as carryable
        drawer.data.items.push({mesh:mg,radius:.15,halfH:.15,spec});
      });
      // hand them to the controls
      controls&&controls.registerCarryables(drawer.data.items.map(i=>({mesh:i.mesh,radius:i.radius,halfH:i.halfH})));
      // register inventory on pickup
      drawer.data.items.forEach(it=>{
        const oldTap=it.mesh.userData.phys;
        it.mesh.userData.phys.spec=it.spec;
      });
    }
  };
  drawer.onTake=(controls)=>{
    if(!drawer.data.items||!drawer.data.items.length)return;
    // take nearest
    const cam=controls.camera;
    let best=null,bd=Infinity;
    for(const it of drawer.data.items){
      if(it.taken)continue;
      const d=it.mesh.position.distanceTo(cam.position);
      if(d<bd){bd=d;best=it;}
    }
    if(!best||bd>2.2)return;
    // crime if not yours
    if(owner!=="myhouse"){
      const isDeed=best.spec.type==="deed";
      Crime.addEvent(isDeed?"takeDeed":"takeItem",isDeed?45:30,"You");
    }
    best.taken=true;
    Inventory.add(best.spec);
    // remove mesh
    best.mesh.parent&&best.mesh.parent.remove(best.mesh);
    best.mesh.userData.phys.active=false;
  };
  return drawer;
}

