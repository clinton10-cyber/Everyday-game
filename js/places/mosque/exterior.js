/* mosque/exterior.js -- compound silhouette shared with the city / drive scenes
   (see places/_newshapes.js). Used by the "exterior" route. */
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
  const put = (geo, x, y, z, c, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat(c));
    m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  const B = (w, h, d, x, y, z, c, rx, ry, rz) => put(new THREE.BoxGeometry(w, h, d), x, y, z, c, rx, ry, rz);
  const C = (rt, rb, h, seg, x, y, z, c, rx, ry, rz) => put(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, c, rx, ry, rz);
  const S = (r, x, y, z, c) => put(new THREE.SphereGeometry(r, 12, 10), x, y, z, c);

  B(34, 0.14, 34, 0, 0.07, 0, 0x5a5a56);
  NEW_SHAPES[meta.id](B, C, S, meta.color, 0x444444);

  const lbl = textLabel(meta.name, meta.sub);
  lbl.position.y = 24;
  g.add(lbl);
  return g;
}

