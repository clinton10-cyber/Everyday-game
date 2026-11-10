import * as THREE from "three";
import { M, box } from "./kit.js";
import { makeDrawer } from "./drawers.js";
import { Cooking } from "./cooking.js";
import { Freezer } from "./freezer.js";
import { Inventory, ITEMS } from "./inventory.js";

// Spawns drawers, stove, freezer, knife + food into an interior.
// Returns an array of interactables to register with WalkControls.
export function spawnCrimeProps(three, ROOMS, ctrl, router){
  const props=[];
  // find rooms by id
  const get=id=>ROOMS.find(r=>r.id===id);

  const corridor=get("corridor");
  const living=get("living");
  const kitchen=get("kitchen");
  const library=get("library");
  const master=get("bedroomA");
  const bathA=get("bathA");
  const bedB=get("bedroomB");
  const bedC=get("bedroomC");
  const bedD=get("bedroomD");
  const bedE=get("bedroomE");

  function inRoom(r,dx=0,dy=1.0,dz=0,ry=0,opt={}){
    if(!r)return null;
    const cx=r.x+r.w/2+dx,cz=r.z+r.d/2+dz;
    return makeDrawer(three,{x:cx,y:dy,z:cz,ry,owner:opt.owner||"myhouse",
      locked:opt.locked||0,label:opt.label||"DRAWER",
      contents:opt.contents||[]});
  }

  // ── Drawers ──
  // corridor drawer — house key
  const dKey=inRoom(corridor,-7.5,1.0,-1.5,0,{
    label:"DRAWER · KEY",contents:["key_myhouse"],locked:0});
  dKey&&props.push(dKey);

  // living room drawer — house deed
  const dDeed=inRoom(living,3.5,1.0,-6.1,0,{
    label:"DRAWER · DEED",contents:["deed"],locked:2});
  dDeed&&props.push(dDeed);

  // kitchen drawer — knife
  const dKnife=inRoom(kitchen,4.55,1.0,-3.0,-Math.PI/2,{
    label:"DRAWER · UTENSILS",contents:["knife","cleaver"],locked:0});
  dKnife&&props.push(dKnife);

  // library drawer — books
  const dBooks=inRoom(library,0,1.0,6.0,Math.PI,{
    label:"DRAWER · BOOKS",contents:["book","book","book"],locked:0});
  dBooks&&props.push(dBooks);

  // bedroom drawers
  const dM=inRoom(master,4,1.0,-6.15,0,{
    label:"DRAWER · PRIVATE",contents:["book"],locked:3});
  dM&&props.push(dM);
  const dB2=inRoom(bedB,1.8,1.0,3.4,Math.PI,{contents:["book"],locked:1});
  dB2&&props.push(dB2);
  const dB3=inRoom(bedC,3,1.0,-6.1,0,{contents:["vase"],locked:0});
  dB3&&props.push(dB3);

  // ── Stove (kitchen) ──
  if(kitchen){
    const sx=kitchen.x+kitchen.w/2-1.55, sz=kitchen.z+kitchen.d/2-6.05;
    const stove=Cooking.makeStove(three,sx,0,sz);
    props.push(stove);
  }

  // ── Freezer (master bedroom) ──
  if(master){
    const fx=master.x+master.w/2-5.5, fz=master.z+master.d/2+4.6;
    const frz=Freezer.make(three,fx,0,fz,Math.PI/2);
    props.push(frz);
  }

  // ── Food items scattered on kitchen counter ──
  if(kitchen){
    const foodPositions=[
      {c:0xffd8a8,id:"eggs",x:kitchen.x+.45,z:kitchen.z+3.3},
      {c:0xe8d8a0,id:"pasta",x:kitchen.x+.45,z:kitchen.z+3.9},
      {c:0x8a5a2f,id:"roast",x:kitchen.x+.45,z:kitchen.z+4.5},
    ];
    foodPositions.forEach(f=>{
      const g=new THREE.Group();
      const item=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.06,14),
        new THREE.MeshStandardMaterial({color:f.c,roughness:.6}));
      g.add(item);
      g.position.set(f.x,.98,f.z);
      three.add(g);
      const spec=ITEMS[f.id]||{id:f.id,name:f.id,type:"food",heal:20};
      ctrl.registerCarryables([{mesh:g,radius:.15,halfH:.05}]);
      g.userData.phys.spec=spec;
      // when it comes to hand, add to inventory: hook into E again
      // (the current controls already handle pickup; we just track it)
    });
  }

  // register every crime prop with the controls so the button shows USE
  props.forEach(p=>ctrl.registerInteractable(p));
  return props;
}

