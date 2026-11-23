# Lying in the air + NPC fight-back (v1.3.19)

## Lying on the floor (tools/lie-lab.html, `python3 tools/lie_lab_shot.py OUT`)
Measured the lowest point of the body for every way a body ends up lying down (negative = sunk into floor, positive = floating):

| case | before | after |
|---|---|---|
| NPC knocked down ("downed") | **+0.089 floating** | -0.001 |
| pursuer knocked down (limp) | -0.328 | -0.034 |
| dead NPC / player, on back | -0.399 | -0.014 |
| dead, face down | -0.803 | -0.013 |
| dead, on side | -0.817 | -0.106 (arm trapped under the body) |

Causes:
1. `npcs.js` (downed) and `pursuit.js` (down) lifted a lying body by 0.22 m; a body is only ~0.13 m thick -> 9 cm in the air. Now 0.13.
2. `limp.js`: limp limbs "hang toward gravity", which for a lying body is straight down into the floor (arms, legs and head
   went up to 0.8 m below the floor).  `Limp.step` now clamps limbs / head / spine to the floor when the body is lying
   (floor = group pivot - half thickness, or `opt.floorY`), output only so the physics does not jitter.
Applies to NPCs, pursuers and the player's own death pose (all use Limp).  Pictures: `docs/fight-verification/lying-BEFORE.png` / `lying-AFTER.png`.

## NPC fight-back (pursuit.js)
* NPCs picked from *every* move, including suplex, DDT, hip toss, choke slam... thrown at 1.7 m at nobody.  They now throw strikes only
  (jab, cross, hook, elbow, low kick, roundhouse, superkick, clothesline).
* They close to 1.45 m (was 1.7) and feed the real gap to the animator (`wrDist`) so the step-through from v1.3.18 lands the blow.
* Measured contact at 1.45 m, fist/foot to the player's head or knee: jab 0.21, cross 0.27, hook 0.21, elbow 0.31, low kick 0.27,
  roundhouse 0.49 (neck), superkick 0.34, clothesline 0.43 (before: 0.5-1.0 m short, see FIGHT-MOVES-REALISM-v1.3.18.md).

Cache v197 -> v198.  Not play-tested in the live scene.
