// FILE: src/db/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Singleton-пул соединений к Postgres + типизированный Drizzle-клиент.
//          Используется server.ts и seed-скриптами.
// SCOPE: Только подключение и экспорт `db` объекта. Никакой бизнес-логики.
// INPUT: process.env.DATABASE_URL (строка DSN: postgres://user:pass@host:5432/dbname).
// OUTPUT: { db, pool, closeDb }.
// KEYWORDS: DOMAIN(7): Persistence; CONCEPT(8): ConnectionPool; TECH(9): pg, Drizzle
// LINKS: USED_BY(10): server.ts, src/db/seed.ts; USES_API(8): pg.Pool
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему pg.Pool, а не pg.Client?
// A: Express обрабатывает несколько запросов одновременно — Pool переиспользует
//    соединения, а Client держит одно постоянное (хуже под нагрузкой).
// Q: Почему max=10 коннектов?
// A: На VPS 1GB RAM Postgres сам по умолчанию 100 соединений, но при 10 наших
//    + Hunter888 + системные cron — общая нагрузка ~30 коннектов. Запас.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 - Первичная реализация: Pool + Drizzle, graceful shutdown.]
// END_CHANGE_SUMMARY

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const databaseUrl = String(process.env.DATABASE_URL || '').trim();

if (!databaseUrl) {
  throw new Error(
    '[db] DATABASE_URL is required. Set it in .env.development (local Postgres) ' +
    'or pass via env when starting the server.',
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // BUG_FIX_CONTEXT: pg-Pool без обработчика 'error' падает на отвалах
  // соединений (например, postgres restart) с unhandled exception → crash сервера.
  // Логируем и даём пулу самому переподключиться к следующему checkout.
  console.error('[db] idle pool client error', err);
});

export const db = drizzle(pool, { schema });

export async function closeDb(): Promise<void> {
  await pool.end();
}

export { schema };
