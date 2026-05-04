import { useParams, Link, useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { NEWS, getSpeakerById } from '../data';
import PageShell from '@/src/components/ui/PageShell';

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const news = NEWS.find((n) => n.id === id);
  const navigate = useNavigate();

  if (!news) {
    return (
      <PageShell kicker="Ошибка" title="Новость не найдена">
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-[#7aa8a4]">Возможно, ссылка устарела.</p>
          <button
            type="button"
            onClick={() => navigate('/feed')}
            className="text-[#4ec9c0] text-[12px] font-semibold uppercase tracking-widest hover:underline"
          >
            ← К ленте
          </button>
        </div>
      </PageShell>
    );
  }

  const speaker = news.speakerId ? getSpeakerById(news.speakerId) : undefined;

  return (
    <PageShell
      kicker={news.type}
      title={news.title}
    >
      <article className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          {news.isCritical && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-semibold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
              Важно
            </span>
          )}
          {news.category && (
            <span className="font-mono text-[10px] uppercase tracking-widest font-semibold text-[#7aa8a4]">
              {news.category}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-[#7aa8a4]">
            <Clock className="w-3 h-3" strokeWidth={1.6} />
            {news.time}
          </span>
        </div>

        <p className="text-[15px] text-[#d8f0ee]/90 leading-relaxed border-l-2 border-[#4ec9c0]/55 pl-4">
          {news.content}
        </p>

        {news.body && (
          <div className="text-[15px] text-[#d8f0ee]/80 leading-relaxed space-y-3 font-blueprint">
            {news.body.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {speaker && (
          <Link
            to="/speakers"
            className="block rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 hover:border-[#4ec9c0]/55 active:scale-[0.99] transition-all p-5 mt-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest font-semibold text-[#7aa8a4] mb-2">
              О спикере
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[14px] border border-[#4ec9c0]/40 bg-[#03161c]/60 flex items-center justify-center text-[#4ec9c0] font-display-cyrl text-[20px] font-semibold">
                {speaker.avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display-cyrl text-[16px] font-semibold text-[#d8f0ee] truncate">{speaker.name}</p>
                <p className="text-[12px] text-[#7aa8a4] truncate">
                  {speaker.role}, {speaker.company}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#4ec9c0]/70 flex-shrink-0" strokeWidth={1.6} />
            </div>
          </Link>
        )}
      </article>
    </PageShell>
  );
}
