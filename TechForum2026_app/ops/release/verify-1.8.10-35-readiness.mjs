import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const manifest = JSON.parse(await read('release/1.8.10-35-debug/manifest.json'));
const apkPath = resolve(root, manifest.android.debugApk.path);
const apk = await readFile(apkPath);
const apkStat = await stat(apkPath);
const sha256 = createHash('sha256').update(apk).digest('hex');

assert.equal(manifest.immutable, true);
assert.equal(manifest.source.baseCommit, '05b223d48081dca14589c0c0863cc7c30be9200b');
assert.equal(manifest.source.artifactCommit, 'fb78eb553299f778ebb0390d5ff4195be8afd3e0');
assert.equal(manifest.application.version, '1.8.10');
assert.equal(manifest.application.build, 35);
assert.equal(manifest.application.apiBaseUrl, 'https://tech-pravo.ru/tfapi/v1');

assert.equal(sha256, manifest.android.debugApk.sha256);
assert.equal(apkStat.size, manifest.android.debugApk.bytes);
assert.equal(manifest.android.debugApk.upgradeCompatibleWithPublishedRuStorePackage, false);
assert.equal(manifest.android.aab, null);
assert.equal(manifest.android.storeReadiness, 'NO-GO');
assert.equal(manifest.ios.archive, null);
assert.equal(manifest.ios.ipa, null);
assert.equal(manifest.ios.storeReadiness, 'NO-GO');

const packageJson = JSON.parse(await read('package.json'));
assert.equal(packageJson.version, '1.8.10');

const gradle = await read('android/app/build.gradle');
assert.match(gradle, /applicationId "com\.psy_lololo\.conferenceapp"/);
assert.match(gradle, /versionCode 35/);
assert.match(gradle, /versionName "1\.8\.10"/);
assert.match(gradle, /debug\.keystore is forbidden for store artifacts/);

const pbxproj = await read('ios/App/App.xcodeproj/project.pbxproj');
assert.match(pbxproj, /CURRENT_PROJECT_VERSION = 35;/);
assert.match(pbxproj, /MARKETING_VERSION = 1\.8\.10;/);
assert.match(pbxproj, /PRODUCT_BUNDLE_IDENTIFIER = ru\.techpravo\.conference;/);

const entitlements = await read('ios/App/App/App.entitlements');
const packageSwift = await read('ios/App/CapApp-SPM/Package.swift');
assert.doesNotMatch(entitlements, /aps-environment/);
assert.doesNotMatch(packageSwift, /Firebase|Messaging/i);

const push = await read('src/lib/push.ts');
assert.match(push, /return native && platform === 'android' && configured;/);
assert.match(push, /if \(!canUseFirebaseMessaging\(\)\) return \(\) => \{\};/);

const migration18 = await read('drizzle/0018_contact_pins_and_telegram_tokens.sql');
const migration19 = await read('drizzle/0019_current_support_email.sql');
assert.match(migration18, /CREATE TABLE IF NOT EXISTS "contact_pins"/);
assert.match(migration18, /CREATE TABLE IF NOT EXISTS "telegram_link_tokens"/);
assert.match(migration18, /CREATE INDEX IF NOT EXISTS/);
assert.match(migration19, /tickets@notify\.tech-pravo\.ru/);

const sums = (await read('release/1.8.10-35-debug/SHA256SUMS.txt')).trim();
assert.equal(sums, `${sha256}  TechPravo-Android-1.8.10-35-debug.apk`);

console.log('PASS: immutable local candidate 1.8.10 (35) matches source metadata and APK checksum.');
console.log('GO: local Android debug QA; iOS source sync.');
console.log('NO-GO: RuStore release and App Store/TestFlight upload.');
