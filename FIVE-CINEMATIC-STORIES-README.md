# Everyday – Five 3D Cinematic Stories

Five standalone story pages have been added to the project root:

1. `story-01-the-first-day.html` – a new student's first day at UNIPORT.
2. `story-02-the-night-drive.html` – a late-night Port Harcourt road incident.
3. `story-03-a-pleasure-park-promise.html` – two friends spend a day at Pleasure Park.
4. `story-04-the-presidential-suite.html` – an entrepreneur's important hotel meeting.
5. `story-05-the-missing-briefcase.html` – a short city mystery.

## How to play

Open any story page through the same web server used to run Everyday-game (for example, your hosted game URL followed by the HTML filename). Do not open the page using a `file://` URL because browser ES modules and local asset imports require an HTTP server. Use landscape orientation for the best view. Tap **PLAY STORY** to begin; this also enables optional spoken narration where the browser supports speech synthesis.

## Project dependencies

The pages use the project's local Three.js build (`vendor/three/`), procedural faceted characters from `js/cinematics/story-player.js`, and existing detailed vehicle builders in `js/vehicles/`. They create their own cinematic sets and interiors and do not alter the main game save data. The vehicle, character and environment models are rendered in real time; these are interactive 3D story films, not pre-rendered MP4 files.

The shared player is `js/cinematics/story-player.js`. Keep that file and the existing `js/vehicles/` and `vendor/three/` folders in place when copying the five HTML files into another copy of the project.
