import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('Android store task graph fails closed without owner signing and Firebase config', () => {
  const gradle = readFileSync(new URL('../../android/app/build.gradle', import.meta.url), 'utf8');
  assert.match(gradle, /requestsStoreArtifact && !storeSigningConfigured/);
  assert.match(gradle, /requestsStoreArtifact && !servicesJSON.isFile\(\)/);
  assert.match(gradle, /project_id != 'techpravo-33f82'/);
  assert.match(gradle, /package_name == android.defaultConfig.applicationId/);
  assert.match(gradle, /matchingClient\?\.api_key\?\.any/);
  assert.doesNotMatch(gradle, /catch\s*\(Exception/);
});
