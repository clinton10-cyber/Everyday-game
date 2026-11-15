# Faceted patterns fix (v1.3.8)
Camo, plaid, ankara, kente, stripes, checkers, dots and gradient showed as flat colour on the Faceted look.
Cause: `loft()` in `js/characters/faceted.js` built geometry with no UV coordinates, so every face sampled a single texel of the fabric texture.
Fix: `loft()` now writes UVs (wrapped seam, repeat around and along the garment) so all patterns and weave/bump textures render on tops, bottoms, dresses and sleeves.
