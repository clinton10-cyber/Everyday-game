# Everyday-game — Phase 5: Story Missions and Campaign

## Added

- A Story app on the in-game phone with a six-chapter campaign set around Port Harcourt.
- Named contacts, mission briefings, short dialogue scenes, locations, objectives and chapter rewards.
- A progress tracker and claim-reward flow. Progress is earned through normal gameplay events rather than by opening the mission screen.
- Campaign progress and claimed chapters are stored in a separate versioned local-storage key (`ph3d_story_campaign_v1`).
- Job completion events feed delivery/taxi/repair objectives.
- Business purchase, business collection and business upgrade events feed the relevant campaign objectives.
- Story reward payments use the existing in-game Economy transaction system.

## Chapters

1. A Fresh Start — complete one job.
2. Earn Your Name — complete three additional jobs.
3. A Business of Your Own — purchase a business.
4. The First Profit — collect business earnings.
5. Growing Pains — upgrade a business.
6. Respect in the City — complete five additional jobs.

## Integration and fixes

- Added the missing `app-business` phone container so the Phase 4 Business app can mount and display correctly.
- Added the Story phone icon, app route and lazy-loaded Story panel.
- Added event hooks to the existing job and business systems without replacing their underlying gameplay logic.
- Bumped service-worker cache version from v97 to v98.
- Regenerated `precache.json` to include all new modules.
- Kept all existing Phase 1–4 files and storage keys.

## Validation

- JavaScript syntax checked for the new modules and all modified integration modules.
- Integration assertions verified the phone route, event hooks and precache entries.
- ZIP archive integrity test passed.
- Full live gameplay/browser testing was not available in this environment. Please test job completion, campaign progression, business objectives, reward collection and persistence on your device.
