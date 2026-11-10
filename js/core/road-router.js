/* ============================================================
   routeAroundBuildings - given a polyline and a list of AABB
   buildings, returns a new polyline that detours around them.
   Each building entry: { x, z, hx, hz }  (centre + half-extents)
   Not wired into any scene yet: call it on a road's waypoints
   before building the road mesh / NPC traffic path.
   ============================================================ */

function segHitsBox(x1, z1, x2, z2, b, pad) {
  const minX = b.x - b.hx - pad, maxX = b.x + b.hx + pad;
  const minZ = b.z - b.hz - pad, maxZ = b.z + b.hz + pad;
  const dx = x2 - x1, dz = z2 - z1;
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) { if (x1 < minX || x1 > maxX) return false; }
  else {
    let a = (minX - x1) / dx, b2 = (maxX - x1) / dx;
    if (a > b2) { const t = a; a = b2; b2 = t; }
    if (a > t0) t0 = a;
    if (b2 < t1) t1 = b2;
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-9) { if (z1 < minZ || z1 > maxZ) return false; }
  else {
    let a = (minZ - z1) / dz, b2 = (maxZ - z1) / dz;
    if (a > b2) { const t = a; a = b2; b2 = t; }
    if (a > t0) t0 = a;
    if (b2 < t1) t1 = b2;
    if (t0 > t1) return false;
  }
  return true;
}

export function routeAroundBuildings(points, buildings, clearance = 3) {
  if (!buildings || !buildings.length) return points.map((p) => [p[0], p[1]]);
  const out = [[points[0][0], points[0][1]]];

  for (let i = 1; i < points.length; i++) {
    const p = points[i], prev = out[out.length - 1];
    const hits = buildings
      .filter((b) => segHitsBox(prev[0], prev[1], p[0], p[1], b, clearance))
      .sort((a, b) =>
        Math.hypot(a.x - prev[0], a.z - prev[1]) -
        Math.hypot(b.x - prev[0], b.z - prev[1]));

    if (!hits.length) { out.push([p[0], p[1]]); continue; }

    let cur = prev;
    for (const b of hits) {
      const corners = [
        [b.x - b.hx - clearance, b.z - b.hz - clearance],
        [b.x + b.hx + clearance, b.z - b.hz - clearance],
        [b.x + b.hx + clearance, b.z + b.hz + clearance],
        [b.x - b.hx - clearance, b.z + b.hz + clearance],
      ];
      let best = corners[0], bestCost = Infinity;
      for (const c of corners) {
        const cost = Math.hypot(c[0] - cur[0], c[1] - cur[1]) +
                     Math.hypot(p[0] - c[0], p[1] - c[1]);
        if (cost < bestCost) { bestCost = cost; best = c; }
      }
      out.push(best);
      cur = best;
    }
    out.push([p[0], p[1]]);
  }
  return out;
}
