import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createAppContentStore, DEFAULT_APP_CONTENT, parseAppContent } from '../../src/lib/appContentStore';

test('public flat content overrides defaults, not private admin envelopes', () => {
  const content = parseAppContent({ city: 'Казань', organizerTelegram: '@Owner_2026' });
  assert.equal(content?.city, 'Казань');
  assert.equal(content?.organizerTelegram, 'Owner_2026');
  assert.equal(content?.email, DEFAULT_APP_CONTENT.email);
  for (const value of [null, [], 'bad', {}, { data: { city: 'Казань' }, version: 1 }, { city: null }, { city: '' }, { city: 'x'.repeat(4001) }]) {
    assert.equal(parseAppContent(value), null);
  }
});

test('unsafe remote contact and research links cannot replace good settings', () => {
  for (const payload of [
    { email: 'a@example.org?bcc=other@example.org' },
    { email: 'a@example.org\r\nBcc: other@example.org' },
    { organizerTelegram: '../../bad' },
    { researchLawyerUrl: 'https://tech-pravo.ru.evil.example/opros' },
    { researchManagerUrl: 'javascript:alert(1)' },
    { yandexMapUrl: 'https://name:password@example.org/' },
    { twoGisUrl: 'http://example.org/' },
  ]) assert.equal(parseAppContent(payload), null);
  assert.equal(parseAppContent({ researchLawyerUrl: 'https://tech-pravo.ru/opros2' })?.researchLawyerUrl, 'https://tech-pravo.ru/opros2');
});

test('known fields are allowlisted without copying prototype or metadata fields', () => {
  const parsed = parseAppContent(JSON.parse('{"city":"Казань","__proto__":{"polluted":true},"version":55}'))!;
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
  assert.equal('polluted' in parsed, false);
  assert.equal('version' in parsed, false);
});

test('all subscribers share one refresh and one stable snapshot', async () => {
  let resolve!: (value: unknown) => void;
  let calls = 0;
  let first = 0;
  let second = 0;
  const store = createAppContentStore({ load: () => { calls++; return new Promise((done) => { resolve = done; }); } });
  store.subscribe(() => first++);
  const unsubscribe = store.subscribe(() => second++);
  const request = store.refresh();
  assert.equal(store.refresh(), request);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve({ city: 'Казань' });
  await request;
  assert.equal(first, 1);
  assert.equal(second, 1);
  const snapshot = store.getSnapshot();
  unsubscribe();
  const nextRequest = store.refresh();
  await Promise.resolve();
  resolve({ city: 'Казань' });
  await nextRequest;
  assert.equal(store.getSnapshot(), snapshot);
  assert.equal(first, 1);
});

test('valid cache is immediately available, persists refresh and survives offline/restart', async () => {
  let cached = JSON.stringify({ city: 'Казань' });
  let fail = false;
  const store = createAppContentStore({
    readCache: () => cached,
    writeCache: (value) => { cached = value; },
    load: async () => { if (fail) throw new Error('offline'); return { city: 'Санкт-Петербург', email: 'owner@example.org' }; },
  });
  assert.equal(store.getSnapshot().city, 'Казань');
  await store.refresh();
  const good = store.getSnapshot();
  fail = true;
  await store.refresh();
  assert.equal(store.getSnapshot(), good);
  assert.equal(createAppContentStore({ readCache: () => cached, load: async () => null }).getSnapshot().city, 'Санкт-Петербург');
});

test('invalid responses and cache never blank the UI; storage denial does not block updates', async () => {
  let payload: unknown = { city: 'Казань' };
  const store = createAppContentStore({
    readCache: () => '{broken', writeCache: () => { throw new Error('denied'); }, load: async () => payload,
  });
  assert.equal(store.getSnapshot(), DEFAULT_APP_CONTENT);
  await store.refresh();
  const good = store.getSnapshot();
  payload = { city: null };
  await store.refresh();
  assert.equal(store.getSnapshot(), good);
  payload = { email: 'owner@example.org' };
  await store.refresh();
  assert.equal(store.getSnapshot().city, 'Казань');
  assert.equal(store.getSnapshot().email, 'owner@example.org');
});

test('every contact/date surface uses the shared content hook instead of embedded contacts', () => {
  const files = ['App.tsx', 'pages/Home.tsx', 'pages/Auth.tsx', 'pages/Settings.tsx', 'pages/Feed.tsx', 'pages/Faq.tsx', 'pages/Partners.tsx', 'pages/About.tsx', 'pages/Map.tsx', 'pages/MyRecords.tsx', 'components/ui/EventBadge.tsx'];
  for (const file of files) {
    const source = readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
    assert.match(source, /useAppContent\(/, file);
    assert.doesNotMatch(source, /tickets@notify\.tech-pravo\.ru|https:\/\/t\.me\/(CEO_WYRM1|TechPravoAI)|25–26 сентября/, file);
  }
  const research = readFileSync(new URL('../../src/pages/Giveaways.tsx', import.meta.url), 'utf8');
  assert.match(research, /material: content.researchLawyerMaterial/);
  assert.match(research, /material: content.researchManagerMaterial/);
});
