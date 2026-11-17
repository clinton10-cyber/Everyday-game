# Everyday Game v18 — Seating Proportion & Usage Audit

## Changes in this pass
- Classroom: moved each student sit target onto the actual chair cushion footprint and set its interaction height to the cushion top plus a small clearance. Previously the target was 0.23 m behind the cushion centre and the target height was above the cushion.
- City park gazebo: removed one incorrect sit target at the centre of the gazebo (where there is a table, not a seat). Added a separate sit target for each of the actual perimeter bench sections, aligned to each bench's rotation and measured 0.64 m cushion top.
- Statehouse foyer sofas: replaced one sit target per long sofa with one target per actual cushion. Each target is transformed with the sofa rotation and aligned to the cushion top (0.54 m).

## Seating principles for future furniture
- Interaction points must be on the usable seat pan/cushion, not at the furniture object's origin or in front of the furniture.
- Sit height must be derived from the top surface of the cushion/plank, with only a small pose-clearance offset.
- Long benches and sofas need multiple distinct, evenly spaced targets; chairs need one.
- Seat yaw must face away from the backrest and match the furniture's world rotation.
- Do not register sit targets for tables, empty floor, or decorative structures.
- Keep seat reservations shared between player and NPCs to prevent overlapping occupants.

## Validation
- Updated classroom, city park, and statehouse JavaScript files pass `node --check`.
- This is a source-level correction. Live visual checks with the player and NPC rigs are still needed for every interior, camera angle, and avatar body type.
