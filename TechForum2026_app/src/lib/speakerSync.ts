import crypto from 'node:crypto';
import type { Pool } from 'pg';

export class SpeakerSyncError extends Error {}
type SourceSpeaker = { id: string; name: string; role: string; company: string; bio: string; topic: string | null; avatarUrl: string | null; stream: string };
function parseSource(raw: unknown): SourceSpeaker[] {
  const envelope = raw as { speakers?: unknown; data?: unknown } | null;
  const values = Array.isArray(raw) ? raw : envelope?.speakers ?? envelope?.data;
  if (!Array.isArray(values) || !values.length) throw new SpeakerSyncError('Источник вернул пустой список. Данные приложения не изменены.');
  const seen = new Set<string>();
  return values.map(value => {
    if (!value || typeof value !== 'object') throw new SpeakerSyncError('Источник вернул некорректную карточку.');
    const s = value as Record<string, unknown>;
    const id = String(s.id ?? '').trim(), name = String(s.full_name ?? s.name ?? '').trim();
    if (!id || !name || seen.has(id)) throw new SpeakerSyncError('В источнике отсутствует ID, имя или обнаружен повтор ID.');
    seen.add(id);
    const rawPhoto = String(s.photo_url ?? '').trim();
    let avatarUrl: string | null = null;
    if (rawPhoto) {
      const url = new URL(rawPhoto, 'https://tech-pravo.ru');
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new SpeakerSyncError(`Проверьте ссылку фотографии: ${name}.`);
      avatarUrl = url.href;
    }
    return { id, name, role: String(s.position ?? 'Спикер').slice(0, 200), company: String(s.company ?? '—').slice(0, 200), bio: String(s.bio ?? '—').slice(0, 4000), topic: s.talk_title ? String(s.talk_title).slice(0, 500) : null, avatarUrl, stream: String(s.stream ?? '') };
  });
}

export async function syncSpeakers(pool: Pool, sourceUrl: string, dryRun = false, fetcher: typeof fetch = fetch) {
  let source: SourceSpeaker[];
  try {
    const response = await fetcher(sourceUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new SpeakerSyncError(`Источник спикеров недоступен (HTTP ${response.status}).`);
    source = parseSource(await response.json());
  } catch (error) {
    if (error instanceof SpeakerSyncError) throw error;
    throw new SpeakerSyncError('Не удалось получить корректный список с сайта. Данные приложения не изменены.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('techforum-speaker-sync'))");
    const { rows: existing } = await client.query('SELECT id, name, track_id FROM speakers');
    const { rows: mappings } = await client.query('SELECT source_id, speaker_id FROM speaker_source_links');
    const { rows: tracks } = await client.query('SELECT id FROM tracks');
    const trackIds = new Set(tracks.map(x => x.id));
    const touched = new Set<string>();
    let created = 0, updated = 0;
    for (const s of source) {
      const mapping = mappings.find(x => x.source_id === s.id);
      const legacyId = 'ss_' + s.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
      const names = existing.filter(x => x.name.trim().toLocaleLowerCase('ru') === s.name.toLocaleLowerCase('ru'));
      const exact = existing.find(x => x.id === s.id || x.id === legacyId);
      if (!mapping && !exact && names.length > 1) throw new SpeakerSyncError(`Неоднозначное совпадение: ${s.name}. Нужна сверка ID.`);
      const old = mapping ? existing.find(x => x.id === mapping.speaker_id) : exact ?? names[0];
      const id = old?.id ?? 'site_' + crypto.createHash('sha256').update(s.id).digest('hex').slice(0, 24);
      if (touched.has(id) || mappings.some(x => x.speaker_id === id && x.source_id !== s.id)) throw new SpeakerSyncError(`Два исходных ID претендуют на одну карточку: ${s.name}. Нужна сверка.`);
      touched.add(id);
      // Keep an editor's existing classification; never silently overwrite it from a text heuristic.
      const inferred = /банкрот|бфл|должник/i.test(s.stream) ? 't_bfl' : /масштаб|рост|маркетинг/i.test(s.stream) ? 't_growth' : /данн|безопас|пдн|152/i.test(s.stream) ? 't_data' : /legaltech|legal tech|сервис|инструмент/i.test(s.stream) ? 't_legaltech' : /автоматиз|арбитраж|crm/i.test(s.stream) ? 't_automation' : 't_ai';
      const track = old?.track_id ?? (trackIds.has(inferred) ? inferred : null);
      if (!track) throw new SpeakerSyncError(`Для нового спикера «${s.name}» не найдено направление. Сначала настройте направления.`);
      const initials = s.name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
      await client.query(`INSERT INTO speakers(id,name,role,company,bio,avatar_letter,avatar_url,topic,track_id,interest_ids)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'{}') ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,role=excluded.role,company=excluded.company,bio=excluded.bio,
        avatar_letter=excluded.avatar_letter,avatar_url=excluded.avatar_url,topic=excluded.topic`,
      [id, s.name, s.role, s.company, s.bio, initials, s.avatarUrl, s.topic, track]);
      await client.query('INSERT INTO speaker_source_links(source_id,speaker_id) VALUES($1,$2) ON CONFLICT(source_id) DO NOTHING', [s.id, id]);
      if (old) updated++; else created++;
    }
    const preserved = existing.filter(x => !touched.has(x.id)).length;
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return { ok: true, dryRun, sourceCount: source.length, speakers: existing.length + created, created, updated, preserved, syncedAt: dryRun ? null : new Date().toISOString() };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
