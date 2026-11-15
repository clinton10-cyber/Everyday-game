# v1.3.9 — swimming direction, jetpack over water, NPC body builds

## Why players swam backwards
`swim_pool` (js/characters/animator.js) set `hips.x = -PI/2`. That is the *lying on your back* pose (the "lying" state uses the same value), so the
body was face-up with the head pointing behind the direction of travel: feet-first = backwards. It now uses `+PI/2` (chest to the water, head first).
The three strokes were rebuilt for that orientation: front crawl (continuous alternating arm cycle, head up, flutter kick), backstroke (on the back but
still head-first, via a PI spin about the body's long axis) and breaststroke (symmetrical sweep, frog kick).

## Jetpack over the sea
`isSwimming(x,z)` (beach) only looked at x/z, so flying over the sea put you in the swim state (swim speed, swim pose, swim emote, water clamp) even
while airborne. In `thirdperson.js` swimming now requires being at the surface: with the jetpack on and more than 0.5 m above the water you are flying,
not swimming (applies to pools too, using the pool's water height). Drop to the surface and you swim again.

## NPC look + random body build
- NPCs follow the player's current look (classic / faceted) exactly as before and are re-skinned when you switch.
- Each NPC now also gets a random body build (average, athletic, muscular, slim, heavyset, tall & broad) with small random build/height variation.
  The build is rolled once and stored on the NPC config, so switching look keeps the same body. Premium body *styles* (Heroic, Sleek...) are not
  given to NPCs, so they never look like clones of the player.
- Family members get a stable build seeded from their person id (they used to clone the player's body type and style).
