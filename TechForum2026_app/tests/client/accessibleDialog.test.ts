import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { APP_BACK_REQUEST_EVENT, nextDialogFocusIndex } from '../../src/components/ui/AccessibleDialog';

const dialogSource = fs.readFileSync(new URL('../../src/components/ui/AccessibleDialog.tsx', import.meta.url), 'utf8');

test('dialog focus wraps in both directions', () => {
  assert.equal(nextDialogFocusIndex(2, 3, false), 0);
  assert.equal(nextDialogFocusIndex(0, 3, true), 2);
  assert.equal(nextDialogFocusIndex(-1, 3, false), 0);
  assert.equal(nextDialogFocusIndex(-1, 3, true), 2);
  assert.equal(nextDialogFocusIndex(0, 0, false), -1);
});

test('native back event has one stable contract', () => {
  assert.equal(APP_BACK_REQUEST_EVENT, 'techforum:back-request');
});

test('dialog locks document scrolling and ignores CSS-hidden focus targets', () => {
  assert.match(dialogSource, /document\.documentElement\.style\.overflow = 'hidden'/);
  assert.match(dialogSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(dialogSource, /style\.display !== 'none'/);
  assert.match(dialogSource, /style\.visibility !== 'hidden'/);
  assert.match(dialogSource, /getClientRects\(\)\.length > 0/);
});
