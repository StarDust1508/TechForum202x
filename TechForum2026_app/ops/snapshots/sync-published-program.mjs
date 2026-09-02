#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HIDDEN_IDS = new Set(['ev_64df4b6eef3776', 'ev_cc2ac4fb7154b4']);
const BOND_SESSION_ID = 'ev_4ed0cf7acbbceb';
const BOND_SPEAKER_ID = 'ss_9549f3332e335f3a';
const BOND_TITLE = 'Локальная модель + графовый RAG: проверяемый ИИ-контур без сверхмощной инфраструктуры';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const input = args.get('--input');
const capturedAt = args.get('--captured-at');
const responseEtag = args.get('--etag') || null;
const endpoint = args.get('--endpoint') || 'https://tech-pravo.ru/tfapi/v1/sessions';
if (!input || !capturedAt) {
  console.error('Usage: sync-published-program.mjs --input <raw-sessions.json> --captured-at <ISO> [--etag <value>]');
  process.exit(2);
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const appRoot = path.resolve(import.meta.dirname, '../..');
const bootstrapPath = path.join(appRoot, 'src/bootstrapPublicData.json');
const provenancePath = path.join(appRoot, 'src/bootstrapPublicData.provenance.json');
const raw = fs.readFileSync(path.resolve(input));
const sourceSessions = JSON.parse(raw.toString('utf8'));
if (!Array.isArray(sourceSessions) || sourceSessions.length !== 40) {
  throw new Error(`expected exact 40-row source snapshot, received ${Array.isArray(sourceSessions) ? sourceSessions.length : 'non-array'}`);
}

for (const hiddenId of HIDDEN_IDS) {
  if (!sourceSessions.some((session) => session?.id === hiddenId)) {
    throw new Error(`hidden source row missing: ${hiddenId}`);
  }
}

const unique = new Set();
const publishedSessions = [];
for (const session of sourceSessions) {
  const id = String(session?.id || '').trim();
  if (!id) throw new Error('every session needs a stable id');
  if (unique.has(id)) throw new Error(`duplicate session id: ${id}`);
  unique.add(id);
  if (HIDDEN_IDS.has(id)) continue;

  if (id === BOND_SESSION_ID) {
    if (session.title !== BOND_TITLE) throw new Error('Ivan Bondarenko session title drift');
    const existingIds = Array.isArray(session.speakerIds) ? session.speakerIds.filter((value) => typeof value === 'string') : [];
    publishedSessions.push({
      ...session,
      speakerIds: Array.from(new Set([...existingIds, BOND_SPEAKER_ID])),
      ...((!session.speakerName || session.speakerName === '—') ? { speakerName: 'Иван Бондаренко' } : {}),
    });
  } else {
    publishedSessions.push(session);
  }
}

if (publishedSessions.length !== 38) throw new Error(`expected exact 38 published sessions, received ${publishedSessions.length}`);
if (publishedSessions.some((session) => HIDDEN_IDS.has(session.id))) throw new Error('hidden session leaked into published snapshot');

const bondarenko = publishedSessions.find((session) => session.id === BOND_SESSION_ID);
if (!bondarenko?.speakerIds?.includes(BOND_SPEAKER_ID)) throw new Error('Ivan Bondarenko link missing after normalization');

const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
bootstrap.sessions = publishedSessions;
const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
provenance.schemaVersion = 2;
provenance.sessions = {
  endpoint,
  capturedAt,
  responseEtag,
  responseSha256: sha256(raw),
  sourceSessionCount: sourceSessions.length,
  publicationFilter: [...HIDDEN_IDS],
  canonicalPublishedSha256: sha256(Buffer.from(JSON.stringify(publishedSessions))),
  publishedSessionCount: publishedSessions.length,
  publishedSessionIds: publishedSessions.map((session) => session.id),
  canonicalSpeakerLinks: {
    [BOND_SESSION_ID]: [BOND_SPEAKER_ID],
  },
};

fs.writeFileSync(bootstrapPath, `${JSON.stringify(bootstrap, null, 2)}\n`);
fs.writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`PASS: froze ${publishedSessions.length} published sessions from ${sourceSessions.length} source rows`);
