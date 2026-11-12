# Phase 9 — Crime, Police and Justice

Phase 9 adds a persistent legal/court simulation on top of the game's existing crime alerts, police dispatch, robbery, gang, arrest and prison systems.

## Features
- New Justice application on the in-game phone.
- Incident-based case files with charge labels and severity.
- Player arrests move an open case into an awaiting-court state.
- Paid legal representation and defence preparation.
- Court hearings with simulated acquittal, reduced conviction/fine, or conviction outcomes.
- Outstanding fine payment and a three-step community-service alternative.
- Bail access through the existing prison system.
- Cooldown-limited prison workshop allowance while detained.
- Persistent case history, hearing counts, convictions, acquittals and fines.
- Convictions are added to the existing player criminal-record profile where an authenticated profile is available, affecting careers that require a clean record.

## Integration and safety
- Existing robbery, police pursuit, alert decay, prison scene and career systems are preserved.
- All legal and criminal activity is fictional gameplay using in-game currency; it is not real-world legal advice or instruction.
- The Justice service hooks into existing crime-event and player-arrest events instead of replacing those systems.

## Testing
- JavaScript syntax validation and ZIP integrity checks are included in the release process.
- Actual gameplay testing remains necessary on desktop and mobile, especially the arrest → case → hearing → fine/bail/release flow.
