import assert from 'node:assert/strict';
import test from 'node:test';
import { mapAuthServerError, presentAuthException } from '../../src/lib/authErrors';

test('network failures never expose technical text or blame VPN', () => {
  const result = presentAuthException(new TypeError('Failed to fetch: CORS ECONNRESET'));
  assert.equal(result.message, 'Не удалось связаться с сервером. Проверьте подключение к интернету и повторите попытку.');
  assert.doesNotMatch(result.message, /Failed to fetch|CORS|VPN|ECONNRESET/i);
  assert.equal(result.target, 'form');
});

test('known server failures provide a direct recovery path and focus target', () => {
  assert.deepEqual(mapAuthServerError('wrong_password'), {
    message: 'Неверный email, телефон или пароль. Проверьте данные и попробуйте снова.',
    target: 'password',
    diagnosticCode: 'wrong_password',
  });
  assert.equal(mapAuthServerError('email_taken').target, 'identifier');
});

test('unknown technical codes stay out of user-facing copy', () => {
  const result = mapAuthServerError('postgres_connection_refused');
  assert.equal(result.message, 'Не удалось выполнить вход. Проверьте данные и попробуйте ещё раз.');
  assert.doesNotMatch(result.message, /postgres|connection_refused/i);
});
