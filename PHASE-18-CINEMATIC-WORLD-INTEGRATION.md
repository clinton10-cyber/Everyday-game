# Phase 18 — Cinematic Stories Use the Actual Everyday World

The five story films have been upgraded so they no longer build generic miniature stand-in locations or simplified mannequin characters.

## Shared game assets now used
- `js/world/phworld.js` via `buildPHWorld()` for the actual Port Harcourt world mesh, roads, trees and landmark buildings used by the game.
- `js/characters/faceted.js` via `buildFaceted()` for the same detailed faceted character system used by the game.
- `js/places/pleasurepark/exterior.js` for the actual Pleasure Park exterior scene.
- `js/places/hotel/interior.js` for the actual Hotel Presidential interior.
- `js/places/classroom/interior.js` for the actual classroom interior.
- `js/places/realestate/interior.js` for the actual property-office interior.
- Existing Range Rover and Bugatti Chiron builders remain connected through each story page.

## Camera direction
Each act now uses a moving 3D camera sequence: high establishing crane, lateral tracking dolly, then a close orbit/push-in. Camera targets follow the lead character, and the camera moves continuously while the scene is playing.

## Story files
The five existing root HTML files are retained and now await the asynchronous loading of the game's real interior builders:
- `story-01-the-first-day.html`
- `story-02-the-night-drive.html`
- `story-03-a-pleasure-park-promise.html`
- `story-04-the-presidential-suite.html`
- `story-05-the-missing-briefcase.html`

## Notes
These are real-time 3D cinematic sequences, not pre-rendered MP4 videos. The scenes use existing procedural Three.js world/character/vehicle assets from Everyday-game. Browser speech synthesis remains the narration method. Visual playback still needs physical Android testing on the target device.
