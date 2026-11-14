# Furniture functionality upgrade — v7

The house interiors now route their furniture interaction points through `js/core/furniture-interactions.js` rather than showing a generic label only.

## Player interactions
- Fridge: choose a meal or water; items are added to Pocket Storage.
- Cooker / kitchen counter: prepare a meal or make a drink; the result is added to Pocket Storage.
- Sink: wash up and reduce the sanity/stress meter.
- Shower/bath: use the existing bath seat interaction; household shower use is supported by the shared interaction handler when a shower use point is present.
- Television: choose news, movie, or music channel.
- Desk: start a work/study interaction.
- Wardrobe: opens the existing character wardrobe UI.
- Treadmill/gym: starts a workout interaction.
- Yoga mat: starts a calming activity and reduces sanity/stress.
- Piano/instrument: starts a music interaction.
- Bookshelf: starts a reading interaction.
- Existing chairs, sofas, dining seats, beds, toilets, and loungers retain their existing seat/lie interactions.

## Integration
- Shared handler wired into My House, Starter Flat, Duplex and Lagos Flat.
- Existing furniture geometry, seat positions, and room layouts are preserved.
- Service-worker cache bumped to v133; precache rebuilt.

## Validation
Static JavaScript syntax and local import checks are run for this release. Browser/gameplay runtime testing is still required for interaction range, animations, and each house layout.
