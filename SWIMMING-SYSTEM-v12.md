# Swimming system v12

## Changes
- Pool furniture now publishes its actual width, depth, water-surface height, and floor level as interaction metadata.
- Pool activation no longer teleports the player to the pool centre. The player is positioned just inside the nearest basin edge.
- The swimming zone is bounded to the pool footprint. Leaving the footprint exits swimming; world water volumes such as the beach continue to use their own `isSwimming` test.
- Swimming animation is state-driven and remains active while the player moves. Movement no longer cancels the swim loop.
- Added short enter-water and exit-water poses, with a smoothed visual waterline offset so the rig eases into and out of the water without changing the collision floor.
- Long swims cycle through front crawl, backstroke, and breaststroke motion.
- Swimming movement speed is slower than walking and running is disabled while swimming.
- Rebuilt the pool basin as a shallow base with four visible coping edges. The previous single-box call passed a boolean as the rotation argument; this has been corrected. Pool visuals no longer create a solid collider across the swimming area.
- Service worker cache version updated to v138 and precache rebuilt.

## Validation
- 410 JavaScript files passed `node --check`.
- 1,103 relative import references checked; no missing relative targets.
- 5 JSON files parsed successfully.
- 13 HTML files parsed successfully.
- Precache generated with 578 files.
- ZIP archive integrity checked after packaging.

## Remaining verification
Static checks do not prove the swimming pose is perfectly aligned with the rendered water surface in every interior. Browser gameplay testing is still required for camera framing, collision at each pool edge, character model proportions, and touch controls.
