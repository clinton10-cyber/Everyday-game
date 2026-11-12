# Everyday-game — Phase 4: Business Ownership

## Added

- A new Business app on the in-game phone.
- Four purchasable businesses: Provision Store, Food Canteen, Fashion Boutique and Phone Accessories.
- In-game business ownership, with purchase costs deducted from the player's wallet.
- Stock inventory and paid restocking.
- Employee hiring (up to three employees per business) with an upfront hiring cost and recurring simulated operating cost.
- Business upgrades (up to level five), increasing sales capacity and revenue.
- Passive sales cycles: one simulated business day every five real-time minutes. Sales require stock; stock runs out and must be replenished.
- Accrued business profit ledger and explicit collection into the player's in-game wallet.
- Business portfolio, lifetime business earnings, stock, employee, level and sales statistics.
- Persistent ownership and business state in local storage; offline catch-up is capped at seven simulated days.

## Economy rules

- All values are fictional in-game naira and do not represent real money.
- Purchase prices range from ₦250,000 to ₦1,200,000.
- Each sales cycle consumes stock and calculates profit using the business margin, upgrade level and staffing costs.
- Hiring increases sales capacity but incurs a simulated recurring cost each cycle.
- Restocking adds 20 units. Upgrades and staff have escalating costs.

## Preserved

- Existing Phase 1–3 systems, world geometry, combat, vehicles, jobs, housing, economy and existing storage keys.
- Business ownership uses its own versioned local-storage key and does not overwrite player wallet data.
- Service worker cache version bumped to v97.

## Validation

- JavaScript syntax checked for all project JavaScript modules.
- Service-worker precache list regenerated to include the new business modules.
- ZIP archive integrity checked.
- A live browser/device gameplay run was not available in this environment. Please test the Business app, purchases, stock, staff, upgrades and collection on-device.
