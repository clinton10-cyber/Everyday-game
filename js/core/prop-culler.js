/* prop-culler.js - distance culling for loose props (parked cars, street furniture, bobbing pickups...).
   three.js only frustum-culls: anything in front of the camera is drawn however far away, and the drive
   scene has ~1800 separate meshes (63% of them >150 m away), so a draw call is spent on things that are a
   few pixels wide in the fog. Every 0.25 s this hides small groups beyond a quality-based range and shows
   them again with a little hysteresis.
   Only touches top-level Groups. It never touches: lights, skinned/animated characters (NPC code has its
   own range), sky/sea (materials with fog:false), big groups (radius > maxRadius), or anything the
   author tagged userData.noCull. Only restores objects IT hid, so other code's visible=false is respected. */
import * as THREE from "three";

const _box = new THREE.Box3(), _size = new THREE.Vector3();

export function createPropCuller(scene, camera, opts) {
  opts = opts || {};
  const range = opts.range || 200;
  const maxRadius = opts.maxRadius || 40;
  const markerRange = opts.markerRange || 450;
  const info = new WeakMap();          /* group -> radius, or -1 = never cull */
  const mine = new Set();              /* groups this culler hid */
  let acc = 0;
  const stats = { hidden: 0, checked: 0 };

  function radiusOf(g) {
    let r = info.get(g);
    if (r !== undefined) return r;
    r = -1;
    if (g.isGroup && !(g.userData && g.userData.noCull)) {
      let meshes = 0, bad = false;
      g.traverse((o) => {
        if (o.isLight || o.isSkinnedMesh || o.isPoints || o.isLine || o.isSprite) { bad = true; return; }
        if (o.isMesh) {
          meshes++;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (m && m.fog === false) bad = true;
        }
      });
      if (!bad && meshes > 0) {
        _box.setFromObject(g);
        if (isFinite(_box.min.x) && isFinite(_box.max.x)) {
          _box.getSize(_size);
          const rad = _size.length() / 2;
          if (rad <= maxRadius) r = rad;
        }
      }
    }
    info.set(g, r);
    return r;
  }

  return {
    stats,
    update(dt) {
      acc += dt;
      if (acc < 0.25) return;
      acc = 0;
      const cp = camera.position, kids = scene.children;
      let hiddenNow = 0, checked = 0;
      for (let i = 0; i < kids.length; i++) {
        const g = kids[i];
        const wasMine = mine.has(g);
        if (!wasMine && g.visible === false) continue;           /* someone else hid it: leave it */
        const r = radiusOf(g);
        if (r < 0) continue;
        checked++;
        const marker = g.userData && (g.userData.ring || g.userData.marker || g.userData.beacon);
        const limit = (marker ? Math.max(range, markerRange) : range) + Math.min(r * 4, 200);
        const dx = g.position.x - cp.x, dy = g.position.y - cp.y, dz = g.position.z - cp.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
        if (wasMine) {
          if (d < limit * 0.92) { g.visible = true; mine.delete(g); }
          else hiddenNow++;
        } else if (d > limit) {
          g.visible = false; mine.add(g); hiddenNow++;
        }
      }
      stats.hidden = hiddenNow; stats.checked = checked;
      /* forget groups that were removed from the scene */
      if (mine.size > hiddenNow) for (const g of mine) if (g.parent !== scene) mine.delete(g);
    },
    dispose() { for (const g of mine) g.visible = true; mine.clear(); },
  };
}
