# Everyday-game — Comic Illustration and Motion Comic Upgrade

## Features
- Replaced text-only comic reading panels with original, locally-rendered vector comic illustrations.
- Added genre-specific visual treatments for Superhero, Science Fiction, Fantasy, Horror, Crime / Noir, and Adventure.
- Added speech bubbles to every story scene, with scene narration beneath each illustration.
- Added a `WATCH COMIC AS VIDEO` play button and a full-screen motion-comic player.
- Motion-comic playback automatically advances through each story scene, with pause/play, previous, next, progress indicator, and close controls.
- Reading progress and favourites continue to use the existing comic library storage.
- No external image or video downloads are required; comic artwork is generated locally in the UI as SVG.

## Playback note
The play button launches an in-game motion-comic slideshow with timed scene transitions and speech bubbles. It is not an exported MP4 file.

## Validation
- `js/ui/comics-panel.js` passed Node syntax validation.
- Project precache regenerated to include the updated comic reader.
- Service-worker cache version advanced to v104.
