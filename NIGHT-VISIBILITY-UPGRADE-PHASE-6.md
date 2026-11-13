# Everyday-game — Night Visibility Upgrade (Phase 6)

## Player flashlight
- Toggle with the on-screen TORCH button or the `T` key.
- The beam follows the on-foot character direction and aim pitch.
- Includes a focused warm spotlight and a small nearby fill light.
- Torch preference is remembered locally.
- It can be used whenever needed, not only at night.

## World lighting
- Existing day/night clock and dusk/dawn transitions are retained.
- Existing road/city and university lamp placement is retained.
- Beach promenade now has warm streetlamps and visible ground-light pools.
- Streetlight pool uses six nearby pooled point lights with a wider radius, limiting simultaneous lights for mobile performance.
- Streetlights automatically switch on around dusk and off around dawn.

## Offline
- No backend or internet connection is required.
- Added module is included in the regenerated PWA precache list.
- Service-worker cache version bumped to v108.
