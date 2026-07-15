// FILE: src/db/seedNews.ts
// PURPOSE: Идемпотентный сид новостей из src/data.ts в таблицу news. Запускается
//          один раз при вводе CMS «Приложение → Новости», чтобы лента в БД была
//          непустой и оператор мог редактировать существующие 6 новостей прямо
//          из админки. onConflictDoNothing — повторный запуск НЕ затирает правки
//          оператора (в отличие от upsert).
// INPUT: process.env.DATABASE_URL
// OUTPUT: stdout-отчёт; exit 0 при успехе, 1 при ошибке.
import 'dotenv/config';
import { db, closeDb } from './index';
import { news } from './schema';
import { NEWS } from '../data';

async function main(): Promise<void> {
  let inserted = 0;
  for (let i = 0; i < NEWS.length; i++) {
    const n = NEWS[i];
    const res = await db
      .insert(news)
      .values({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content ?? null,
        body: n.body ?? n.content ?? n.title,
        time: n.time ?? null,
        isCritical: !!n.isCritical,
        category: n.category ?? null,
        speakerId: n.speakerId ?? null,
        sortOrder: i,
        isPublished: true,
      })
      .onConflictDoNothing()
      .returning({ id: news.id });
    if (res.length) inserted += 1;
  }
  console.log(`[seedNews] готово: +${inserted} новых из ${NEWS.length} (onConflictDoNothing)`);
  await closeDb();
  process.exit(0);
}

main().catch((e) => {
  console.error('[seedNews] ошибка:', e);
  process.exit(1);
});
