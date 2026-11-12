# Everyday-game — Windows desktop release

The project remains a browser/PWA game. The Electron wrapper adds a Windows desktop build without changing the web entry point.

## Build locally

```bash
npm install
npm run desktop
```

To package Windows executables (run on Windows, or use the GitHub Actions workflow):

```bash
npm run dist
```

The build writes two files into `dist/`:

- `Everyday-game-<version>-<arch>.exe` — Windows installer.
- `Everyday-game-<version>-Portable.exe` — portable executable.

## Publish a GitHub Release

Push the project to `main`, then create and push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The **Build Windows EXE and publish release** workflow builds both executables and attaches them to the GitHub Release for that tag. It can also be started manually from the Actions tab; a manual run builds downloadable workflow artifacts.
