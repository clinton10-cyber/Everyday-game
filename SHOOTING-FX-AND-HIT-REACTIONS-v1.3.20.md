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
