# v1.3.13 (SW v190)

## Relationship panel: separate button
* The WhatsApp-style chat (`talk-chat.js`) no longer has a "More" button, so it can't open the relationship panel.
* `npc-talk.js`: new **RELATIONSHIP** button next to TALK in `#ph3d-npc-actions`. That HUD is mounted in every exterior and interior scene, so it works everywhere. Family members in homes use the same button.
* `npc-lives.js`: new `Lives.openRelationship(npc)` claims the NPC if needed, closes the chat, opens the full panel.

## Torch is a held object
* `night-tools.js`: a torch model (handle, band, head, lens) is attached to the right-hand grip while the torch is on, fingers close around it. The spot light now comes from the torch head. If a knife/gun is drawn in that hand the torch stays pocketed and the light falls back to chest height.

## Beach + university lag (not measured on a device, see notes)
* University: trees now follow `Quality.treeCount` (was a fixed 260). Weaker tiers use Lambert instead of PBR (`Quality.useLambert`). Merged geometry is chunked per 90 m ground cell so off-screen chunks are culled (before, one chunk's bounding sphere was the whole campus).
* Beach: follows the game's quality tier (was only cores/RAM). Bump map only on high. Fewer large cloud sprites (fill-rate).

## Overlapping buttons (measured in headless Chromium, landscape 844x390 and 667x375; home, city, beach)
* Action chip stack (Go Outside / Actions / Jetpack...) was 434 px wide and reached the screen centre, covering the player: an old `hud.css` grid rule made every chip ~214 px wide, and `--ctx-cols` was 4 on screens >= 800 px. Now a compact 3-column grid of 104 px chips on the right lane (`hud-landscape.css`).
* TORCH button was hidden behind the TALK / RELATIONSHIP bar: moved under it. The bar is a little wider so the labels aren't clipped.
* PWA "Offline mode" toast sat on top of the action chips: moved to the top-centre lane.
* After the changes the probe finds 0 overlapping HUD elements in those scenes.
