import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_BACK_REQUEST_EVENT, nextDialogFocusIndex } from '../../src/components/ui/AccessibleDialog';

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
