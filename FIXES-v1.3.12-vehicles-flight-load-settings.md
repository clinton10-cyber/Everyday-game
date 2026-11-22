# Fixes: vehicle collisions, flight lag, walk/drive loading, Edit controls (SW v189)

## Vehicles vs world objects (`js/scenes/drive.js`)
* The car was one 2.4 m circle against every building, pole and tree (a car is ~2 m wide), and every touching frame cut speed to 40%. It now uses three small circles along the real footprint (`resolveCarAABBs`), drives over low colliders (< 0.45 m), and a hit only removes the speed going into the obstacle: glancing blows slide, head-on hits stop / roll back a little.
* Police cars: smaller collision radius, gentler slowdown.
* AI car vs player car (`npc-cars.js`): only counts as a crash above 6 m/s closing speed; crash damage lowered (`hitPlayerCarByCar`).

## Flight lag
* `js/core/speed-fx.js`: removed the full-screen masked `backdrop-filter: blur()` (re-blurs the whole WebGL frame every frame and was on constantly during wing flight). Streaks + dark edge + FOV kick stay; streak canvas redraws every other frame.
* `drive.js`: while flying the camera follows at 28/s instead of 8/s (it trailed ~8 m behind at wing speed).

## Walk / drive loading
* `npcs.js`: `NPCs.spawn` ignored its `count` and built the whole crowd (24 routes x groups) before the scene appeared. Same crowd, now built in time slices (first slice immediately, routes interleaved across the map, rest in the background; stops if the scene is left).
* `npc-cars.js`: 6 AI cars now, the rest 2 at a time in the background.
* `main.js`: warm-up loads drive.js / npcs / npc-cars first and starts after 2 s instead of 4 s.

## Settings -> Edit controls
* `settings.html`: "Start editing" closed Settings, then waited on a timer owned by the settings iframe, which is destroyed with the overlay, so the editor never started. The game page now starts it (`ph3d:start-edit` message handled in `js/ui/hud.js`).
* `js/ui/hud-edit.js`: `touch-action:none` while editing so finger drags are not cancelled by the browser.
