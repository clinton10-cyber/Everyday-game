import * as THREE from "three";
import { M, EM, box } from "./kit.js";
import { Inventory, ITEMS } from "./inventory.js";
import { Combat } from "./combat.js";

export const Cooking={
  recipes:[
    {id:"tea",  name:"TEA",   time:2, heal:15},
    {id:"eggs", name:"EGGS",  time:4, heal:25},
    {id:"pasta",name:"PASTA", time:8, heal:40},
    {id:"roast",name:"ROAST", time:15,heal:60},
  ],
  makeStove(parent,x,y,z){
    const g=new THREE.Group();g.position.set(x,y,z);
    // body
    const body=box(.7,.9,.65,M(0xc6cbd0,.4,.4),0,.45,0);g.add(body);
    // hob
    box(.68,.05,.62,M(0x0a0c0f,.3,.6),0,.92,0,g);
    // 4 burners
    [[-.2,-.16],[.2,-.16],[-.2,.16],[.2,.16]].forEach(p=>{
      const b=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.02,14),
        new THREE.MeshStandardMaterial({color:0x1a1a1a,metalness:.6,roughness:.4}));
      b.position.set(p[0],.96,p[1]);g.add(b);
    });
    // oven door
    box(.6,.5,.04,M(0x14171a,.3,.4),0,.35,.34,g);
    // knob
    const k=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.06,8),
      new THREE.MeshStandardMaterial({color:0xc9ced4,metalness:.8,roughness:.2}));
    k.rotation.x=Math.PI/2;k.position.set(.22,.72,.34);g.add(k);
    parent.add(g);
    // interactable
    const stove={
      mesh:body,label:"COOK",
      onInteract:(controls)=>{
        // pick first recipe always available (ingredients not tracked)
        const rec=Cooking.recipes[Math.floor(Math.random()*Cooking.recipes.length)];
        Cooking.cook(rec,controls);
      }
    };
    return stove;
  },
  cook(recipe,controls){
    if(this._cooking)return;
    this._cooking=true;
    const ui=window.__ph3d_phone;
    ui&&ui._toast("Cooking "+recipe.name+"…");
    setTimeout(()=>{
      this._cooking=false;
      Inventory.add(ITEMS[recipe.id]);
      Combat.heal(recipe.heal);
      ui&&ui._toast(recipe.name+" ready · +"+recipe.heal+" HP");
    },recipe.time*1000);
  }
};

