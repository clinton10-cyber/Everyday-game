# APK update prompt (v1.3.3)

The Android app now checks GitHub Releases and prompts the player when a newer one exists.

- `js/app-update.js` (APK only, loaded from `pwa.js`): checks 4s after launch, when the app returns to the foreground, when the phone comes online, and every 30 min.
- The APK workflow stamps `www/app-version.json` (`appVersion`, `runNumber`, `tag`) so each build knows itself.
- Newer = a `vX.Y.Z` release with a higher version, or a `build-N` release with N higher than the app's run number.
- Prompt: **UPDATE NOW** downloads the signed `.apk` (falls back to the debug one); **LATER** hides that release for 6 hours.
- Signed release APKs update in place over the old install (same keystore secrets).
- Apps older than v1.3.3 don't have this code; install v1.3.3 manually once.
- Manual test from the console: `__ph3d_checkAppUpdate({force:true})`.
