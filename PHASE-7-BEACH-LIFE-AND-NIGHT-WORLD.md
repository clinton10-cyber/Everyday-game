# Phase 7 — Beach Life & Night World

Built on the Phase 6 Night Visibility Upgrade.

## Beach leisure
- Colourful beach umbrellas and matching loungers.
- Sculpted sand castles.
- Four beach balls registered with the existing carry/pick-up/drop/throw system.
- Animated swimmer NPCs moving through the shallow water with visible life vests.
- Player swimming zone with slower movement, buoyancy bob and a swim-area HUD.
- Player life-jacket toggle and visible rental rack. A life jacket modestly improves swim movement speed.

## Night lighting
- Governor's House perimeter/terrace lamps and night glow pools.
- VastCity road-grid lamps and night glow pools.
- Vatican square lamps now have visible night glow pools.
- Mile 1 Market aisle/perimeter lamps and night glow pools.
- Government House participates in the outdoor dusk/night cycle.

## Technical
- Uses the existing Three.js bundle, ThirdPersonControls, DayNight and StreetLights systems.
- No new network services or external assets required.
- Service worker cache bumped to v109.
- Local game progression remains local.

## Validation
- JavaScript syntax checks passed for all modified modules.
- ZIP integrity checked after packaging.
- Visual playtesting in a running browser/game build is still recommended, especially for swim shoreline tuning and light placement.
