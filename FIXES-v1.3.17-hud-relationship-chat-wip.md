# v1.3.17 (work in progress)

## Pick-up prompt
* `css/hud-landscape.css`: the "[E] Pick up" prompt now sits in the centre lane (between joystick and action chips) and wraps, instead of being centred on screen over the chips and the player. Measured in headless Chromium at 844x390: overlapping HUD elements 2 -> 0.

## Relationship
* City HUD: new Relationship chip beside Talk when someone is in reach (`scenes/drive.js`, `ui/hud.js`, `css/hud-landscape.css`).
* WhatsApp chat (`ui/talk-chat.js`): the three-dot menu and the commands /relationship, /rel, /panel open the relationships panel for the current contact. Not yet exercised in the browser.

## Bugs
* `scenes/drive.js`: JobObjectives.init used an out-of-scope `roads` (ReferenceError); now `city.roads`.
* `core/thirdperson.js`: dispose() now removes the Jetpack/Wings button, which leaked from the home scene and showed as a duplicate chip in the city.

## Not done yet
* Object carrying: no changes. Needs a per-object simulation with screenshots.
