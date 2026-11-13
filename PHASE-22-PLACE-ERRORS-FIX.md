# Phase 22 — Place scene errors

Found by building every place interior and exterior in a headless browser; all now build without errors.
These three bugs were already in the Phase 20 files (not caused by the story rebuild).

- courthouse/interior.js: `solid` and `uses` were assigned without being declared (ReferenceError in a module). Now `const`.
- beach/interior.js: `vestOrange` was used by the swimmer before its `const` line ran (temporal dead zone). Declared earlier.
- university/interior.js: the Arts building pediment passed a Mesh to `Batch.add(geometry, material, matrix)`, which crashed the batch flush. Now passes geometry, material and matrix.

Service worker cache bumped to v124.
