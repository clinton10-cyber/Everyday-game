# Phase 8 — Governor's Mansion Interior & Object Handling

## Governor's Mansion fixes
- Extended the walkable world bounds to include the full upper private study (the previous north boundary clipped the room).
- Corrected ceiling clearance by floor: the upper private study now uses its actual 9 m ceiling height, and the upper gallery uses the correct relative clearance.
- Replaced the blocking full-width entrance slab with two visually open door leaves that do not create invisible collision barriers.
- Added warm wall-sconce fill lighting to reduce dark corners between chandeliers; fewer lights are used on low-quality devices.

## Object handling
- Added a THROW action for objects held through the world-object pickup system.
- Added mobile HUD Throw button; keyboard Q throws a world-object prop (or existing carryable) while held.
- Drop/throw removes the matching pocket count and returns the object to the world.
- Thrown objects use weight-aware launch speed, gravity, air drag, rotation and up to two damped bounces.
- Dropped pocket objects use the player's current floor height, so they do not fall through upper floors.
- Physics continues while active objects are outside the immediate pickup radius.

## Controls
- E / action button: interact or pick up.
- Q: throw held object; existing carryable throw behavior remains.
- HUD: Use, Drop and Throw appear when an appropriate item is held.
