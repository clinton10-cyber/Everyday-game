# v1.3.11 — Hotel Presidential rebuilt, hospital polish pass

## Hotel Presidential (js/places/hotel/interior.js) — replaced with the rebuilt 2-floor interior
Ground: concierge, lobby with fountain, reception, spa, gym, restaurant, sky bar, garden pool terrace, grand atrium with staircase.
Upper: VIP lounge, grand ballroom, four suites, corridors with atrium balustrades. Twin elevators + grand staircase.
Booking/check-in/check-out modal and elevator modal are in the file; guest services (room tablet) still use `guest-services.js`
(init on entry, dispose on exit, as before).

### Collision/interaction fixes applied on top (separate commit, easy to revert)
- Three walls had doors given as absolute x (34) but the wall builder wants the distance from the wall start, so the doors landed at x=56/64
  outside the building (reception↔gym, gym↔bar, bar↔pool). That also cut off the east half of the pool terrace (3 loungers). Fixed (door at x=34).
- Suite bed collider was 1.25 m half-width; with the 0.32 m player radius it left a 0.02 m window inside the 1.6 m seat reach. Now 1.0 x 1.1.
- Upper-floor atrium railings were visual only and the floor is flat, so players could walk out over the void or step sideways off the stairs.
  Added solid guards on the railing lines, across the stair bottom, and along the stair sides. The stair's north arrival stays open.
- Verified headlessly: all 29 interaction points and 94 seats reachable on both floors, 0 teleport/drop edges, 0 walkable cells over the void.

## Hospital polish pass (js/places/hospital/interior.js)
Sealed the walkable dead-end strip east of the floor-1 landing, backing panels behind the two floor-direction signs, sink() moved above first use.
