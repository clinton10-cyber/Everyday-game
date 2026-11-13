# Court Collision & Prison Loophole Fix

## Courtroom
- All furniture now collides: judge dais/bench/chair, witness stand, counsel tables, bar tables, gallery benches, clerk/evidence desks and figures.
- Added a visible front door and a "LEAVE COURTHOUSE" interaction (the room previously had no exit).
- Thicker perimeter safety bounds.

## Prison
- Thicker perimeter safety bounds (previously 0.2 thick, tunnelable on lag spikes).
- Exit check also honours remaining sentence time, not just the inJail flag.

## Both
- Movement is sub-stepped (max 1/60s per step, dt capped at 0.25s) so lag spikes cannot carry the player through walls or bars.

## Automatic cell doors
- Every cell (both storeys, left and right blocks) now has a sliding barred door with a status light.
- Doors open automatically as you approach; once you step inside the cell the door closes and LOCKS (light turns red, "CELL DOOR LOCKED").
- Prisoners stay locked in until their sentence ends or bail is paid. Visitors who walk in are let out by the guard after ~2.5s.
- Door collision is added/removed live so a closed door is solid.
