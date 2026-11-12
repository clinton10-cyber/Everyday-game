# Everyday-game — Phase 1: Living World

This phase strengthens the existing NPC population director instead of adding a second NPC system.

## Included

- Scene-aware NPC counting: pedestrians are counted only when their model belongs to the active Three.js scene.
- Better population spread: large maps use a shuffled grid of candidate cells with spacing checks, reducing the chance that all pedestrians spawn in one area.
- Map-specific population and role mixes for UNIPORT, the village, parks, the beach, forest, market and airport.
- Quality-aware NPC population targets so weaker phones use smaller crowds.
- Safer spawn checks against walls, map bounds and the active floor/ground height.
- Periodic population maintenance for eligible scenes, so an incomplete initial spawn can recover without creating an unlimited crowd.
- Proximity-talk mounting is no longer skipped just because enough NPCs already exist.
- Service-worker cache version bumped so updated game code is fetched as a new release.

## Preserved

- Existing NPC models, dialogue, relationships, jobs, police/combat reactions, movement and animation systems.
- Existing game progress and local-storage keys.
- The Fight-button positioning patch from the supplied base ZIP.

## Validation

- All JavaScript files passed `node --check` syntax validation.
- The ZIP is assembled from the full project folder and includes the updated service worker and precache manifest.
- A live in-browser gameplay run was not available in this environment; test UNIPORT, the village, parks and the market on-device after installing this build.
