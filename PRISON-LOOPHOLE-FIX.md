# Prison loophole + courthouse collision fix (v1.3.26)

## State Jail (js/places/statejail/interior.js)
- levelHeight was `() => WH`, which put the whole ground floor at upper-floor height and made the upper level an infinite flat plane. Now ground = 0, upper level = WH; the upper floor only exists where platforms are defined.
- Atrium walls at z = +/-8 were only one storey high, leaving the mezzanine open to the intake and mess halls. They are now full height and also collide on the upper level, including across door gaps.
- Stair flight had no collision: players could step off the sides into the void, and ground-floor players walking into the flight's side or top end were snapped onto the stairs. Added side and top-end colliders and a rail above the bottom step on the S catwalk.
- wallX / wallZ: upper-level collider now covers the whole wall, not only the spans between door gaps.

## Courthouse (js/places/courthouse/interior.js)
- Clerk station and evidence desk overlapped the last row of gallery benches. Moved against the front wall; registry interaction point moved with it.

## Validation
- Node syntax check on both files.
- Collision simulation (same resolve/ground rules as ThirdPersonControls) flood-filled from the spawn point: no walk-off points on the upper level, no upper-level cells outside platforms, closed cells sealed, key interaction points reachable.
