# Phase 21 — Story pages rebuild

Fixes the five root story pages (story-01 … story-05) that looked bad and did not work.

## Root causes fixed
- Timer went negative (rAF timestamp vs performance.now) → camera code threw → 3D canvas froze after one frame.
- Classroom and hotel interiors imported the full gameplay controller → Jetpack/Crouch/"STANDING" HUD leaked onto story pages. Gameplay modules now load lazily, only outside cinematic mode.
- `toNonIndexed()` warning: Icosahedron geometry is already non-indexed in three r169; now converted only when indexed.
- Every act rebuilt its own world (hotel built twice, etc.). Each location is now built once and shared.
- Cast/camera were placed at coordinates that were inside walls or empty ground. Every location now has a tuned stage (anchor + 4 camera shots).
- Cars drove in reverse (nose points along +Z); they now drive nose-first. Interior acts no longer spawn a car.
- Walk animation targeted the wrong rig joints; fixed (arms/legs use shoulder/hip joints).

## New
- `stories.html` hub with thumbnails (`assets/stories/*.jpg`).
- One shared UI: `css/story.css`, `js/cinematics/story-page.js`; story data in `js/cinematics/stories-data.js`. Each story page is now a ~15-line shell.
- Loading bar with real progress, error card with retry, tap-to-show controls, segmented scene bar (tap to jump), keyboard (Space, arrows, M).
- Narration waits for the spoken line to finish (up to 10 s) before the next scene.
- Day / dusk / night lighting per scene (`tod` in stories-data.js); story 2 is now actually at night.
- Portrait phones get a wider vertical FOV; pages pause when the tab is hidden.
- Four distinct Pleasure Park spots, three distinct street spots.
- `tools/stage-debug.html` — developer camera harness; add `?debug` to a story URL to get `window.__film.scrub(act, 0..1)`.
- Service worker cache bumped to v123; precache regenerated.

Open stories from the game's web address (http://localhost:8080/stories.html), not as a saved file.
