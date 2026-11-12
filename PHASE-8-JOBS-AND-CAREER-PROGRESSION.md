# Phase 8 — Jobs and Career Progression

Phase 8 adds a long-term professional career system alongside the existing rotating gig-job board. Existing delivery, taxi, repair and other short jobs remain available and unchanged.

## Career paths
- Corporate office
- Teaching service
- Civil service
- Police service
- Military service
- Banking and finance
- Engineering
- Healthcare service

## Career loop
1. Improve the player's CV and professional training.
2. Apply for a career, subject to reputation, criminal-record rules and an in-game application fee.
3. Attend an interview. The result uses reputation, CV level, training level and a small random interview factor.
4. Clock in for a 60-second real-time career shift.
5. Complete the shift to receive the role's in-game salary and a 5% pension contribution.
6. Earn automatic promotions at 3, 7, 12 and 20 completed shifts, with a 15% salary increase at each promotion.
7. Become eligible to retire after 30 completed shifts and collect the accumulated fictional pension.

## Persistence and integration
- Career state is saved in the existing local player profile through `Auth.save`.
- Salary and training costs use the existing `Economy` system.
- The Career app is available from the in-game phone.
- The existing gig-job board and JobShifts system are not replaced.
- All jobs, salaries, application fees and pension values are fictional in-game values.

## Validation
- JavaScript module syntax checked.
- Career app phone tile, route and container checked.
- Precache manifest regenerated to include the new career modules.
- Service-worker cache version bumped for this release.
