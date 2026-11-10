# assets/audio

All game audio lives here. Every sound goes through `js/core/sfx.js`.

## Folder layout

```
assets/audio/
  sfx/          ← one-shot and looping sound effects
  voice/        ← NPC / player voice lines
  music/        ← background music tracks (theme.mp3 etc.)
```

## sfx/ — required files

### Weapon & combat
- gunshot_pistol.mp3
- gunshot_sniper.mp3
- knife_slash.mp3
- flesh_hit.mp3
- reload_click.mp3
- punch_impact.mp3
- body_fall.mp3

### Damage & player feedback
- hurt_grunt.mp3
- death_rattle.mp3
- pickup_coin.mp3
- pickup_item.mp3
- inventory_full.mp3
- money_deposit.mp3
- money_withdraw.mp3
- purchase_ok.mp3
- purchase_fail.mp3

### Vehicles
- car_engine_start.mp3
- car_engine_stop.mp3
- car_horn.mp3
- car_crash_light.mp3
- car_crash_heavy.mp3
- car_door_open.mp3
- car_door_close.mp3
- car_skid.mp3
- police_siren.mp3
- bike_engine.mp3

### Footsteps
- step_concrete_1.mp3
- step_concrete_2.mp3
- step_concrete_3.mp3
- step_grass_1.mp3
- step_grass_2.mp3
- step_wood_1.mp3
- step_wood_2.mp3

### Doors & environment
- door_open_wood.mp3
- door_close_wood.mp3
- door_open_glass.mp3
- door_knock.mp3
- drawer_open.mp3
- drawer_close.mp3
- fridge_open.mp3
- fridge_close.mp3
- water_running.mp3
- toilet_flush.mp3
- shower_on.mp3
- stove_click.mp3
- sizzle_loop.mp3
- tv_static.mp3
- bed_creak.mp3
- doorbell.mp3

### UI
- ui_tap.mp3
- ui_open.mp3
- ui_close.mp3
- ui_error.mp3
- phone_open.mp3
- phone_close.mp3
- notification_ping.mp3

### Crime & arrest
- handcuff_click.mp3
- jail_door_slam.mp3
- police_whistle.mp3
- ransom_paid.mp3

### Ambience
Handled by `js/core/audio.js` (see below). No bird / rain files are needed.

## voice/ — required files

### NPC greetings
- greet_walker_1.mp3, greet_walker_2.mp3, greet_walker_3.mp3
- greet_trader_1.mp3, greet_trader_2.mp3
- greet_banker_1.mp3, greet_banker_2.mp3
- greet_mechanic_1.mp3
- greet_priest_1.mp3
- greet_doctor_1.mp3
- greet_police_1.mp3, greet_police_2.mp3
- greet_taxi_1.mp3
- greet_inmate_1.mp3, greet_inmate_2.mp3
- greet_warden_1.mp3

### Reactions
- scream_1.mp3, scream_2.mp3
- scream_long_1.mp3
- hurt_1.mp3, hurt_2.mp3, hurt_3.mp3
- death_1.mp3, death_2.mp3
- hostage_grab_1.mp3
- hostage_demand_1.mp3
- hostage_free_1.mp3

### Player
- player_hurt_1.mp3, player_hurt_2.mp3
- player_exhausted_1.mp3

### Police
- police_stop_1.mp3, police_stop_2.mp3
- police_arrest_1.mp3
- police_radio_1.mp3, police_radio_2.mp3

### UI feedback
- level_up_1.mp3
- job_start_1.mp3
- job_done_1.mp3

## Sourcing audio (free, no licensing headaches)

| Source | Use for | License |
|--------|---------|---------|
| freesound.org (CC0 filter) | footsteps, doors, water, birds, UI | CC0 — no attribution needed |
| pixabay.com/sound-effects | gunshots, cars, sirens, crashes, impacts | Pixabay Content License |
| zapsplat.com | UI, purchase, money chimes | Free with attribution |
| elevenlabs.io or murf.ai | All voice/ lines — synthesize 3–6 takes per group | You own the output |

