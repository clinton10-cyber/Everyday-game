# Phase 15 – UNIPORT & Pleasure Park NPC Population

## UNIPORT
- Added visible, talkable NPCs inside all 17 campus buildings, using each building's central corridor so the characters are placed within the existing walkable building shells.
- Faculty buildings receive students; Senate receives an administrative clerk; the health faculties receive medical staff; the library, student union and hostels receive context-appropriate staff/visitors.
- Added campus foot traffic around the central quad and walkways.
- NPCs have dynamic TALK interaction markers that follow their live positions.
- NPC population is reduced on low-quality devices to protect performance.

## Pleasure Park
- Added visitors, students, attendants and vendors around the entrance, Ferris wheel, roller coaster, carousel, splash park, amphitheatre, food village and garden areas.
- NPCs use the existing character, dialogue and life systems and can be approached and talked to.
- Dynamic TALK markers follow moving NPCs.
- Population scales down on lower graphics tiers.

## Technical
- Existing NPC models, dialogue and animation systems are reused; no placeholder human meshes were introduced.
- NPCs are spawned and updated in the destination scene, then despawned when leaving it to avoid cross-scene character leaks.
- Service-worker cache version bumped to v117.
