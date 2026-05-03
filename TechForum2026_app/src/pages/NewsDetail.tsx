// FILE: src/pages/NewsDetail.tsx
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Страница деталей новости. Открывается из ленты Feed по /news/:id.
// SCOPE: UI only.
// INPUT: route param :id, ищется в NEWS из data.ts.
// OUTPUT: JSX страница.
// KEYWORDS: DOMAIN(7): NewsDetail; TECH(6): React, ReactRouter
// LINKS: USED_BY(8): App.tsx route /news/:id
// END_MODULE_CONTRACT

import { useParams, Link } from 'react-router-dom';
import { Clock, ArrowRight, ChevronLeft } from 'lucide-react';
import { NEWS, getSpeakerById } from '../data';

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const news = NEWS.find((n) => n.id === id);

  if (!news) {
    return (
      <div
        className="flex-1 px-5 pb-12 flex flex-col items-center justify-center gap-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
      >
        <p className="text-white/70 text-base">Новость не найдена</p>
        <Link
          to="/feed"
          className="text-accent text-[12px] font-semibold uppercase tracking-widest hover:underline"
        >
          ← К ленте
        </Link>
      </div>
    );
  }

  const speaker = news.speakerId ? getSpeakerById(news.speakerId) : undefined;

  return (
    <div
      className="flex-1 px-5 pb-16 relative"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      {/* Back arrow with text label — собственная кнопка, не floating BackButton */}
      <Link
        to="/feed"
        className="inline-flex items-center gap-2 mb-6 text-white/65 hover:text-white text-[13px] font-semibold"
      >
        <ChevronLeft className="w-4 h-4" />
        К ленте новостей
      </Link>

      <article className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          {news.isCritical && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
              Важно
            </span>
          )}
          <span className="text-[10px] uppercase tracking-widest font-bold text-accent">
            {news.type}
          </span>
          {news.category && (
            <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40">
              · {news.category}
            </span>
          )}
        </div>

        <h1 className="font-display-cyrl text-3xl leading-tight text-white">{news.title}</h1>

        <div className="flex items-center gap-3 text-[12px] text-white/55 font-semibold">
          <Clock className="w-3.5 h-3.5" />
          {news.time}
        </div>

        {/* Lead — короткое описание */}
        <p className="text-[15px] text-white/85 leading-relaxed font-medium border-l-2 border-accent/40 pl-4">
          {news.content}
        </p>

        {/* Body — длинный текст */}
        {news.body && (
          <div className="text-[15px] text-white/80 leading-relaxed space-y-3">
            {news.body.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {/* Карточка спикера, если новость о нём */}
        {speaker && (
          <Link
            to="/speakers"
            className="block rounded-3xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-accent/30 active:scale-[0.99] transition-all p-5 mt-6"
          >
            <p className="text-[10px] uppercase tracking-widest font-semibold text-white/45 mb-2">
              О спикере
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-semibold text-lg">
                {speaker.avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/95 font-bold text-base truncate">{speaker.name}</p>
                <p className="text-white/55 text-[12px] truncate">
                  {speaker.role}, {speaker.company}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-accent/70 flex-shrink-0" />
            </div>
          </Link>
        )}
      </article>
    </div>
  );
}
