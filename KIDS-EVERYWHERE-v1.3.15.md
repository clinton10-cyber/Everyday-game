# v1.3.15 - Children in every public scene

- scene-life.js: new ensureKids() keeps a minimum number of children (potato 2, low 3, mid 4, high 5) in every scene that gets ambient NPCs, spawned 7-27 m from the player, on all quality tiers. Runs on scene entry and every 7.5 s top-up.
- Kids get a child identity (size 38-100% by age) via the existing _wantKid / npc-lives claim path.
- beach, forest, airport and large-area scenes now include school_kids in their role mix.
- npcs.js: street kids are no longer skipped on potato tier; groups are 1 (potato) / 2 (low) / 3 (normal).
- SW cache v192, package 1.3.15.
