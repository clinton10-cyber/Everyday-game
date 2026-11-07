/**
 * Surfaces - place objects on tables, counters, shelves.
 *
 * Public API:
 *   Surfaces.register(x, yTop, z, w, d, rot)  - mark a surface
 *   Surfaces.findTop(x, z)                    - nearest surface
 *   Surfaces.snap(item, floorY)               - rest on top
 */

import * as THREE from "three";

export const Surfaces = {
  list: [],
  clear() { this.list = []; },
  register(x, yTop, z, w, d, rot) {
    const s = { x, y: yTop, z, w, d, rot: rot || 0 };
    this.list.push(s);
    return s;
  },
  registerFromGroup(group, w, d) {
    const bbox = new THREE.Box3().setFromObject(group);
    if (bbox.isEmpty()) return;
    const size = new THREE.Vector3(); bbox.getSize(size);
    const centre = new THREE.Vector3(); bbox.getCenter(centre);
    this.register(centre.x, bbox.max.y, centre.z,
      w || size.x, d || size.z, group.rotation.y);
  },
  findTop(x, z, fromY) {
    let best = null, bestY = fromY != null ? fromY : Infinity;
    for (const s of this.list) {
      const dx = x - s.x, dz = z - s.z;
      const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
      const lx = dx * c - dz * sn;
      const lz = dx * sn + dz * c;
      if (Math.abs(lx) > s.w / 2 || Math.abs(lz) > s.d / 2) continue;
      if (s.y < bestY - 0.01 && (fromY == null || s.y <= fromY + 0.25)) {
        best = s; bestY = s.y;
      }
    }
    return best ? { y: bestY, surface: best } : null;
  },
  snap(item, fallbackFloor) {
    const hit = this.findTop(item.position.x, item.position.z, item.position.y);
    if (hit && hit.y > fallbackFloor) {
      item.position.y = hit.y + (item.userData.phys ? item.userData.phys.halfH : 0.05);
      return true;
    }
    return false;
  },
};

