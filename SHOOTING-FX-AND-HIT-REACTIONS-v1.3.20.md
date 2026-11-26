# Dramatic shooting, per-body-part hit reactions, tougher NPCs (v1.3.20)

## Shooting effects (`js/core/shot-fx.js`, called from `guns.js` `_doFire`)
* Muzzle: star flash + forward fire jet + rising smoke (bigger for shotgun / sniper).
* Tracer streak to the impact point (5 pellet streaks for the shotgun).
* Impacts: flesh (blood + mist), head (big burst, bone fleck, red flash), hard surface (sparks, dust, chips), ground (dust kick).
* Screen kick + zoom punch on the `#app canvas` (never touches the game camera), red vignette on headshot / kill.
* Crosshair hit-marker (white = body, gold = head, red = kill) and floating damage numbers.
* Small synthesized thump / crack / bone-pop layered over `Sfx`.

## Hit reactions (`js/characters/hit-react.js`, via the animator's `ctl._overlay` hook)
* Joints are damped springs; a bullet kicks them depending on **body part, side hit, direction of travel, damage**.
* 21 clips: head (snap back / side / cover head / whiplash), torso (fold / arch / twist / hold ribs / stagger),
  arm (jerk / swing back / spin / flail), leg (buckle / kick out / hop / trip / drop to knee), foot (hop-hold / ankle give / stomp back).
* Some arm / leg hits **dislocate** the limb (more likely with shotgun / sniper and with repeated hits on the same limb):
  arm hangs out and twisted with the forearm limp while the other hand clutches it; leg is splayed, knee bent, NPC walks with a hitch.
  Pops out with a snap, slides back in after ~25 s.
* Badly hurt NPCs (<35 % hp) hunch, hold their belly and stumble now and then.
* Killed NPCs are thrown the way the bullet travelled.
* `npcs.js` / `pursuit.js` pass the bullet direction + exact impact point (`onHit(dmg, type, part, {dir, point})`).

## NPC lives
* Civilians 220 hp (+-15 %, 12 % are bruisers x1.45), police 340-400 (was 60 for everyone).
* Roughly: pistol ~9 body shots, rifle ~7, sniper 3, headshots 2-3.

SW cache v221 -> v222. Not play-tested in the live scene (the reaction maths was simulated headlessly: 375 hits, no NaN, bounded joints, all settle).

## Bullet-driven death + ragdoll (v1.3.21, `js/characters/death-physics.js`)
The killing shot now decides how the body falls (street NPCs; other kills keep the old tip-over):
* **Direction** = the way the bullet travelled, bent toward open space; slows down / bounces if walls are close.
* **Head**: head snaps along the bullet, chest folds the other way, arms fly out, body slides back.
* **Torso**: thrown back; shotgun / sniper launch the body into a hop and a long skid.
* **Arm**: the shot is off-axis, so real torque spins the body as it falls (pirouette), arm whipped along the bullet.
* **Leg / foot**: legs swept out - hop, then the body collapses sideways over the injured leg and rolls onto its side.
* Landing: small rebound, friction skid, dust + blood splat, thud, screen jolt if the player is close.
* Limbs are the existing `Limp` ragdoll, now kicked joint-by-joint from the bullet (`Limp.impulse`), and they react to the body's real motion.
SW cache v222 -> v223. Headless sim: 5 parts x 4 weapons x 120 falls - all settle flat, none under the floor, no NaN.

## Blood no longer looks solid (v1.3.22)
Cause: droplets "landed" at the height they were born (the hit point, ~1 m up), so they hovered as opaque 6 cm balls; they stayed 100 % opaque, and the ground stain was a plain disc.
* Droplets now fall to the real floor (`floorY`) and stick as flat stains; sparks still bounce.
* Streaks stretched along their velocity, mostly fine drops with a few fat ones, semi-transparent, shrink away instead of popping out.
* Bullet hits spray along the bullet direction (exit spray) + a thin entry mist back at the shooter; the red haze puffs are thinner and shorter.
* Ground stain is an irregular blotch with satellite drops that spreads out over ~1 s, at the body's own floor height. One stain per kill (no more stacked duplicates).
* The old omnidirectional burst now only plays for non-bullet damage.
SW cache v223 -> v224.
