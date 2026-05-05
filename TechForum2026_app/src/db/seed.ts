// FILE: src/db/seed.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Идемпотентный seed справочников из src/data.ts в Postgres + создание
//          одного тестового пользователя для dev-среды.
// SCOPE: TRACKS, HALLS, DAYS, SPEAKERS, SESSIONS, session_speakers, PARTNERS, dev-user.
// INPUT: process.env.DATABASE_URL
// OUTPUT: stdout-отчёт о вставленных строках; exit 0 при успехе, 1 при ошибке.
// KEYWORDS: DOMAIN(8): SeedingFixtures; CONCEPT(7): IdempotentInsert; TECH(8): Drizzle, Postgres
// LINKS: READS_DATA_FROM(9): src/data.ts; WRITES_DATA_TO(10): db/* tables
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему .onConflictDoUpdate, а не truncate + insert?
// A: Truncate теряет связанные данные через cascade (registrations, posts).
//    Onconflict-update безопасен и идемпотентен — можно перезапускать seed
//    после правок в data.ts без потери пользовательских данных.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 - Первичная реализация: upsert справочников + dev-юзер.]
// END_CHANGE_SUMMARY

import 'dotenv/config';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, closeDb } from './index';
import {
  tracks, halls, days, speakers,
  sessionsEvent, sessionSpeakers,
  partners, users, interests, news,
} from './schema';
import {
  TRACKS, HALLS, DAYS, SPEAKERS, SESSIONS, PARTNERS, INTERESTS, NEWS,
} from '../data';

function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `${actualSalt}:${digest}`;
}

