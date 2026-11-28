/* electron-builder config — one file, three GRADES, chosen with EVERYDAY_GRADE (see tools/build-win.cjs):

     standard  Windows 10 / 11, 64-bit      current Electron, quality auto-detected
     lite      weak PCs (Win 10/11, 32 or 64-bit)   current Electron, starts on Low / Minimum quality
     legacy    Windows 7 / 8 / 8.1 and old 32-bit PCs   Electron 22 (last version that runs on them) + lite settings

   The grade is baked into the app (package.json ph3dGrade / ph3dProfile via extraMetadata) and read by electron-main.cjs. */
const grade = (process.env.EVERYDAY_GRADE || 'standard').toLowerCase();

const GRADES = {
  standard: { label: 'Win10-11',      product: 'Everyday-game',        electron: null,      profile: 'auto' },
  lite:     { label: 'Lite',          product: 'Everyday-game Lite',   electron: null,      profile: 'lite' },
  legacy:   { label: 'Legacy-Win7-8', product: 'Everyday-game Legacy', electron: '22.3.27', profile: 'lite' }
};
const g = GRADES[grade];
if (!g) throw new Error('Unknown EVERYDAY_GRADE "' + grade + '" (use standard | lite | legacy)');

module.exports = {
  /* standard keeps the original id (updates in place); lite / legacy get their own so they can sit side by side */
  appId: 'com.clintonbenjamin.everydaygame' + (grade === 'standard' ? '' : '.' + grade),
  productName: g.product,
  ...(g.electron ? { electronVersion: g.electron } : {}),
  asar: true,
  directories: { output: 'dist' },
  extraMetadata: { ph3dGrade: grade, ph3dProfile: g.profile },
  files: [
    '**/*',
    '!dist/**', '!.git/**', '!.github/**', '!node_modules/.cache/**',
    '!tools/**', '!branding/**', '!build/**', '!**/*.md'
  ],
  win: {
    icon: 'build/icon.ico',                 /* the LIFEX icon (multi-size, made from assets/icon-512.png) */
    target: ['nsis', 'portable'],
    artifactName: 'Everyday-game-${version}-' + g.label + '-${arch}.${ext}'
  },
  nsis: {
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    installerHeaderIcon: 'build/icon.ico',
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  },
  portable: {
    artifactName: 'Everyday-game-${version}-' + g.label + '-Portable-${arch}.${ext}'
  }
};
