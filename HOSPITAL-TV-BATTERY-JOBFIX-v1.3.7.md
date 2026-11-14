# v1.3.7 — Storeyed hospital, story TVs, phone battery death, job NaN fix

## City Hospital — now 3 storeys (`js/places/hospital/interior.js`)
Entrance is on the north wall; the building runs south. A switchback stair core on the east side joins the floors
(flight A: Ground→1, flight B: 1→2). Floor changes show a toast with the department list.
- **Ground:** reception & triage, waiting lounge with TV, directory board, Emergency bays + doctor consultation (west), pharmacy (east), colour-coded floor guidance lines.
- **Floor 1:** Radiology (X-ray ₦4,000), Laboratory (blood test ₦2,500), doctors' offices, Ward A (TV), Ward B, nurses' station.
- **Floor 2:** Operating theatre (surgeon ₦25,000, full recovery), ICU, director's office, maternity ward, patient lounge (TV).
- Existing services unchanged: triage visit counter, doctor ₦7,500 (+65 HP), pharmacy ₦3,000 medical kit.
- Verified headlessly: every service point and all 41 seats are reachable on all floors, no stair teleports, no walkable cells over floor holes.

## Televisions play the story pages (`js/core/tv-player.js`)
Every "WATCH TV" (houses, flats, hospital, generic interiors, big screens) opens a TV with channels:
CH1 `story-01-the-first-day.html` · CH2 `story-02-the-night-drive.html` · CH3 `story-03-a-pleasure-park-promise.html` ·
CH4 `story-04-the-presidential-suite.html` · CH5 `story-05-the-missing-briefcase.html` · CH6 `stories.html` (guide).
Channel up/down, channel buttons, fullscreen, Esc/turn-off (stops the story and frees the 3D scene). Last channel is remembered.

## Phone battery now matters (`js/core/phone-life.js`, `phone.js`)
- Drain: ~10%/hour idle, ~1%/min with the screen on, small cost per app opened (games/camera more). Bigger-mAh phones last longer.
- Warnings at 20% / 10% / 5%.
- At **0% the phone dies**: apps are locked behind a "PHONE DEAD" screen. Pay to revive it: Quick charge +30% ₦500 or Full charge ₦900 (no credit — not enough money means no phone).
- Offline catch-up drain is capped at 3 hours.

## Job panel NaN fix
Timer/reward/distance in the phone Jobs screen and in-game objective HUD can no longer become NaN (bad `dt`, bad position or stale state are sanitised and repaired).
