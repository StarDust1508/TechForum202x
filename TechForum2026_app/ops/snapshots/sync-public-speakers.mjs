#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const input = args.get('--input');
const capturedAt = args.get('--captured-at');
const responseEtag = args.get('--etag') || null;
const endpoint = args.get('--endpoint') || 'https://tech-pravo.ru/tfapi/v1/speakers';
if (!input || !capturedAt) {
  console.error('Usage: sync-public-speakers.mjs --input <raw-api.json> --captured-at <ISO> [--etag <value>] [--endpoint <url>]');
  process.exit(2);
}

const appRoot = path.resolve(import.meta.dirname, '../..');
const bootstrapPath = path.join(appRoot, 'src/bootstrapPublicData.json');
const provenancePath = path.join(appRoot, 'src/bootstrapPublicData.provenance.json');
const raw = fs.readFileSync(path.resolve(input));
const parsed = JSON.parse(raw.toString('utf8'));
if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('speaker snapshot must be a non-empty array');

const unique = new Map();
for (const speaker of parsed) {
  const id = String(speaker?.id || '').trim();
  const name = String(speaker?.name || '').trim();
  if (!id || !name) throw new Error('every speaker needs a stable id and name');
  if (unique.has(id)) throw new Error(`duplicate speaker id in API snapshot: ${id}`);
  unique.set(id, speaker);
}

const canonicalSpeakers = [...unique.values()];
const canonicalBytes = Buffer.from(JSON.stringify(canonicalSpeakers));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
bootstrap.speakers = canonicalSpeakers;
fs.writeFileSync(bootstrapPath, `${JSON.stringify(bootstrap, null, 2)}\n`);
fs.writeFileSync(provenancePath, `${JSON.stringify({
  schemaVersion: 1,
  endpoint,
  capturedAt,
  responseEtag,
  responseSha256: sha256(raw),
  canonicalSpeakersSha256: sha256(canonicalBytes),
  speakerCount: canonicalSpeakers.length,
  speakerIds: canonicalSpeakers.map((speaker) => speaker.id),
}, null, 2)}\n`);

console.log(`PASS: wrote ${canonicalSpeakers.length} unique public speakers; canonical sha256=${sha256(canonicalBytes)}`);
