import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

function luminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((part) => Number.parseInt(part, 16) / 255) ?? [];
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test('primary actions use an AA text pair in both themes', () => {
  const primaryValues = [...css.matchAll(/--color-primary:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1]);
  const foregroundValues = [...css.matchAll(/--color-primary-foreground:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1]);
  assert.equal(primaryValues.length, 2);
  assert.deepEqual(foregroundValues, ['#0f1118', '#0f1118']);
  for (const primary of primaryValues) assert.ok(contrast(primary, '#0f1118') >= 4.5);
});
