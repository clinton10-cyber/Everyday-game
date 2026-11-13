# Prison Structure Repair

Updated the existing State Jail / Rivers State Correctional Centre using the current Phase 4 project as the base.

## Structural corrections
- Added a real ground-floor secure entrance opening; the previous front facade was a continuous wall.
- Added collision to the cell side partitions so players cannot walk through the cell walls.
- Registered the upper-level cell floor slabs as walkable platforms; previously the visible slabs were not all represented in the movement floor map.
- Added per-floor ceiling clearance support: the lower atrium is double-height while the upper cell/catwalk level has a normal storey ceiling.
- Added an exit interaction for visitors. Players serving a sentence are still prevented from leaving by the existing prison lock.
- Rebuilt the exterior silhouette to match the large two-storey cell block, perimeter wall, watchtowers and secure vehicle gate.
- Reused the same correctional-centre exterior design for the legacy `prison` route and consolidated the city map to one physical correctional-centre landmark.

## Preserved
- Existing sentence timer, bail, local persistence and jail clothing system.
- Existing prison NPC definitions, cell furniture, mess hall, guard booth and two-level stair routing.
- Existing local-storage game architecture.

## Validation
- Modified JavaScript files checked with Node syntax validation.
- ZIP integrity checked after packaging.
