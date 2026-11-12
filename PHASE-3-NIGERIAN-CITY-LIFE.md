# Everyday-game — Phase 3: Nigerian City Life

## Added

- Six open-sided roadside bus shelters with roof canopies, posts, benches and route-colour details.
- Six small Nigerian-style roadside kiosks with painted shopfronts, serving hatches, counters and signboards.
- Three marked keke/taxi rank bays with painted separators and rank markers.
- All additions are built into the shared Port Harcourt world geometry, so they appear in the city map and any scene that consumes the shared world.
- City-life details are built as part of the existing merged geometry pipeline; no new runtime dependency or separate NPC system is introduced.

## Preserved

- Existing Port Harcourt landmarks, roads, NPCs, traffic, jobs, combat, economy, housing and saved progress.
- Existing game modules and storage keys.
- Service-worker cache version bumped to v96 so clients fetch the updated world geometry.

## Validation

- JavaScript syntax checked across the project.
- Geometry additions use the existing world builder and palette helpers.
- A live browser/device gameplay run was not available in this environment. Verify the city map and drive/walk scenes on-device, especially the six bus stops and kiosk placements.
