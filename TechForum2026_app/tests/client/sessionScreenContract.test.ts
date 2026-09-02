import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../../src/pages/${path}`, import.meta.url), 'utf8');

for (const screen of ['Schedule.tsx', 'MyRecords.tsx', 'SpeakerDetail.tsx']) {
  test(`${screen} uses the shared publication-filtered useSessions contract`, () => {
    const source = read(screen);
    assert.match(source, /import \{ useSessions \} from '@\/src\/lib\/programData';/);
    assert.match(source, /useSessions<[^>]+>\(\)/);
    assert.doesNotMatch(source, /fetchCachedJson<[^>]*Session[^>]*>\('\/sessions'\)/);
    assert.doesNotMatch(source, /readCachedPublicJson<[^>]*Session[^>]*>\('\/sessions'\)/);
  });
}

test('cache boundary filters sessions before any screen can persist or render them', () => {
  const source = fs.readFileSync(new URL('../../src/lib/cachedPublicApi.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(path === '\/sessions'\) return normalizePublishedSessions\(data\);/);
  assert.match(source, /tp_public_cache_v6:/);
});

test('background session refresh keeps a proven cached programme visible', () => {
  const source = fs.readFileSync(new URL('../../src/lib/programData.ts', import.meta.url), 'utf8');
  assert.match(source, /const hasUsableData = useRef\(initial\.length > 0\);/);
  assert.match(source, /setLoading\(!hasUsableData\.current\);/);
  assert.doesNotMatch(source, /const refetch[\s\S]*?setLoading\(true\)/);
});
