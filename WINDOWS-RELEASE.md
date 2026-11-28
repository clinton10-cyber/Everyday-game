# Everyday-game — Windows desktop release

The project remains a browser/PWA game. The Electron wrapper adds a Windows desktop build without changing the web entry point.

## Which file should I download?

Every release has three **grades**, each as an installer and as a no-install **Portable** exe:

| Your PC | Download | Notes |
|---|---|---|
| Windows 10 / 11, 64-bit, normal PC | `Everyday-game-<version>-Win10-11-x64.exe` | Detects weak hardware by itself and starts on a lower quality tier if needed. |
| Windows 10 / 11, **low-end** (2–4 GB RAM, 2 cores, old or integrated graphics) | `...-Lite-x64.exe` (64-bit) or `...-Lite-ia32.exe` (32-bit) | Starts on the *Low* / *Minimum* graphics tier (no shadows or anti-aliasing, smaller render size, fewer trees), a smaller window and memory-saving settings. |
| **Windows 7 / 8 / 8.1**, or any very old 32-bit PC | `...-Legacy-Win7-8-x64.exe` or `...-Legacy-Win7-8-ia32.exe` | Built on Electron 22, the last version that runs on Windows 7/8/8.1, with the lite settings. |

Not sure whether your Windows is 32 or 64-bit? *Settings → System → About → System type*. On Windows 7: right-click *Computer → Properties*. When in doubt on an old PC pick **ia32** — it runs on both.

The Lite and Legacy apps install next to the standard one (separate names), so you can try them all.

### What the apps do to run on weak hardware

* **Software-rendering fallback.** The game needs WebGL2. If the graphics card or driver can't provide it — or the GPU process crashes twice — the app remembers that and restarts on software rendering (SwiftShader). It is slower, but it runs on PCs with no usable GPU. (Windows 7 may also need the *Platform Update* — KB2670838 — for hardware graphics.) Run with `--gpu` to forget the fallback and try the GPU again, or `--software-render` to force it.
* **Starting quality.** On the first launch the app picks Auto / Low / Minimum from the PC's RAM and CPU cores. You can change it any time in the game's *Settings → Quality* (tap to cycle); your choice is never overwritten.
* **Settings now persist.** The app's built-in web server uses a fixed local port, so settings and caches survive between launches.
* **F11** toggles full screen. `--lite` / `--standard` on a shortcut force the lite or normal profile.

## Icon

Every exe, installer, window and taskbar button uses the LIFEX icon. The Windows icon lives in `build/icon.ico` (16–256 px, made from `assets/icon-512.png`); if you ever change the app icon, regenerate it:

```bash
python3 -c "from PIL import Image; Image.open('assets/icon-512.png').convert('RGBA').save('build/icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"
```

## Build locally

```bash
npm install
npm run desktop          # run the desktop app without packaging
```

Package executables (run on Windows, or use the GitHub Actions workflow):

```bash
npm run dist             # standard, 64-bit
npm run dist:lite        # lite, 64-bit + 32-bit
npm run dist:legacy      # Windows 7/8/8.1 build (Electron 22), 64-bit + 32-bit
npm run dist:all         # everything the release ships
```

Each build writes into `dist/`:

- `Everyday-game-<version>-<grade>-<arch>.exe` — installer.
- `Everyday-game-<version>-<grade>-Portable-<arch>.exe` — portable executable.

## Publish a GitHub Release

Push the project to `main`, then create and push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The **Build Windows EXEs (all grades) and publish release** workflow builds every grade and architecture (5 builds, installer + portable each) and attaches them to the GitHub Release for that tag. It can also be started manually from the Actions tab; a manual run builds downloadable workflow artifacts.
