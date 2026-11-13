# Phase 11 — Unique phone application interfaces

This phase applies distinct product identities to the previously generic phone apps while retaining the existing game systems and offline/local-storage architecture.

## Included
- Camera: dedicated dark camera surface, segmented Scene/Selfie modes, large shutter, selfie pose controls and real game-frame/selfie capture retained.
- Gallery: dark media-library presentation, photo grid, 3D album entry and device-save/delete controls retained.
- Map: map-coloured navigation launch surface; the existing full city MapApp remains the actual map experience.
- Weather: dedicated Port Harcourt weather presentation with seasonal conditions, forecast strip, humidity/wind/ground status and existing season controls.
- Music: replaced the fake track/play button with an honest city-soundscape player surface connected to the existing AudioSystem mute and volume controls. No licensed music tracks are claimed or fabricated.
- Inventory: pocket-storage layout, capacity meter, item grid and selectable item detail view. Existing inventory data is used; no fake item actions were added.
- Shop: dedicated warm retail palette and category controls; existing food, weapon and limited-fashion purchase logic retained.
- Police: dispatch/control-room visual treatment and existing dispatch/crime-log logic retained.
- Health: clinical teal treatment and existing HP, alert, medkit and hospital actions retained.
- Players: redesigned as a City People directory showing computer-controlled NPCs from `NPCs.list`, not simulated online humans. It explicitly distinguishes NPCs from future online multiplayer.
- Hunt: rugged contract-board presentation; existing Hunt tiers, reputation locks, confirmations, cash-out/abandon flow, leaderboard and achievements retained.
- Settings/About: dedicated system-settings and game-information surfaces.
- Launcher icons now use app-specific gradients for the redesigned apps.

## Important scope notes
- The Players app lists NPCs spawned in the current scene. It is not a 500-player online multiplayer implementation.
- Music controls the existing procedural/location-aware ambience system. The game currently has no licensed song catalogue, so the UI does not pretend to stream songs.
- The Map app delegates to the existing full-screen MapApp rather than duplicating its navigation engine inside the phone shell.
- Camera captures actual game frames and actual player selfies using the existing Photos module.
- No existing save data or core gameplay system was intentionally reset.

## Validation
- `node --check` passed for every JavaScript file.
- ZIP archive integrity checked after packaging.
- Physical Android visual testing is still required.
