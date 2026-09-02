import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeepLinkDeduper, resolveDeepLink } from '../../src/lib/deepLinks';

test('resolves host and path forms into allowlisted routes', () => {
  assert.deepEqual(resolveDeepLink('conference-app://schedule?session=ev_123'), {
    ok: true,
    route: '/schedule?session=ev_123',
    canonicalUrl: 'conference-app:///schedule?session=ev_123',
  });
  assert.deepEqual(resolveDeepLink('conference-app:///speakers/sp_sizov'), {
    ok: true,
    route: '/speakers/sp_sizov',
    canonicalUrl: 'conference-app:///speakers/sp_sizov',
  });
  assert.deepEqual(resolveDeepLink('conference-app://chat?dm=user_42'), {
    ok: true,
    route: '/chat?dm=user_42',
    canonicalUrl: 'conference-app:///chat?dm=user_42',
  });
});

test('rejects unsupported schemes, routes and unsafe identifiers', () => {
  assert.equal(resolveDeepLink('https://tech-pravo.ru/conference').ok, false);
  assert.deepEqual(resolveDeepLink('conference-app://admin'), {
    ok: false,
    route: '/',
    reason: 'unsupported_route',
  });
  assert.deepEqual(resolveDeepLink('conference-app:///speakers/%2E%2E%2Fsettings'), {
    ok: false,
    route: '/',
    reason: 'unsupported_route',
  });
});

test('deduplicates repeated native callbacks but accepts later opens', () => {
  const shouldOpen = createDeepLinkDeduper(1_500);
  assert.equal(shouldOpen('conference-app:///schedule', 1_000), true);
  assert.equal(shouldOpen('conference-app:///schedule', 2_000), false);
  assert.equal(shouldOpen('conference-app:///speakers', 2_100), true);
  assert.equal(shouldOpen('conference-app:///schedule', 3_600), true);
});
