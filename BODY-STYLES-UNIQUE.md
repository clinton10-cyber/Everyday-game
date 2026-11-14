# Unique body styles (v1.3.4)

Body styles used to only scale torso width ~±10% (and the faceted look ignored them), so they all looked alike.
`js/characters/lp-bodystyle.js` now gives each style its own proportions and signature geometry, on both looks:

| Style | Silhouette | Signature parts |
|---|---|---|
| Classic | rounded, deeper chest, bigger head | puffed shoulder caps, soft belly |
| Faceted Elite | slightly broad, shallow | glowing crystal chest gem, shoulder shards, back fin, knee crystals |
| Heroic | wide V-frame, thick arms | gold pauldrons, red emblem, belt + buckle, bracers |
| Sleek | narrow, thin limbs, small head | neon racing stripes on torso/arms/legs, collar ring |
| Angular | broad shoulders, shallow chest | shoulder spikes, chest ridge, forearm fins, knee wedges, back spines |
| Refined | slim, upright | gold collar, belt, jewel, cuffs, ankle rings, brooch |

"Faceted Default" (free) is unchanged. Clothes follow the scaled torso because they are children of the same joints.
