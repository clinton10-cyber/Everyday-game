# Everyday Game v16 — Interior Seating Audit

## Scope
Static inspection of the registered interior scene builders, their visible seating structures, seat-point arrays, player seat selection/release logic, and NPC seat navigation.

## Corrections
- University: procedural classroom, office, lab, table and lecture-room chairs now register seat points from their actual transformed furniture positions. Seat height and floor level are derived from the chair's placement. Ground-floor seats are also made available to campus NPCs; the NPC seat list is cleared on scene disposal.
- Hospital: both patient beds now have lie-down targets; both waiting chairs have sit targets.
- Job centre: all three waiting benches now have sit targets.
- Real-estate office: the receptionist chair and both sofa cushions now have separate sit targets.
- Courthouse: the judge's chair and two positions on each of the 25 public-gallery benches now have sit targets.
- Shared player seating: seats are reserved while the player occupies them, released on standing or controller disposal, and unavailable to NPCs/other player seat selection while occupied. The stand/jump action now exits chairs, beds, baths, toilets and kneeling positions consistently.
- NPC seating: NPCs can complete the final approach to a seat even when the target cushion overlaps its own furniture collider; their longer approach still uses obstacle routing.
- Hotel Presidential: existing 100 seat targets remain available across lobby, reception, concierge, suites, spa, business centre, restaurant, sky bar, pool deck and upper floor. Hotel NPCs receive the ground-floor seat set.

## Existing seating registration reviewed
Existing seat arrays were found in the church, mosque, classroom, computer lab, airport, village, forest, city park, Boropark, zoo, Vatican, statehouse, state jail, duplex, Lagos flat, mansion, my house, nightclub, canteen, beach, and hotel scenes. Beach seats are appended after the controls world is created, which updates the same shared array reference.

The Mile 1 Market and Phone Shop currently have no actual chair/bench/stool models in their interior builders, so empty seat arrays are intentional there rather than missing interactions.

## Validation
- All JavaScript files pass `node --check`.
- 1,103 relative static imports checked; no missing local targets.
- 5 JSON files parse successfully.
- 13 HTML files parse successfully.
- Precache rebuilt: 578 entries.
- Service worker cache version: v142.
- ZIP integrity checked after packaging.

## Limitation
This is a static source audit. It does not replace browser gameplay testing of every room, camera angle, character rig, and seat position on-device. The new seat points are based on the existing furniture geometry and coordinate definitions; visual alignment should still be confirmed in live gameplay.
