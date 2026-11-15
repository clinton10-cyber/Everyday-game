/* characters/npc-lod.js -- distance levels of detail for NPC characters.
     LOD 0  near            every part
     LOD 1  beyond lod1     the 10 finger bones are hidden (invisible at that size; ~18 fewer draw calls)
     LOD 2  beyond lod2     the whole pose is baked into ONE mesh per material (about 8 draw calls) and the
                            skeleton is hidden and no longer animated. Coming back inside the range
                            restores the skeleton; the walk cycle resumes on the next animation step.
   Only plain walkers/idlers are baked: anyone hurt, talking, seated, emoting or dead keeps the full skeleton. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4();
const BAKEABLE = new Set(["walk", "idle"]);

function fingers(rig, on) {
  for (const arm of [rig.armL, rig.armR]) {
    if (!arm) continue;
    if (arm.thumb) arm.thumb.visible = on;
    if (arm.fingers) for (const f of arm.fingers) if (f && f.group) f.group.visible = on;
  }
}

function bake(npc) {
  const root = npc.group; if (!root) return false;
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.lodBaked || Array.isArray(o.material)) return;
    for (let p = o; p && p !== root; p = p.parent) if (p.visible === false) return;
    const g = o.geometry; if (!g || !g.attributes.position || !g.attributes.normal) return;
    const ng = (g.index ? g.toNonIndexed() : g.clone());
    for (const k of Object.keys(ng.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") ng.deleteAttribute(k);
    if (!ng.attributes.uv) ng.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    _rel.multiplyMatrices(_inv, o.matrixWorld); ng.applyMatrix4(_rel);
    let a = byMat.get(o.material); if (!a) byMat.set(o.material, a = []); a.push(ng);
  });
  if (!byMat.size) return false;
  const made = [];
  byMat.forEach((list, mat) => {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (list.length > 1) list.forEach((g) => g.dispose());
    if (!merged) return;
    const m = new THREE.Mesh(merged, mat); m.userData.lodBaked = true; m.castShadow = false; m.receiveShadow = false;
    m.matrixAutoUpdate = false; m.updateMatrix(); made.push(m);
  });
  npc._lodHidden = [];
  for (const c of root.children) if (c.visible && !c.userData.keepOnRebuild) { c.visible = false; npc._lodHidden.push(c); }
  npc._lodMeshes = made; made.forEach((m) => root.add(m));
  return true;
}
function unbake(npc) {
  const root = npc.group;
  if (npc._lodMeshes) for (const m of npc._lodMeshes) { if (m.parent) m.parent.remove(m); m.geometry.dispose(); }
  if (npc._lodHidden) for (const c of npc._lodHidden) c.visible = true;
  npc._lodMeshes = null; npc._lodHidden = null;
}

export const NpcLod = {
  bakesThisFrame: 0,
  beginFrame() { this.bakesThisFrame = 0; },
  /* forget everything (the character was rebuilt) */
  reset(npc) { npc._lod = 0; npc._lodMeshes = null; npc._lodHidden = null; },
  /* returns true when the skeleton should keep animating */
  update(npc, dist, lod2, lod1) {
    if (!npc.rig || !npc.group) return true;
    let lod = npc._lod || 0;
    /* a rebuilt character lost our baked meshes: start over */
    if (lod === 2 && (!npc._lodMeshes || !npc._lodMeshes[0] || npc._lodMeshes[0].parent !== npc.group)) { this.reset(npc); lod = 0; }
    const c = npc.ctl, calm = !npc.dead && BAKEABLE.has(npc.state) && !(c && c._emoteTimer > 0) && !npc._lifeHidden;
    const want = !calm ? Math.min(1, dist > lod1 ? 1 : 0)
      : lod === 2 ? (dist > lod2 - 8 ? 2 : dist > lod1 - 4 ? 1 : 0)
      : lod === 1 ? (dist > lod2 ? 2 : dist > lod1 - 4 ? 1 : 0)
      : (dist > lod2 ? 2 : dist > lod1 ? 1 : 0);
    if (want === 2 && lod !== 2) {
      if (this.bakesThisFrame >= 2) return true;
      this.bakesThisFrame++;
      if (bake(npc)) { fingers(npc.rig, false); npc._lod = 2; return false; }
      npc._lod = 1; return true;
    }
    if (lod === 2 && want !== 2) { unbake(npc); lod = 1; npc._animAcc = 1; }
    if (want === 2) return false;
    if (want !== lod || npc._lodFingers === undefined) { fingers(npc.rig, want === 0); npc._lodFingers = want === 0; }
    npc._lod = want;
    return true;
  },
};
