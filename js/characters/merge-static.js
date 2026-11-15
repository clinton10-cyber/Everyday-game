/* characters/merge-static.js -- draw-call reduction for crowds.
   A character is ~70 small meshes. Meshes that sit directly under the SAME bone, share the SAME material
   object, and have identical render flags never move relative to each other, so they can be baked into one
   mesh (their local transforms are applied to the geometry). The bones themselves are untouched, so the
   animator, the wardrobe (Wardrobe.updateMaterials recolours the shared material objects), hair, hats,
   held items and phones all keep working.

   Not merged: meshes with children, skinned/morphed meshes, multi-material meshes, hidden meshes, and
   anything whose userData differs (userData is copied onto the merged mesh when the group agrees on it).
   Call it once per character at build time (NPCs only; the player avatar is rebuilt live by the wardrobe). */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function eligible(o) {
  if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return false;
  if (o.children.length || !o.visible || Array.isArray(o.material) || !o.material) return false;
  const g = o.geometry;
  if (!g || !g.attributes || !g.attributes.position || !g.attributes.normal || !g.attributes.uv) return false;
  if (g.morphAttributes && Object.keys(g.morphAttributes).length) return false;
  return true;
}
const keyOf = (o) => {
  const g = o.geometry;
  return [o.material.uuid, g.index ? "i" : "n", Object.keys(g.attributes).sort().join(","), o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0,
    o.renderOrder, o.frustumCulled ? 1 : 0, o.layers.mask, JSON.stringify(o.userData || {})].join("|");
};

/* returns { before, after } mesh counts */
export function mergeStaticMeshes(root) {
  let before = 0, after = 0;
  const parents = [];
  root.traverse((o) => { if (!o.isMesh) parents.push(o); });
  root.updateMatrixWorld(true);
  for (const p of parents) {
    const groups = new Map();
    for (const c of p.children) { if (!c.isMesh) continue; before++; if (eligible(c)) { const k = keyOf(c); let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(c); } else after++; }
    groups.forEach((list) => {
      if (list.length < 2) { after += list.length; return; }
      const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
      let merged = null;
      try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
      geos.forEach((g) => g.dispose());
      if (!merged) { after += list.length; return; }
      const a = list[0], mesh = new THREE.Mesh(merged, a.material);
      mesh.castShadow = a.castShadow; mesh.receiveShadow = a.receiveShadow; mesh.renderOrder = a.renderOrder;
      mesh.frustumCulled = a.frustumCulled; mesh.layers.mask = a.layers.mask; mesh.name = "merged"; mesh.userData = Object.assign({}, a.userData, { merged: list.length });
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();            /* baked: identity, never recomputed */
      p.add(mesh);
      for (const m of list) { p.remove(m); m.geometry.dispose(); }   /* material is shared with the merged mesh: do not dispose it */
      after++;
    });
  }
  return { before, after };
}
