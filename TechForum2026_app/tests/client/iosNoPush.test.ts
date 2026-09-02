import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const config = fs.readFileSync(new URL('../../capacitor.config.ts', import.meta.url), 'utf8');
const entitlements = fs.readFileSync(new URL('../../ios/App/App/App.entitlements', import.meta.url), 'utf8');
const packageSwift = fs.readFileSync(new URL('../../ios/App/CapApp-SPM/Package.swift', import.meta.url), 'utf8');

test('iOS source stays no-push until Apple capabilities are owner-verified', () => {
  assert.match(config, /ios:\s*\{[\s\S]*includePlugins:/);
  assert.doesNotMatch(config.match(/includePlugins:\s*\[([\s\S]*?)\]/)?.[1] || '', /firebase.*messaging/i);
  assert.doesNotMatch(entitlements, /aps-environment/i);
  assert.doesNotMatch(packageSwift, /CapacitorFirebaseMessaging/);
});
