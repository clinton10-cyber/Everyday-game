#!/usr/bin/env node
/* Build Windows executables for one grade and one or more CPU architectures.

     node tools/build-win.cjs standard x64
     node tools/build-win.cjs lite ia32 x64
     node tools/build-win.cjs legacy x64 ia32
     node tools/build-win.cjs all            (every grade / arch the project ships)

   Each run writes installer + portable exe into dist/. Run on Windows (or use the GitHub Actions workflow). */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const MATRIX = [['standard', 'x64'], ['lite', 'x64'], ['lite', 'ia32'], ['legacy', 'x64'], ['legacy', 'ia32']];
const [grade, ...archs] = process.argv.slice(2);
if (!grade) { console.error('usage: node tools/build-win.cjs <standard|lite|legacy|all> [x64] [ia32]'); process.exit(1); }

const jobs = grade === 'all' ? MATRIX : archs.length ? archs.map((a) => [grade, a]) : [[grade, 'x64']];
for (const [gr, arch] of jobs) {
  console.log('\n=== building', gr, arch, '===');
  const r = spawnSync('npx', ['electron-builder', '--config', 'electron-builder.config.cjs', '--win', 'nsis', 'portable', '--' + arch, '--publish', 'never'],
    { stdio: 'inherit', shell: true, cwd: path.resolve(__dirname, '..'), env: Object.assign({}, process.env, { EVERYDAY_GRADE: gr }) });
  if (r.status !== 0) process.exit(r.status || 1);
}
