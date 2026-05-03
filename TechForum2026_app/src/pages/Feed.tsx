// FILE: src/pages/Feed.tsx
// VERSION: 3.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Лента новостей форума. Каждая карточка кликабельна и ведёт на
//          отдельную страницу детали (/news/:id).
// SCOPE: UI only. Без API, без поиска, без статусов, без Reels/Posts табов.
// INPUT: NEWS, SPEAKERS из src/data.
// OUTPUT: JSX страница.
// KEYWORDS: DOMAIN(7): NewsFeed; CONCEPT(7): ListView; TECH(6): React, Tailwind
// LINKS: NAVIGATES_TO(8): /news/:id
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему убрали Reels / Лента / поиск / статусы?
// A: По требованию заказчика — раздел "Новости" должен быть простой
//    кликабельной лентой новостей от спикеров, без социал-фишек.
// Q: Почему данные из data.ts NEWS, а не /api/v1/posts?
// A: Заказчик хотел "рандомные сгенерированные новости от спикеров" — это
//    статичный контент. Когда понадобится reactive feed (комменты, лайки) —
//    подключим к posts API.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v3.0.0 - Полный рерайт под "Новости от спикеров". Удалены
//                       Reels/Posts табы, поиск, статусы, recording-видео,
//                       create-modals. Добавлен Link на /news/:id.]
// PREV_CHANGE_SUMMARY: [v2.0.0 - Reels + posts feed + поиск + статусы.]
// END_CHANGE_SUMMARY

import { Newspaper, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NEWS, getSpeakerById } from '../data';
import BackButton from '@/src/components/BackButton';

export default function Feed() {
  return (
    <div
      className="flex-1 px-5 pb-12 relative"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
      }}
    >
      <BackButton />

      <header className="space-y-2 mb-6 mt-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent/85 font-semibold flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5" />
          Новости форума
        </p>
        <h1 className="font-display-cyrl text-4xl leading-none text-white">Лента</h1>
      </header>

      <ul className="space-y-3">
        {NEWS.map((news) => {
          const speaker = news.speakerId ? getSpeakerById(news.speakerId) : undefined;
          return (
            <li key={news.id}>
              <Link
                to={`/news/${news.id}`}
                className="block rounded-3xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-accent/30 active:scale-[0.99] transition-all p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      {news.isCritical && (
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                      )}
                      <span
                        className="text-[10px] uppercase tracking-widest font-bold"
                        style={{ color: news.isCritical ? '#fca5a5' : '#4ec9c0' }}
                      >
                        {news.type}
                      </span>
                      {news.category && (
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40">
                          · {news.category}
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-white/95 leading-snug">
                      {news.title}
                    </h2>

                    <p className="text-[13px] text-white/65 leading-relaxed line-clamp-2">
                      {news.content}
                    </p>

                    <div className="flex items-center gap-3 pt-1">
                      {speaker && (
                        <span className="text-[11px] font-semibold text-white/55">
                          {speaker.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                        <Clock className="w-3 h-3" />
                        {news.time}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-white/30 flex-shrink-0 mt-2" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
