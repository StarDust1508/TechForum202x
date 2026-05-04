import { Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NEWS, getSpeakerById } from '../data';
import PageShell from '@/src/components/ui/PageShell';

export default function Feed() {
  return (
    <PageShell kicker="Новости форума" title="Лента" subtitle={`${NEWS.length} материалов от спикеров`}>
      <ul className="space-y-3">
        {NEWS.map((news) => {
          const speaker = news.speakerId ? getSpeakerById(news.speakerId) : undefined;
          return (
            <li key={news.id}>
              <Link
                to={`/news/${news.id}`}
                className="block rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 hover:border-[#4ec9c0]/55 hover:bg-[#0a2f38]/55 active:scale-[0.99] transition-all p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      {news.isCritical && (
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                      )}
                      <span
                        className="font-mono text-[10px] uppercase tracking-widest font-semibold"
                        style={{ color: news.isCritical ? '#fca5a5' : '#4ec9c0' }}
                      >
                        {news.type}
                      </span>
                      {news.category && (
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-[#7aa8a4]">
                          · {news.category}
                        </span>
                      )}
                    </div>

                    <h2 className="font-display-cyrl text-[17px] font-semibold text-[#d8f0ee] leading-snug">
                      {news.title}
                    </h2>

                    <p className="text-[13px] text-[#d8f0ee]/70 leading-relaxed line-clamp-2">
                      {news.content}
                    </p>

                    <div className="flex items-center gap-3 pt-1">
                      {speaker && (
                        <span className="text-[11px] font-semibold text-[#7aa8a4]">
                          {speaker.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#7aa8a4]/70 font-semibold">
                        <Clock className="w-3 h-3" strokeWidth={1.6} />
                        {news.time}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-[#4ec9c0]/40 flex-shrink-0 mt-2" strokeWidth={1.6} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