> **Tip:** All files are mono, 64 kbps MP3. A full set is ~2–4 MB.


## Sound pack (sfx/ + ambience/)
All sound effects now come from the **Sound pack** (converted to mono mp3, peak-normalised) in `sfx/`.
File names are `<folder>_<name>.mp3` (e.g. `props_shot01.mp3`, `movement_step02.mp3`, `world_door01.mp3`).
Every game sound key in `js/core/sfx.js` is mapped to these files (several keys use random variants or two layered clips).
To change a sound, edit its line in the `SFX` table at the top of `sfx.js`.

## Ambience (replaces the music themes)
There is no music any more. `js/core/audio.js` plays ONE seamless ambience bed per scene (`ambience/*.wav`:
yard, crowd, hall, quiet, canteen, bathroom) and fires random life sounds (doors, bells, phones,
tannoy, cheers, bottles, ball, metal clangs, shuffles...) panned around you.

| Situation | Beds | Life sounds |
|---|---|---|
| City / drive / walk / outdoors | yard (a little softer at night) | bell, tannoy, phone, doors, ball, bottles, trash, cheer |
| Police dispatched / Hunt | crowd | alarm, buzzer, tannoy, ricochet, whistle, distant shots |
| Ordinary interiors | hall | doors, paper, computer, phone, shuffles |
| Hotel / mansion / showroom / club / market | canteen | cheer, bottles, drinks, cash, cigar |
| Prison / jail | hall + canteen | cell doors, buzzers, tannoy, clangs, jeers, snoring |
| Church / mosque / hospital / classroom / library | quiet | paper, cane taps, soft shuffles |
| Bathrooms / restrooms | bathroom | water, flush |
| Shooting range | yard | shots, ricochets, reloads |
| Rain | crowd noise high-passed into hiss + drops | (weather.js starts it automatically) |

Beds crossfade over 2 s. Settings "Music volume" now controls the ambience level.
Footsteps (concrete / grass / wood) play from the walking code via `Sfx.stepTick`.

## Using your own voice-overs
**NPC dialogue (the speech bubble):** copy `voice/lines.example.json` to `voice/lines.json`.
Each entry is `{ "text": "...", "file": "your.mp3" }` — the bubble shows `text`, the game plays
`file`, so write `text` as the transcript of your recording and they always match.
- Roles: walker trader banker mechanic priest doctor police taxi inmate warden,
  and groups: couple suit_men yahoo_boys mamas school_kids student clerk.
- Roles you don't list keep the built-in lines (spoken by the device voice).
- A missing/blocked file falls back to speaking the same `text`.
- Optional `"gender": "masculine" | "feminine"` ties an entry to NPCs of that look.
- Listing a role REPLACES its built-in lines with yours.

**Sounds with no bubble** (screams, hurt, death, player_hurt, hostage, police, level_up…):
just drop mp3s with the exact names listed in the table above into `voice/`
(e.g. `scream_1.mp3`, `hurt_2.mp3`, `player_hurt_1.mp3`); no manifest needed.

## Voice = text (matching rule)
Every spoken line is paired with the words shown on screen:
- NPC bubbles: the bubble text is what is spoken (or the recording listed beside that text in lines.json).
- No-bubble groups (`police_stop`, `police_arrest`, `hostage_*`): one index picks both the mp3 and its
  transcript, so record `voice/<name>_1.mp3`, `_2.mp3` in the same order as the lines in `SAY` (js/core/sfx.js).
  The game now shows that same line in the toast / notification.
- Job, win and level banners are spoken word-for-word from the banner text (`Sfx.speakText`).

## Wiring recordings to bubble text (automatic)
1. `python3 tools/voice_sheet.py` writes `voice/SCRIPT.md` (every NPC line with its file name) and `voice/lines.json`.
2. Record each line as `voice/<role>_NN.mp3` (e.g. `walker_01.mp3` = "Good afternoon, oga.").
3. Run the script again - lines whose mp3 exists get `"file"` added; the bubble shows the text, the game plays that file.
Lines without a recording are spoken by the device voice, word for word.
