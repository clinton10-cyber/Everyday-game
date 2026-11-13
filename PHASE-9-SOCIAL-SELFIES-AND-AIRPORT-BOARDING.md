# Phase 9 — NPC Social Selfies & Airport Boarding

## Garden City Connect
- NPC feed photos are captured from the live 3D NPC character in the current game scene using the game's free-camera photo capture.
- Each NPC uses the same captured image for its post and a cropped profile avatar.
- Legacy NPC posts using stock portrait/city-photo URLs are filtered from the feed on load; NPC posts are not fabricated with unrelated stock faces.
- The player profile uses the latest in-game Gallery photo when available.
- NPC images are compressed before local persistence to limit local-storage usage.

## Omagwa Airport boarding flow
1. Check in at the terminal counter and pay the simulated ₦25,000 fare.
2. Receive a locally saved Garden Air boarding pass (Port Harcourt → Lagos, Gate A04).
3. Complete security screening.
4. Proceed to Gate A04 and board the aircraft.
5. The game routes the player into the walkable Boeing 787-9 cabin with passenger NPCs.

The booking state is stored locally. No online service or real airline booking is involved.

## Aircraft cabin windows
- Each passenger window has a separate sky-and-wing view with slowly drifting cloud texture.
- The player can approach a window seat and use the interaction button to lower or raise the inner window shade.
- Aircraft windows remain sealed, reflecting real aircraft safety; the interaction is the cabin shade, not opening a pressurised aircraft window.
- Existing seats and passenger NPC navigation are retained.

## Validation
- JavaScript syntax checked for the modified social panel, airport interior, aircraft scene and service worker.
- Service worker cache version bumped to v111.
- Live browser/WebGL gameplay testing remains necessary for visual placement and interaction tuning.
