# Phone lock screen and furniture usage audit

## Phone lock screen
- Added a lock screen that appears whenever the in-game phone is opened.
- Shows current device time and date, a notification card, camera/shortcut styling, and an unlock control.
- Supports tapping **UNLOCK PHONE** or swiping upward.
- Includes a close control so the player can dismiss the phone without unlocking.
- Existing apps and their routing remain intact behind the lock screen.

## Furniture helper audit
The audit scanned the exported furniture helper functions in `js/core/furniture.js` for direct call sites elsewhere in the JavaScript source. This is a static reference scan, not proof that a model is absent at runtime: some scenes use namespace imports, aliases, generated layouts, or their own custom furniture meshes.

### Exported helpers with no direct call site found
- `fBed`
- `fNightstand`
- `fWardrobe`
- `fDresser`
- `fToilet`
- `fVanity`
- `fShower`
- `fBathtub`
- `fFireplace`
- `fMirror`
- `fYoga`
- `fDumbbell`
- `fDoorFrame`
- `fPoolBasin`
- `fShowPlinth`
- `fStage`
- `fPlaySlide`

These are currently **unreferenced helper exports**, not confirmed visible-but-unusable furniture in the game. They should not be deleted: some may be intended for future interiors or called through indirect patterns.

### Existing interaction coverage in the shared furniture library
- Seating/resting: beds, sofas, armchairs, chairs, benches, cinema seats, loungers, toilets, showers, bathtubs, yoga mats.
- Actions: kitchen/stove cooking, sink washing, fridge access, desk work, wardrobe use, bookshelf reading, treadmill running, dumbbell lifting, piano playing.
- Several decorative pieces (rugs, plants, paintings, lamps, windows, coffee tables, dining tables, consoles, screens) are intentionally decorative and do not currently expose a player interaction in the shared helper.

### Recommended next audit stage
Inspect each interior's actual placement list and compare visible furniture against `Builder.seats` and `Builder.uses`, then add context-appropriate interactions to any placed furniture that should be usable. A source-only helper scan cannot safely infer world placement or player reachability.
