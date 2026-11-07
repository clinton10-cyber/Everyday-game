/* js/vehicles/traffic.js
   One place that builds AI / ambient-traffic cars from the REAL vehicle
   models in this folder — the same builders and the same nose-direction
   corrections the player's car uses in scenes/drive.js.

   The returned Group is always oriented so its nose points along local +Z.
   To drive it, just set  group.rotation.y = Math.atan2(dirX, dirZ)
   — no per-model correction is needed anywhere else. */

import * as THREE from "three";
import { buildScrappy3D }    from "./scrappy3d.js";
import { buildGWagon3D }     from "./gwagon3d.js";
import { buildCybertruck3D } from "./cybertruck3d.js";
import { buildRangeRover3D } from "./rangerover_compound.js";
import { buildMercedes3D }   from "./mercedes3d.js";
import { buildBMW3D }        from "./bmw3d.js";
import { buildVehicle }      from "./models.js";   /* taxi (danfo) + hilux */

/* model id → { build, fix }   fix = rotation.y that turns the mesh's own
   nose direction into +Z (identical to drive.js FRONT_CORRECTION). */
const R = Math.PI / 2;
const TABLE = {
  scrappy:    { build: (b, r) => buildScrappy3D(b, r),    fix: 0 },
  gwagon:     { build: (b, r) => buildGWagon3D(b, r),     fix: Math.PI },
  cybertruck: { build: (b, r) => buildCybertruck3D(b, r), fix: 0 },
  rangerover: { build: (b, r) => buildRangeRover3D(b, r), fix: 0 },
  mercedes:   { build: (b, r) => buildMercedes3D(b, r),   fix: -R },
  bmw:        { build: (b, r) => buildBMW3D(b, r),        fix: -R },
  taxi:       { build: (b, r) => buildVehicle("taxi", b, r),  fix: -R },
  hilux:      { build: (b, r) => buildVehicle("hilux", b, r), fix: -R },
};

export const TRAFFIC_MODELS = Object.keys(TABLE);

export function buildTrafficCar(model, body, rim) {
  const t = TABLE[model];
  if (!t) throw new Error("[traffic] unknown vehicle model: " + model);
  const inner = t.build(body, rim);
  inner.rotation.y = t.fix;
  const root = new THREE.Group();
  root.add(inner);
  root.userData.vehicleModel = model;
  if (inner.userData && inner.userData.wheels) root.userData.wheels = inner.userData.wheels;   /* keep wheel-spin hooks */
  return root;
}
