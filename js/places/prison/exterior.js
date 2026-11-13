import * as THREE from "three";
import { textLabel } from "../../core/kit.js";
import meta from "./meta.js";
import { NEW_SHAPES } from "../_newshapes.js";

export function buildExterior() {
  const g = new THREE.Group();
  const cache = new Map();
  const mat = (c) => {
    let m = cache.get(c);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); cache.set(c, m); }
    return m;
  };
  const B = (w,h,d,x,y,z,c) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(c));
    m.position.set(x,y,z); m.castShadow = m.receiveShadow = true; g.add(m);
  };
  const C = (rt,rb,h,seg,x,y,z,c) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(c));
    m.position.set(x,y,z); m.castShadow = m.receiveShadow = true; g.add(m);
  };
  const S = (r,x,y,z,c) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r,12,10), mat(c));
    m.position.set(x,y,z); g.add(m);
  };
  B(36,.14,38,0,.07,0,0x5a5a56);
  NEW_SHAPES.statejail(B,C,S);
  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 13.2;
  g.add(lbl);
  return g;
}

