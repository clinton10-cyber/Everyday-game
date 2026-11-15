# Performance: NPC draw calls + world geometry cache (SW v155)

Built on main `ead0cdb` (v154). Every item from the "keep" list is untouched (disposer.js, modulepreload block, download link and structured data, pwa.js +6 s, SW 3-parallel/audio-last, visRange tiers, router 16 ms, ui 90 ms, package scripts, workflows, assets/screenshot.jpg). `render.yaml` is not in main, so it is not in this zip either.

## 1. NPC draw calls
* `js/characters/merge-static.js` (new): at NPC build time, meshes that sit directly under the same bone, share the same material object and have identical render flags are baked into one mesh. Bones are untouched, so the animator, `Wardrobe.updateMaterials` (it recolours the shared material objects), hair, hats, held items and phones work as before. userData is carried over (groups with different userData are not merged). Called from `npcs.js` `_build` and `_reskin`. The player avatar is not merged (the wardrobe rebuilds it live). If the family system rebuilds an NPC in place, `tick` detects it (`group.userData._mergedHips`) and merges again.
* `js/characters/npc-lod.js` (new): distance levels. Beyond ~0.3 x range the 10 finger bones are hidden; beyond ~0.6 x range (62 m on high, 60 m medium, 42 m low, from `NPCs.visRange`) the whole pose is baked into one mesh per material and the skeleton stops animating. Only people who are walking or idling are baked (talking, hurt, seated, emoting or dead keep the full skeleton). At most 2 bakes per frame. Coming back in range restores the skeleton.
* Measured headless (Node, 40 random outfits, same triangle count and bounding box before/after, same material objects): **~68-70 meshes per person -> ~48-49 (near) -> ~30 (mid) -> ~8 (far).**

## 2. World build
* `buildPHWorld()` is deterministic (fixed seed), so the result is now built once and reused by city, drive/walk and the story films. Repeat entries cost 0 ms (was ~400-550 ms in Node, more on phones) and create no new geometry objects, so `renderer.info.memory.geometries` cannot grow with repeat visits. Leaving a scene only frees the GPU copy; three.js re-uploads on the next visit. Treat the result as read-only. `clearPHWorldCache()` is exported if memory ever needs to be released.
* `splitByX` rewritten with typed arrays (two passes, no per-triangle arrays). Output checked identical to the old version (positions, normals, colours, indices, bounding spheres).
* First build of a session is unchanged (~470 ms in Node); chunking it across frames needs the three callers to become async, not done here.

## 3. Measuring in the browser
Paste `tools/perf-probe.js` into the DevTools console and run `await __perfProbe()`: it enters the hotel 6 times, then walk 3 times, and prints `renderer.info.memory.geometries` and the median `render.calls` for each visit.
