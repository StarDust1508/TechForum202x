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

import { useParams, Link, useNavigate } from 'react-router-dom';
import { Clock, ArrowRight, ChevronLeft, Loader2 } from 'lucide-react';
import { getSpeakerById } from '../data';
import { useNews } from '../lib/useNews';

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { news: newsList, loading } = useNews();
  const news = newsList.find((n) => n.id === id);

  // Живая новость может ещё грузиться (id из БД нет в статике) — не показываем
  // «не найдена», пока идёт первая загрузка.
  if (!news && loading) {
    return (
      <div
        className="flex-1 px-5 flex items-center justify-center"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
      </div>
    );
  }

  if (!news) {
    return (
      <div
        className="flex-1 px-5 flex flex-col items-center justify-center gap-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
      >
        <p className="text-foreground/70 text-base">Новость не найдена</p>
        <button
          type="button"
          onClick={() => navigate('/feed', { replace: true })}
          className="text-primary text-[12px] font-semibold uppercase tracking-widest hover:underline"
        >
          ← К ленте
        </button>
      </div>
    );
  }

  const speaker = news.speakerId ? getSpeakerById(news.speakerId) : undefined;

  return (
    <div
      className="flex-1 px-5 relative"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      <button
        type="button"
        onClick={() => navigate('/feed', { replace: true })}
        className="inline-flex items-center gap-2 mb-6 text-foreground/65 hover:text-foreground text-[13px] font-semibold"
      >
        <ChevronLeft className="w-4 h-4" />
        К ленте новостей
      </button>

      <article className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          {news.isCritical && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
              Важно
            </span>
          )}
          {!(news.isCritical && news.type === 'Важно') && (
            <span className="text-[10px] uppercase tracking-widest font-bold text-primary">
              {news.type}
            </span>
          )}
          {news.category && news.category.toLowerCase() !== news.type.toLowerCase() && !news.category.toLowerCase().startsWith(news.type.toLowerCase()) && (
            <span className="text-[10px] uppercase tracking-widest font-semibold text-foreground/40">
              · {news.category}
            </span>
          )}
        </div>

        <h1 className="font-display text-3xl leading-tight text-foreground">{news.title}</h1>

        <div className="flex items-center gap-3 text-[12px] text-foreground/55 font-semibold">
          <Clock className="w-3.5 h-3.5" />
          {news.time}
        </div>

        {/* Lead — короткое описание */}
        <p className="text-[15px] text-foreground/85 leading-relaxed font-medium border-l-2 border-primary/40 pl-4">
          {news.content}
        </p>

        {/* Body — длинный текст */}
        {news.body && (
          <div className="text-[15px] text-foreground/80 leading-relaxed space-y-3">
            {news.body.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {/* Карточка спикера, если новость о нём */}
        {speaker && (
          <Link
            to={`/speakers/${speaker.id}`}
            className="block rounded-3xl border border-border bg-card hover:bg-foreground/[0.07] hover:border-primary/30 active:scale-[0.99] transition-all p-5 mt-6"
          >
            <p className="text-[10px] uppercase tracking-widest font-semibold text-foreground/45 mb-2">
              О спикере
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black text-lg">
                {speaker.avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-foreground/95 font-bold text-base truncate">{speaker.name}</p>
                <p className="text-foreground/55 text-[12px] truncate">
                  {speaker.role}, {speaker.company}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary/70 flex-shrink-0" />
            </div>
          </Link>
        )}
      </article>
    </div>
  );
}
