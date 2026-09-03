import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIcsCalendar, formatIcsDateTime } from '../../src/lib/ics';

test('Moscow programme export has UTC+3 with remote organiser details', () => {
  const calendar = buildIcsCalendar([{
    uid: 'session@tech-pravo.ru', dtstart: formatIcsDateTime('2026-09-25', '10:00'),
    dtend: formatIcsDateTime('2026-09-25', '11:00'), summary: 'Доклад', description: 'Описание',
    location: 'Новая площадка', organizer: { name: 'Название из админки', email: 'owner@example.org' },
  }], { name: 'Мой план', timezone: 'Europe/Moscow' });
  assert.match(calendar, /DTSTART;TZID=Europe\/Moscow:20260925T100000/);
  assert.match(calendar, /TZOFFSETTO:\+0300/);
  assert.doesNotMatch(calendar, /\+0400|Saratov/);
  assert.match(calendar, /mailto:owner@example.org/);
  assert.match(calendar, /LOCATION:Новая площадка/);
});

test('other callers keep Saratov support; unsupported zones fail rather than get wrong offsets', () => {
  assert.match(buildIcsCalendar([], { name: 'План', timezone: 'Europe/Saratov' }), /TZOFFSETTO:\+0400/);
  assert.throws(() => buildIcsCalendar([], { name: 'План', timezone: 'Unknown/Zone' }));
});

test('edited titles and organiser names cannot inject calendar properties', () => {
  const calendar = buildIcsCalendar([{
    uid: 'safe', dtstart: '20260925T100000', dtend: '20260925T110000',
    summary: 'Доклад\r\nX-INJECTED:yes', description: 'Описание\rX-INJECTED:yes',
    location: 'Адрес\nX-INJECTED:yes',
    organizer: { name: 'Команда: "Право"; ИИ^\r\nX-INJECTED:yes', email: 'owner@example.org' },
  }], { name: 'План', timezone: 'Europe/Moscow' });
  assert.doesNotMatch(calendar, /(?:^|\r|\n)X-INJECTED:/);
  assert.ok(calendar.includes('CN="Команда: ^\'Право^\'; ИИ^^^nX-INJECTED:yes":mailto:owner@example.org'));
});
