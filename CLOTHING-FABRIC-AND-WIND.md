# Realistic fabric + wind + fit (v1.3.6)

## Fabric textures (`js/characters/fabric.js`)
Clothes were flat colour (or a 128px flat pattern). Every garment now has a drawn fabric and bump map chosen from its style:
cotton, denim twill with slub flecks (jeans), knit rib (sweater, croptop), fleece (hoodie, tracksuit), silk/satin (dress, agbada, kaftan, skirts, bomber), wool (suit, jacket), canvas (cargo, bermuda), stretch (leggings, tube), mesh (jersey), piqué (polo).
Solid colours use one neutral shared weave tinted by the material colour (cheap for crowds); patterns (ankara, kente, plaid...) are baked on top of the weave.

## Wind
Cloth materials are shader-patched: hems, skirts, dresses, robes, palazzo and loose sleeves billow downwind and ripple; stiff garments (jeans, leggings) barely move. A soft sheen glints along folds and pulses with gusts. Strength follows the Weather season (Harmattan, storms, rain).

## Fit
Body styles/types scaled the chest but not the pelvis, so shirt hems, belts, skirts and trousers could stop meeting. The pelvis now follows the chest part-way (arms, legs and neck compensate), so tops and bottoms line up on every style and type.
