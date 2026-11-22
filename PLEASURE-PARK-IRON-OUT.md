# Pleasure Park – iron-out pass

Rides
- Ferris wheel: spokes were mirrored (wrong angle); A-frame legs flared outward and sat in the gondola plane. Legs now lean in to the hub on both sides of the wheel, with cross ties. Gondolas hang below the rim (hanger was floating above it). Platform and queue posts no longer float above the ground; added steps.
- Ferris ride: rider now sits in the lowest gondola and follows it (previously the camera orbited an empty point), gaze drifts across the park.
- Roller coaster: sleepers lay along the track instead of across it; duplicate closing point in the curve removed; train pitched about the wrong axis (Euler order) and moved as one rigid block. Now three cars follow the curve individually, with chain lift then gravity-based speed. Ride restarts the train in the station and runs exactly one lap in the front car. Track start lowered to meet the station.
- Carousel: now spins, horses bob and face the direction of travel; new RIDE CAROUSEL (camera on a horse). Collider is a true circle (old rotated square left an invisible wall past the platform).

Collisions / layout
- Coaster station collider was rotated 55° off its visual box; now axis-aligned, plus support columns.
- Ferris platform, food kiosks and amphitheatre stage are now solid. Kiosk windows faced away from the park; fixed.
- Amphitheatre seating was five vertical 20 m arches; now flat tiers around a real stage floor. Stage use-point moved to the audience side.
- Trees, benches and flower beds no longer spawn inside the pond, roof garden, splash park, kiosks, ferris or coaster area.
- Ride input is ignored while riding; stray `1` at end of world.js removed.

Service worker cache v194 -> v195. All changes validated with node --check and three.js math checks; browser play-test still outstanding.
