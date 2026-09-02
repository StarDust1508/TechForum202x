import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import bootstrap from '../../src/bootstrapPublicData.json';
import provenance from '../../src/bootstrapPublicData.provenance.json';
import focus from '../../src/speakerImageFocus.json';
import { getSpeakerImageFocus, normalizePublicSpeakers, selectPublicSpeakers } from '../../src/lib/publicSpeakers';

test('bundled snapshot is the proven 33-speaker public set', () => {
  const speakers = normalizePublicSpeakers(bootstrap.speakers);
  assert.equal(speakers.length, 33);
  assert.equal(new Set(speakers.map((speaker) => speaker.id)).size, speakers.length);
  assert.equal(provenance.speakerCount, speakers.length);
  assert.deepEqual(provenance.speakerIds, bootstrap.speakers.map((speaker) => speaker.id));
  const canonicalHash = crypto.createHash('sha256').update(JSON.stringify(bootstrap.speakers)).digest('hex');
  assert.equal(canonicalHash, provenance.canonicalSpeakersSha256);
});

test('live data wins and duplicate ids are removed deterministically', () => {
  const bundled = [{ id: 'speaker-a', name: 'Bundled' }];
  const live = [{ id: 'speaker-a', name: 'Live' }, { id: 'speaker-a', name: 'Duplicate' }, { id: 'speaker-b', name: 'Second' }];
  const selected = selectPublicSpeakers({ live, bundled });
  assert.deepEqual(selected.map(({ id, name }) => ({ id, name })), [
    { id: 'speaker-a', name: 'Live' },
    { id: 'speaker-b', name: 'Second' },
  ]);
});

test('every snapshot speaker has face-aware focus metadata with a safe fallback', () => {
  const configured = focus.speakers as Record<string, { xPercent: number; yPercent: number }>;
  for (const speaker of bootstrap.speakers) {
    assert.ok(configured[speaker.id], `missing focus metadata for ${speaker.id}`);
    const position = getSpeakerImageFocus(speaker.id);
    assert.ok(position.xPercent >= 0 && position.xPercent <= 100);
    assert.ok(position.yPercent >= 0 && position.yPercent <= 100);
  }
  assert.deepEqual(getSpeakerImageFocus('future-speaker'), focus.default);
});

test('provenance file itself is tracked as a stable review artifact', () => {
  assert.ok(fs.existsSync(new URL('../../src/bootstrapPublicData.provenance.json', import.meta.url)));
  assert.match(provenance.endpoint, /^https:\/\/tech-pravo\.ru\/tfapi\/v1\/speakers$/);
});
