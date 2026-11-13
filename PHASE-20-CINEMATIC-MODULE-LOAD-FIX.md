# Phase 20 — Cinematic module loading fix

- The cinematic player now imports the bundled Three.js module by an explicit relative path.
- The real-estate interior uses the same explicit bundled Three.js path.
- The real-estate interior no longer eagerly imports the full third-person gameplay controller and property UI. Those modules load only during normal gameplay; cinematic playback uses a no-op controller while preserving the exact interior geometry.
- This prevents a cinematic scene from pulling dozens of unrelated gameplay modules into a dynamic import chain.
- Service-worker cache version bumped to v122.

The cinematic room continues to be built by `js/places/realestate/interior.js`; it is not replaced with a generic mock room.
