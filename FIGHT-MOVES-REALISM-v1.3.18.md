# Fight moves: recorded + realism pass (v1.3.18)

## Recording (new tools)
* `tools/fight-lab.html` plays every move on two real avatar rigs with the game's own animator
  (attacker emote + `vic_` victim emote, carry path, limp physics).  `?moves=jab,cross`, `?gap=1.2` (stand-off), `?video=1`.
* `python3 tools/fight_lab_shot.py OUT [moves] [cols] [gap]` -> contact sheet + `contact.json` / printed table
  (distance from the striking fist/elbow/foot to the victim's head/torso/knee at the impact frame).
* `python3 tools/fight_lab_video.py OUT [moves] [slowdown]` -> one slow-motion mp4 per move (side + front view) and `ALL-MOVES-reel.mp4`.
* Committed recordings: `docs/fight-verification/` (3 contact sheets + `videos/`, 19 clips).

## What the recordings showed, and the fix
1. **Strikes did not reach the target.** At the stand-offs the game uses, fists/elbows/feet stopped 0.3-0.85 m short and
   0.25-0.5 m below the head.  `wrestling.js` `mk()` now closes the *real* gap: each strike has a reach `r0`, and the hips step
   through whatever distance is left at impact (and give ground when too close).  Arms were raised to face height
   (jab, cross, hook, elbow); roundhouse / superkick raised to the head / neck; clothesline raised to neck height.
2. **Knocked-down victims floated.** Single leg, spear, body slam, hip toss and choke slam left the victim tilted but with the
   hips at standing height.  Victim hips now drop to the floor at the knock-down frame and the body lands on its back
   (hip toss now rolls over the hip and lands supine instead of ending upside-down).

## Measured contact at impact (wrist/elbow/ankle to target centre, metres)
| move | gap | before: dist / short / low | after: dist / short / low |
|---|---|---|---|
| jab | 0.9 | 0.44 / 0.27 / 0.34 | 0.16 / 0.01 / 0.15 |
| cross | 0.9 | 0.54 / 0.30 / 0.40 | 0.23 / 0.01 / 0.14 |
| hook | 0.9 | 0.42 / 0.33 / 0.25 | 0.16 / 0.04 / 0.15 |
| elbow | 0.9 | 0.64 / 0.44 / 0.47 | 0.29 / 0.01 / 0.29 |
| low kick (leg) | 0.9 | 0.47 / 0.41 / 0.19 | 0.22 / 0.04 / 0.19 |
| roundhouse | 1.1 | 0.96 / 0.17 / 0.89 | 0.49 / 0.09 / 0.46 (neck/shoulder) |
| superkick | 1.15 | 0.58 / 0.01 / 0.46 | 0.34 / 0.10 / 0.24 |
| clothesline | 0.98 | 0.65 / 0.09 / 0.51 | 0.43 / 0.05 / 0.31 |
At a 1.5 m stand-off the punches still land within 0.2-0.3 m (before: 0.8-1.0 m).

Not changed: hit-stop, damage, combo timings, button chords, NPC AI.  Not yet exercised in the live game scene
(the lab uses the same animator + move tables, but not the full combat loop).
Service worker cache v196 -> v197.
