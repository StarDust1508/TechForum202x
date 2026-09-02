import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import bootstrap from '../../src/bootstrapPublicData.json';
import provenance from '../../src/bootstrapPublicData.provenance.json';
import { getCanonicalProgrammeSpeaker, getCanonicalProgrammeSpeakers } from '../../src/lib/canonicalSpeakerSupplements';
import {
  HIDDEN_PUBLIC_SESSION_IDS,
  IVAN_BONDARENKO_SESSION_ID,
  IVAN_BONDARENKO_SESSION_TITLE,
  IVAN_BONDARENKO_SPEAKER_ID,
  normalizePublishedSessions,
} from '../../src/lib/publicSessions';

test('bundled programme is an immutable 38-session publication snapshot', () => {
  assert.equal(bootstrap.sessions.length, 38);
  assert.equal(new Set(bootstrap.sessions.map((session) => session.id)).size, 38);
  for (const hiddenId of HIDDEN_PUBLIC_SESSION_IDS) {
    assert.equal(bootstrap.sessions.some((session) => session.id === hiddenId), false);
  }
  assert.equal(provenance.sessions.publishedSessionCount, 38);
  assert.deepEqual(provenance.sessions.publicationFilter, [...HIDDEN_PUBLIC_SESSION_IDS]);
  assert.deepEqual(provenance.sessions.publishedSessionIds, bootstrap.sessions.map((session) => session.id));
  const hash = crypto.createHash('sha256').update(JSON.stringify(bootstrap.sessions)).digest('hex');
  assert.equal(hash, provenance.sessions.canonicalPublishedSha256);
});

test('live and cached rows are publication-filtered and Ivan link is evidence-guarded', () => {
  const normalized = normalizePublishedSessions([
    { id: 'visible', title: 'Visible', speakerIds: [] },
    { id: 'ev_64df4b6eef3776', title: 'Hidden one' },
    { id: 'ev_cc2ac4fb7154b4', title: 'Hidden two' },
    { id: IVAN_BONDARENKO_SESSION_ID, title: IVAN_BONDARENKO_SESSION_TITLE, speakerIds: [], speakerName: '—' },
    { id: 'visible', title: 'Duplicate' },
  ]);
  assert.deepEqual(normalized.map((session) => session.id), ['visible', IVAN_BONDARENKO_SESSION_ID]);
  const bondarenko = normalized.find((session) => session.id === IVAN_BONDARENKO_SESSION_ID);
  assert.deepEqual(bondarenko?.speakerIds, [IVAN_BONDARENKO_SPEAKER_ID]);
  assert.equal(bondarenko?.speakerName, 'Иван Бондаренко');

  const drifted = normalizePublishedSessions([
    { id: IVAN_BONDARENKO_SESSION_ID, title: 'Repurposed id', speakerIds: [] },
  ]);
  assert.deepEqual(drifted[0]?.speakerIds, []);
});

test('Ivan has a programme-only initials card without expanding the 33-card public list', () => {
  assert.equal(bootstrap.speakers.length, 33);
  assert.equal(bootstrap.speakers.some((speaker) => speaker.id === IVAN_BONDARENKO_SPEAKER_ID), false);
  const speaker = getCanonicalProgrammeSpeaker(IVAN_BONDARENKO_SPEAKER_ID);
  assert.equal(speaker?.name, 'Иван Бондаренко');
  assert.equal(speaker?.role, 'Исследователь и разработчик русскоязычных AI-моделей');
  assert.equal(speaker?.company, 'НГУ / Dialoger');
  assert.equal(speaker?.avatarUrl, null);
  assert.equal(getCanonicalProgrammeSpeakers().length, 1);

  const session = bootstrap.sessions.find((item) => item.id === IVAN_BONDARENKO_SESSION_ID);
  assert.ok(session?.speakerIds.includes(IVAN_BONDARENKO_SPEAKER_ID));
});

test('unreconciled public names remain byte-exact instead of guessed client corrections', () => {
  assert.equal(bootstrap.speakers.find((speaker) => speaker.id === 'ss_935aa409b9fb4844')?.name, 'Ирина Пионтковская');
  assert.equal(bootstrap.speakers.find((speaker) => speaker.id === 'ss_8783a1c136784479')?.name, 'Клосеп Сергей Кирилловис');
});
