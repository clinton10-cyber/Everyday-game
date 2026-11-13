# Phase 19 — All Comics Use the Actual Everyday-game World

## What changed
- Removed the genre-based SVG/primitive comic illustration fallback from the Comics reader.
- Every catalogue comic now renders its active page through the same cinematic engine used by the game's story films.
- The cinematic engine uses the actual Port Harcourt world geometry (`js/world/phworld.js`) for city scenes.
- UNIPORT scenes use the actual detailed university campus builder; Pleasure Park and Hotel Presidential use their existing 3D location builders; hotel, classroom and office scenes use their existing interior builders.
- Comic people use the actual detailed faceted character builder (`js/characters/faceted.js`).
- Vehicle scenes use the existing Range Rover 3D model when the page text calls for a vehicle/road journey.
- Every page now has a moving 3D camera sequence: aerial/establishing movement, tracking movement, closer character framing and a final push-in.
- The comic reader displays one active page at a time with previous/next navigation. This keeps mobile GPU and WebGL context use manageable while retaining the full comic and motion-comic playback.
- Large-scene viewing and Gallery capture use the same real-world 3D renderer.
- Added a cinematic-only flag to UNIPORT and Hotel interior builders so comic playback does not despawn or overwrite live gameplay NPCs or initialise live hotel services.

## Location selection
Each page is classified using its own text first, then its comic title. It selects UNIPORT, Pleasure Park, Hotel Presidential, classroom, office or the Port Harcourt city world as appropriate. All other stories still use the actual Port Harcourt world rather than unrelated generic fantasy rooms.

## Validation
- JavaScript syntax checks are run across the project.
- Offline precache regenerated.
- Service worker cache version bumped to v121.
- ZIP archive integrity checked.
- Live Android/WebGL visual playback still requires device testing.
