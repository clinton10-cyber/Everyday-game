# v1.3.17 (work in progress)

## Pick-up prompt
* `css/hud-landscape.css`: the "[E] Pick up" prompt now sits in the centre lane (between joystick and action chips) and wraps, instead of being centred on screen over the chips and the player. Measured in headless Chromium at 844x390: overlapping HUD elements 2 -> 0.

## Relationship
* City HUD: new Relationship chip beside Talk when someone is in reach (`scenes/drive.js`, `ui/hud.js`, `css/hud-landscape.css`).
* WhatsApp chat (`ui/talk-chat.js`): the three-dot menu and the commands /relationship, /rel, /panel open the relationships panel for the current contact. Not yet exercised in the browser.

## Bugs
* `scenes/drive.js`: JobObjectives.init used an out-of-scope `roads` (ReferenceError); now `city.roads`.
* `core/thirdperson.js`: dispose() now removes the Jetpack/Wings button, which leaked from the home scene and showed as a duplicate chip in the city.

## Object carrying (new)
Replaced the single hand table in `js/core/player-actions.js` with grip styles (fist_up, phone, palm_flat, hang, shoulder, hug2) and a profile per object type. Each profile sets the grip point on the object, how it is rotated in the hand, a speed multiplier and a lean. Unknown items (market goods, pocket items) are classified by their scaled size and an optional `userData.carryHint`.
* Object orientation is fixed once at pickup, relative to the torso, so nothing is held sideways or embedded in the palm.
* Crates are carried with both hands, one on each side, solved so the palms sit on the box.
* Arm swing is reduced while carrying, and held items stay posed while seated (`drive.js`).
* The pickup glow ring is hidden while an item is in hand (`world-objects.js`).
* Carry slowdown now also applies in the home and interiors (`thirdperson.js`).
* Emoji removed from the item toasts and pickup prompt.

Walk speed with the item held, as a ratio of empty-hand speed (city): bottle 0.98, food 0.97, junk food 0.97, water/money/phone/cigarettes/spray can 1.00, book 0.98, bat 0.95, bag 0.92, dumbbell 0.80, crate 0.55.

Changed files: `js/core/player-actions.js`, `js/core/world-objects.js`, `js/scenes/drive.js`, `js/core/thirdperson.js`.

### Checked by screenshot (844x390, Chromium headless)
All 13 object types in idle (close-up and full), walk, run, jump, sit, crouch, drop and throw, before and after (`contact-sheet-BEFORE.png`, `contact-sheet-AFTER.png`). About 15 market items and 6 pocket items (`contact-sheet-MARKET-POCKET.png`).
HUD overlap probe with an item held, a pickup prompt showing and an NPC in talk range (bottle, dumbbell): 0 overlaps. Held bottle, crate, bat, bag with NPC nearby: 0 overlaps.

### Not verified
* 1080x486 was not tested.
* Walk speed in the home and interiors was not measured cleanly (noisy baseline). The code change is in, but no figure is claimed.
* Eating and drinking gestures after the new wrist and orientation were not re-checked by screenshot.
* Pistol and gun items were not covered.
* Only about 15 of the 65 market items were sampled.
* The pocket items were captured before the last small-valuables profile edit and were not re-captured.
* Emoji still exist in other UI (pocket icons, Lives panel); not touched.
* In the final overlap run, the Talk and Relationship chips did not appear in every case because the test NPC was not always counted as in range. The earlier run with crate and bag held and the chips showing also gave 0 overlaps.
