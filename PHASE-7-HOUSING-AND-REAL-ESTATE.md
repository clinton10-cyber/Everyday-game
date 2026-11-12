# Phase 7 — Housing and Real Estate

Phase 7 adds a persistent real-estate management system to Everyday in PH.

## Features
- Purchase five property types in Port Harcourt-inspired neighbourhoods: single room, self-contained apartment, two-bedroom flat, detached duplex and luxury mansion.
- Own multiple properties, toggle tenant occupancy, collect rent and sell properties at a condition-adjusted resale value.
- Upgrade properties through five levels; upgrades increase rental yield and restore condition.
- Buy three land plot types and develop them through foundation, structure and finishing stages.
- Spend in-game currency on repainting, furnishing and security improvements.
- Property portfolio dashboard in the phone's new Property app.
- Persistent local save state and rental accrual while offline, capped at seven days. One rent cycle is 30 minutes.

## Integration
- Added `js/core/real-estate.js` and `js/ui/property-panel.js`.
- Added Property icon and app container to the phone UI and wired its route.
- Existing HomeProg furniture/home progression remains intact; the new property portfolio complements it rather than replacing it.

All purchases and income are fictional in-game currency. Property locations, prices and rental values are game data, not real-world listings.