async function seedReferenceTables(): Promise<void> {
  // START_BLOCK_TRACKS: треки
  for (const t of TRACKS) {
    await db.insert(tracks).values(t).onConflictDoUpdate({
      target: tracks.id,
      set: { name: t.name, color: t.color, shortLabel: t.shortLabel },
    });
  }
  console.log(`[seed] tracks: upserted ${TRACKS.length}`);
  // END_BLOCK_TRACKS

  // START_BLOCK_HALLS: залы
  for (const h of HALLS) {
    await db.insert(halls).values(h).onConflictDoUpdate({
      target: halls.id,
      set: { name: h.name, capacity: h.capacity },
    });
  }
  console.log(`[seed] halls: upserted ${HALLS.length}`);
  // END_BLOCK_HALLS

  // START_BLOCK_DAYS: дни программы
  for (const d of DAYS) {
    await db.insert(days).values(d).onConflictDoUpdate({
      target: days.id,
      set: { date: d.date, label: d.label, weekday: d.weekday },
    });
  }
  console.log(`[seed] days: upserted ${DAYS.length}`);
  // END_BLOCK_DAYS

  // START_BLOCK_INTERESTS: 22 направления (для onboarding и Recommended ранжирования)
  for (const it of INTERESTS) {
    await db.insert(interests).values({
      id: it.id,
      label: it.label,
      color: it.color,
    }).onConflictDoUpdate({
      target: interests.id,
      set: { label: it.label, color: it.color },
    });
  }
  console.log(`[seed] interests: upserted ${INTERESTS.length}`);
  // END_BLOCK_INTERESTS

  // START_BLOCK_SPEAKERS: спикеры
  for (const sp of SPEAKERS) {
    await db.insert(speakers).values({
      id: sp.id,
      name: sp.name,
      role: sp.role,
      company: sp.company,
      bio: sp.bio,
      avatarLetter: sp.avatarLetter,
      topic: sp.topic ?? null,
      trackId: sp.trackId,
      interestIds: sp.interestIds,
    }).onConflictDoUpdate({
      target: speakers.id,
      set: {
        name: sp.name,
        role: sp.role,
        company: sp.company,
        bio: sp.bio,
        avatarLetter: sp.avatarLetter,
        topic: sp.topic ?? null,
        trackId: sp.trackId,
        interestIds: sp.interestIds,
      },
    });
  }
  console.log(`[seed] speakers: upserted ${SPEAKERS.length}`);
  // END_BLOCK_SPEAKERS

  // START_BLOCK_SESSIONS: сессии (порядок важен — после треков/залов/дней)
  let sessionsInserted = 0;
  let speakerLinksInserted = 0;
  for (const s of SESSIONS) {
    await db.insert(sessionsEvent).values({
      id: s.id,
      title: s.title,
      description: s.description,
      startTime: s.startTime,
      endTime: s.endTime,
      format: s.format,
      hallId: s.hallId,
      dayId: s.dayId,
      trackId: s.trackId,
      status: s.status,
    }).onConflictDoUpdate({
      target: sessionsEvent.id,
      set: {
        title: s.title,
        description: s.description,
        startTime: s.startTime,
        endTime: s.endTime,
        format: s.format,
        hallId: s.hallId,
        dayId: s.dayId,
        trackId: s.trackId,
        status: s.status,
      },
    });
    sessionsInserted += 1;

    // Удаляем все связи сессия-спикер и заново вставляем — самый чистый
    // путь идемпотентности при изменении speakerIds в data.ts.
    await db.delete(sessionSpeakers).where(eq(sessionSpeakers.sessionId, s.id));

    for (let i = 0; i < s.speakerIds.length; i += 1) {
      await db.insert(sessionSpeakers).values({
        sessionId: s.id,
        speakerId: s.speakerIds[i]!,
        sortOrder: i,
      });
      speakerLinksInserted += 1;
    }
  }
  console.log(`[seed] sessions_event: upserted ${sessionsInserted}, session_speakers: ${speakerLinksInserted}`);
  // END_BLOCK_SESSIONS

  // START_BLOCK_PARTNERS: партнёры
  for (const p of PARTNERS) {
    await db.insert(partners).values({
      id: p.id,
      name: p.name,
      tier: p.tier,
      url: p.url,
      description: p.description,
    }).onConflictDoUpdate({
      target: partners.id,
      set: { name: p.name, tier: p.tier, url: p.url, description: p.description },
    });
  }
  console.log(`[seed] partners: upserted ${PARTNERS.length}`);
  // END_BLOCK_PARTNERS

  // START_BLOCK_NEWS: новости (Лента). sortOrder = индекс в массиве,
  // потому что хронологический порядок данных задан вручную (свежие сверху).
  for (let i = 0; i < NEWS.length; i += 1) {
    const n = NEWS[i]!;
    const values = {
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      body: n.body ?? '',
      time: n.time,
      isCritical: n.isCritical,
      category: n.category ?? null,
      speakerId: n.speakerId ?? null,
      sortOrder: i,
    };
    await db.insert(news).values(values).onConflictDoUpdate({
      target: news.id,
      set: {
        type: values.type,
        title: values.title,
        content: values.content,
        body: values.body,
        time: values.time,
        isCritical: values.isCritical,
        category: values.category,
        speakerId: values.speakerId,
        sortOrder: values.sortOrder,
      },
    });
  }
  console.log(`[seed] news: upserted ${NEWS.length}`);
  // END_BLOCK_NEWS
}

async function seedDevUser(): Promise<void> {
  // BUG_FIX_CONTEXT: zod-валидация в server.ts требует password.min(6).
  // Прежний пароль '123' (3 символа) не проходил login → 400 "invalid_body".
  // Поднимаем до 'demo1234' (8 символов) и upsert hash при каждом seed,
  // чтобы существующие dev/prod записи всегда имели валидный pass.
  const id = '00000000-0000-0000-0000-000000000001';
  const password = 'demo1234';
  const passwordHash = hashPassword(password);
  await db.insert(users).values({
    id,
    email: 'v@tech.com',
    passwordHash,
    name: 'Дмитрий Волков',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dmitry',
    bio: 'Tech Lead',
    isPrivate: false,
    role: 'Участник',
  }).onConflictDoUpdate({
    target: users.email,
    set: {
      passwordHash,  // re-set — на случай если хеш устарел или валидация поменялась
      name: 'Дмитрий Волков',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dmitry',
      bio: 'Tech Lead',
      role: 'Участник',
    },
  });
  console.log(`[seed] dev user v@tech.com / ${password} (id=${id}) password rotated`);
}

async function main(): Promise<void> {
  console.log('[seed] starting…');
  await seedReferenceTables();
  await seedDevUser();
  await closeDb();
  console.log('[seed] done.');
}

main().catch(async (err) => {
  console.error('[seed] FAILED:', err);
  try { await closeDb(); } catch { /* noop */ }
  process.exit(1);
});
