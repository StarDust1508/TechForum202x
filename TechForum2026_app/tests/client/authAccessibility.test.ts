import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const authSource = fs.readFileSync(new URL('../../src/pages/Auth.tsx', import.meta.url), 'utf8');

test('auth form binds visible labels and autofill metadata', () => {
  for (const id of ['auth-name', 'auth-identifier', 'auth-password']) {
    assert.match(authSource, new RegExp(`htmlFor=\\"${id}\\"`));
    assert.match(authSource, new RegExp(`id=\\"${id}\\"`));
  }
  for (const token of ['name', 'email', 'tel', 'current-password', 'new-password']) {
    assert.match(authSource, new RegExp(`autoComplete=.*${token}`));
  }
});

test('auth error is announced, focusable and contains no VPN instruction', () => {
  assert.match(authSource, /id="auth-error"/);
  assert.match(authSource, /role="alert"/);
  assert.match(authSource, /tabIndex=\{-1\}/);
  assert.doesNotMatch(authSource, /выключите VPN|отключите VPN/i);
});

test('auth recovery and biometric prompts share the focus-trapped dialog primitive', () => {
  assert.match(authSource, /<AccessibleDialog[\s\S]*open=\{showForgot\}[\s\S]*titleId="forgot-password-title"/);
  assert.match(authSource, /<AccessibleDialog[\s\S]*open=\{showBioOffer\}[\s\S]*titleId="biometric-offer-title"/);
  assert.doesNotMatch(authSource, /w-9 h-9/);
});
