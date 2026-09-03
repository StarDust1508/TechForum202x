import assert from 'node:assert/strict';
import test from 'node:test';
import { RESEARCH_CONTENT_EVIDENCE, VERIFIED_RESEARCH_BENEFIT } from '../../src/lib/researchEvidence';

test('research fallback uses verified facts and material descriptions remain remotely editable', () => {
  assert.equal(RESEARCH_CONTENT_EVIDENCE.questionCount, 12);
  assert.equal(RESEARCH_CONTENT_EVIDENCE.estimatedMinutes, '5–7');
  assert.deepEqual(RESEARCH_CONTENT_EVIDENCE.sources, [
    'https://tech-pravo.ru/opros',
    'https://tech-pravo.ru/opros2',
  ]);
  assert.match(VERIFIED_RESEARCH_BENEFIT, /материал.+сертификат.+розыгрыш/i);
  assert.deepEqual(RESEARCH_CONTENT_EVIDENCE.remotelyManagedFields, [
    'researchLawyerMaterial',
    'researchManagerMaterial',
  ]);
});
