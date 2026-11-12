# Everyday-game — Phone UI, Battery, Data & Social Upgrade

Built on the Phase 11 Advanced Economy and Banking project.

## Device-specific interfaces
- Buying a phone makes it the active handset.
- Players can switch between phones they already own at the Phone Shop or in Settings.
- The phone shell, wallpaper, notch treatment, icon shape and app-surface colours change for Apple-inspired iOS, Samsung-inspired One UI, Tecno/itel-inspired HiOS, Infinix-inspired XOS, Google Pixel-inspired UI and generic Android.
- Brand treatments are original game interfaces inspired by each platform, not copied operating-system assets.

## Battery and charging
- A persistent in-game battery indicator appears in the phone status bar.
- Battery drains gradually while the player owns an active phone (approximately 3% per real hour, with offline elapsed-time catch-up capped at 24 hours).
- Settings shows battery percentage and device specifications.
- Players can purchase a +25% charge for ₦300 or a full charge for ₦900.

## Mobile data and airtime
- Existing Phone Shop data and airtime bundles remain available.
- Current data and airtime balances appear in Phone Settings; remaining data also appears in the status bar.
- Social updates use 5 MB and likes use 1 MB.
- Data is deducted from the existing Engagement phone-data balance, so Phone Shop top-ups feed the social app.

## Social media
- Added Garden City Connect to the in-game phone.
- Includes a fictional Port Harcourt community feed, player-created updates, likes and persistent activity counters.
- Player-created posts are stored locally with timestamps.

## Validation
- Service-worker cache version bumped to v106.
- Offline precache regenerated.
- All project JavaScript files passed Node module syntax checks.
- ZIP archive integrity checked after packaging.


## Banking interface visual refresh (v107)
- Restyled the fictional Everyday Pay bank screen with a clean green mobile-wallet layout inspired by common Nigerian fintech UX patterns.
- Added a balance hero card, account-number row, quick navigation shortcuts, savings/loans/investment/history sections, and refreshed forms and transaction rows.
- Kept the Everyday Pay name and original game banking logic; this is not an OPay replica and does not use OPay branding or imply a real OPay connection.
- Updated service-worker cache version to v107.
