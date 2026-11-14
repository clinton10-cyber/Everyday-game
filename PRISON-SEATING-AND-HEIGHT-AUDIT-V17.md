# Prison Seating & Measured Seat-Height Audit — v17

## Prison seating added / corrected

The State Jail interior now registers 68 distinct seating/lying targets:

- 16 cell bunks across both floors (8 cells per floor).
- 16 cell toilets across both floors.
- 16 cell stools across both floors.
- 8 visitor-waiting bench slots (four benches, two places each).
- 12 mess-hall bench slots (six benches, two places each).

The previous prison visitor benches had no seat targets. The mess-hall benches used one target per bench even though the benches were long enough for two people; these are now split into separate slots. Duplicate centre targets were removed.

## Height calculations from the actual mesh dimensions

All values are metres, measured from the local floor of the relevant level:

| Object | Mesh calculation | Physical top | Interaction anchor |
|---|---|---:|---:|
| Cell bunk mattress | mattress centre 0.72 + half-thickness 0.11 | 0.83 | 0.83 + floor offset |
| Cell toilet bowl rim | centre 0.21 + half-height 0.21 | 0.42 | 0.44 + floor offset |
| Cell stool | centre 0.45 + half-thickness 0.03 | 0.48 | 0.50 + floor offset |
| Prison bench plank | centre 0.45 + half-thickness 0.07 | 0.52 | 0.54 |

The upper-level cell anchors add the upper-floor offset (4.2 m). The seat anchor is deliberately a small amount above the physical top where the seated pose needs clearance; it is not the raw mesh centre.

## Scope and validation

- All JavaScript files pass `node --check`.
- 1,103 relative imports checked; no missing local imports.
- Precache rebuilt to 578 entries; service-worker cache bumped to v143.
- ZIP integrity verified.

This is a source-level measurement and registration audit. It does not replace visual testing of every character rig in a live browser. Actual in-game screenshots of all interiors were not generated in this environment; the companion PNG is a measured top-down prison seat map, not a rendered game screenshot.
