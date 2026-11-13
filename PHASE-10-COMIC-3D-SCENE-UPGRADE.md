# Everyday-game — Phase 10: 3D Comic Scene Upgrade

## Comic reader changes
- Replaced the flat SVG placeholder panels with locally rendered Three.js scenes.
- Each scene uses faceted, low-poly 3D characters with visible clothing, faces, limbs and story props.
- Built genre-specific cinematic interiors and sets: superhero operations/relay rooms, science-fiction labs and ship rooms, fantasy halls, horror corridors, noir detective offices, and adventure temples/ruins.
- Scene captions and speech bubbles remain attached to the relevant story beat so readers can connect the image to the plot.
- Scene panels use a large 16:9 presentation. `OPEN LARGE SCENE` opens an immersive full-screen viewer.
- The camera is fixed and cannot be rotated. The viewer offers limited zoom-in/zoom-out framing only.
- `CAPTURE TO GALLERY` saves the actual rendered 3D scene image to the game's existing Gallery/Photos library.
- The motion-comic player now renders the same 3D scenes while advancing through the story.
- No remote artwork is required for comic scenes; they are generated locally with the bundled Three.js engine.

## Performance and storage
- Scenes use low-poly meshes, simple lighting, no real-time shadows and a capped renderer pixel ratio for mobile devices.
- Renderers are disposed when comic pages/player scenes are replaced or closed.
- Gallery captures use the existing local photo storage; no account or backend is required.
- Existing comic catalogue, dialogue, favourites and reading progress remain intact.

## Validation
- JavaScript syntax checks passed for the updated comic modules.
- Service worker cache version advanced and the new module is included in the regenerated offline precache.
- ZIP integrity checked after packaging.
- A live visual playtest on a physical Android device is still recommended for GPU/performance verification.
