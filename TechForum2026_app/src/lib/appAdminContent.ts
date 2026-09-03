import type { Pool, PoolClient } from 'pg';

export class AdminContentError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type ContentSnapshot = { data: Record<string, string>; version: number; updatedAt: string | null };

export async function readContentSnapshot(pool: Pool | PoolClient, id: string, defaults: Record<string, string>): Promise<ContentSnapshot> {
  const { rows } = await pool.query('SELECT payload, version, updated_at FROM app_content WHERE id = $1', [id]);
  const row = rows[0];
  return { data: { ...defaults, ...row?.payload }, version: row?.version ?? 0, updatedAt: row?.updated_at?.toISOString() ?? null };
}

export function validateContentPatch(patch: unknown, defaults: Record<string, string>): Record<string, string> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length) {
    throw new AdminContentError(400, 'invalid_content_patch', 'Нет изменений для сохранения.');
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(defaults, key) || typeof value !== 'string' || value.length > 4000) {
      throw new AdminContentError(400, 'invalid_content_field', `Проверьте поле «${key}»: допустим текст до 4000 символов.`);
    }
    const text = value.trim();
    if (!text) throw new AdminContentError(400, 'empty_content_field', `Поле «${key}» не должно быть пустым.`);
    if (key.endsWith('Url')) {
      let valid = false;
      try {
        const url = new URL(text);
        valid = url.protocol === 'https:' && !url.username && !url.password;
        if (key.startsWith('research')) valid &&= ['tech-pravo.ru', 'www.tech-pravo.ru'].includes(url.hostname);
      } catch { /* validation below */ }
      if (!valid) throw new AdminContentError(400, 'invalid_content_url', `Проверьте HTTPS-ссылку в поле «${key}».`);
    }
    if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new AdminContentError(400, 'invalid_email', 'Проверьте адрес электронной почты.');
    if ((key === 'organizerTelegram' || key === 'telegramChannel') && !/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(text)) {
      throw new AdminContentError(400, 'invalid_telegram', 'Укажите имя Telegram без @ и ссылки.');
    }
    result[key] = text;
  }
  return result;
}

export async function saveContentPatch(pool: Pool, id: string, defaults: Record<string, string>, body: Record<string, unknown>, actor: string): Promise<ContentSnapshot> {
  if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 0) {
    throw new AdminContentError(428, 'content_version_required', 'Обновите панель перед сохранением: нужна актуальная версия данных.');
  }
  const changes = validateContentPatch(body.patch, defaults);
  const reason = String(body.reason ?? '').trim();
  if (reason.length < 5 || reason.length > 500) throw new AdminContentError(400, 'content_reason_required', 'Укажите причину изменения: от 5 до 500 символов.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO app_content(id, payload) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING', [id, JSON.stringify(defaults)]);
    await client.query('SELECT id FROM app_content WHERE id = $1 FOR UPDATE', [id]);
    const before = await readContentSnapshot(client, id, defaults);
    if (before.version !== body.expectedVersion) throw new AdminContentError(409, 'content_version_conflict', 'Данные уже изменены в другой вкладке. Ваш текст сохранён в форме; сверьте его с новой версией перед повторным сохранением.');
    const keys = Object.keys(changes).filter(key => changes[key] !== before.data[key]);
    if (!keys.length) { await client.query('COMMIT'); return before; }
    const after = { ...before.data, ...changes };
    await client.query('UPDATE app_content SET payload = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1', [id, JSON.stringify(after)]);
    await client.query(`INSERT INTO app_content_revisions(content_id, version, before_payload, after_payload, changed_keys, actor, reason)
      VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7)`, [id, before.version + 1, JSON.stringify(before.data), JSON.stringify(after), keys, actor, reason]);
    const saved = await readContentSnapshot(client, id, defaults);
    await client.query('COMMIT');
    return saved;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
