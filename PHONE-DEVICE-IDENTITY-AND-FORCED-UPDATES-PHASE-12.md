# Phase 12 — Device identities and mandatory updates

## Phone models
- Added model-specific appearance profiles for all twelve purchasable phone models.
- Selecting an owned phone changes its OS family styling, wallpaper, app icon geometry, launcher spacing, status-bar accent and app chrome.
- Xiaomi now uses a HyperOS-style family; Samsung uses One UI; Apple uses iOS styling; Google uses Pixel styling; Tecno/itel use HiOS styling; Infinix uses XOS styling.
- App purpose-specific layouts remain intact; device identity is an additional layer and does not turn every app into the same template.

## Mandatory update flow
- A newly installed service worker waits instead of silently replacing the running game.
- When a new worker is ready, a full-screen mandatory update gate appears with an UPDATE NOW button.
- The gate blocks game interaction until the player applies the update.
- The button activates the waiting worker; the page reloads when the new worker takes control.
- Update checks run on registration, when the game returns to the foreground, when the device comes online, and every five minutes while open.
- The service worker cache version is bumped to v114.

## Notes
- A forced update can only be detected when the game can contact its hosting origin and the host has received the new service-worker release. Offline players continue using their already-installed version until connectivity returns.
- Existing local game saves are not intentionally cleared by the update flow.
