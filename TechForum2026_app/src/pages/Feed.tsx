// FILE: src/pages/Feed.tsx
// VERSION: 3.1.0
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
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v3.1.0 - Visual refresh: unified design language (cyan/magenta),
//                       consistent spacing, improved card contrast and hierarchy.]
// PREV_CHANGE_SUMMARY: [v3.0.0 - Полный рерайт под "Новости от спикеров".]
// END_CHANGE_SUMMARY

import { Clock, ChevronRight, MessageCircle, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { getSpeakerById } from '../data';
import { useNews } from '../lib/useNews';
import BackButton from '@/src/components/BackButton';

export default function Feed() {
  const { news: NEWS } = useNews();
  return (
    <div
      className="flex-1 px-5 relative"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
      }}
    >
      {/* 3 колонки: назад (слева) · Лента (центр) · чат (справа) — симметрия */}
      <header className="sticky top-0 z-20 -mx-5 px-5 pt-1 pb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 mb-7 bg-background/90 backdrop-blur-md border-b border-border">
        <BackButton to="/" />
        <h1
          className="font-display text-[28px] leading-none font-bold text-center"
          style={{
            background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >Лента</h1>
        <Link
          to="/chat"
          aria-label="Чат"
          className="shrink-0 h-10 w-10 flex items-center justify-center rounded-2xl border border-border bg-card backdrop-blur-md text-foreground/85 hover:text-primary hover:border-primary/40 active:scale-90 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
        >
          <MessageCircle className="h-5 w-5" />
        </Link>
      </header>

      <ul className="space-y-3">
        {NEWS.map((news, idx) => {
          const speaker = news.speakerId ? getSpeakerById(news.speakerId) : undefined;
          return (
            <motion.li
              key={news.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4), ease: [0.32, 0.72, 0, 1] }}
            >
              <Link
                to={`/news/${news.id}`}
                className="block rounded-2xl border border-border bg-card hover:border-primary/20 active:scale-[0.99] transition-all p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-center gap-2">
                      {news.isCritical && (
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                      )}
                      {!(news.isCritical && news.type === 'Важно') && (
                        <span
                          className="text-[10px] uppercase tracking-[0.15em] font-bold"
                          style={{ color: news.isCritical ? '#fca5a5' : '#00ffff' }}
                        >
                          {news.type}
                        </span>
                      )}
                      {news.category && news.category.toLowerCase() !== news.type.toLowerCase() && !news.category.toLowerCase().startsWith(news.type.toLowerCase()) && (
                        <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-foreground/30">
                          · {news.category}
                        </span>
                      )}
                    </div>

                    <h2 className="text-[15px] font-bold text-foreground/95 leading-snug">
                      {news.title}
                    </h2>

                    <p className="text-[12px] text-foreground/50 leading-relaxed line-clamp-2">
                      {news.content}
                    </p>

                    <div className="flex items-center gap-3 pt-0.5">
                      {speaker && (
                        <span className="text-[11px] font-semibold text-foreground/45">
                          {speaker.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-foreground/30 font-semibold">
                        <Clock className="w-3 h-3" />
                        {news.time}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-foreground/20 flex-shrink-0 mt-2" />
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ul>
      {NEWS.length === 0 && (
        <section className="rounded-3xl border border-accent/25 bg-card/90 p-6 text-center">
          <Send className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-4 font-display text-lg">Новости — в TechPravoAI</h2>
          <p className="mt-2 text-[13px] leading-6 text-foreground/55">Анонсы программы, новые спикеры и важные обновления публикуем в официальном Telegram-канале.</p>
          <a href="https://t.me/TechPravoAI" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-accent px-5 font-bold text-background">Открыть канал</a>
        </section>
      )}
    </div>
  );
}
