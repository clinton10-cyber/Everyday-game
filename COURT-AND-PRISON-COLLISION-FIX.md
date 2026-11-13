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
