import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const packageJson = JSON.parse(read('package.json')) as { version: string };

test('one package version drives Android, iOS and the visible About screen', () => {
  const [major, minor, patch] = packageJson.version.split('.').map(Number);
  assert.ok(Number.isInteger(major) && Number.isInteger(minor) && Number.isInteger(patch));

  const android = read('android/app/build.gradle');
  assert.match(android, new RegExp(`versionName "${packageJson.version.replaceAll('.', '\\.')}`));

  const ios = read('ios/App/App.xcodeproj/project.pbxproj');
  assert.equal((ios.match(new RegExp(`MARKETING_VERSION = ${packageJson.version.replaceAll('.', '\\.')};`, 'g')) ?? []).length, 2);

  const vite = read('vite.config.ts');
  assert.match(vite, /__APP_VERSION__: JSON\.stringify\(packageJson\.version\)/);
  assert.match(read('src/pages/Settings.tsx'), /const APP_VERSION = __APP_VERSION__;/);
});
