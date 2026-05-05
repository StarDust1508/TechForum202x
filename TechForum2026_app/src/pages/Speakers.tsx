import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, Info, X, ChevronRight } from 'lucide-react';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import { useSpeakers } from '@/src/lib/programData';

export default function Speakers() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data: speakersList, loading } = useSpeakers();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return speakersList;
    return speakersList.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.company.toLowerCase().includes(q) ||
      (s.topic ? s.topic.toLowerCase().includes(q) : false),
    );
  }, [search, speakersList]);

  return (
    <PageShell title="Спикеры">
      <div className="relative mb-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#4ec9c0]/65"
          strokeWidth={1.6}
        />
        <input
          type="text"
          placeholder="Имя, компания, тема…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
          className="w-full rounded-[14px] border border-[#4ec9c0]/30 bg-[#03161c]/40 py-3.5 pl-12 pr-12 text-[15px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/65 outline-none focus:border-[#4ec9c0]/70 focus:bg-[#0a2f38]/55 transition-colors font-blueprint"
        />
        {search && (
          <button
            type="button"
            aria-label="Очистить"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[#7aa8a4] hover:text-[#d8f0ee]"
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {loading && filtered.length === 0 ? (
        <div className="space-y-3.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-5 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="rounded-[14px]" width={56} height={56} />
                <div className="flex-1 space-y-2">
                  <Skeleton height={18} width="65%" />
                  <Skeleton height={11} width="50%" />
                  <Skeleton height={10} width="40%" />
                </div>
              </div>
              <Skeleton height={50} />
            </div>
          ))}
        </div>
      ) : (
      <div className="space-y-3.5">
        {filtered.map((speaker, idx) => (
          <motion.article
            key={speaker.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.32,
              ease: [0.32, 0.72, 0, 1],
              delay: Math.min(idx * 0.035, 0.4),
            }}
            className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-5 space-y-4 hover:border-[#4ec9c0]/45 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[14px] border border-[#4ec9c0]/40 bg-[#03161c]/60 flex items-center justify-center text-[#4ec9c0] font-display-cyrl text-[22px] font-semibold shrink-0">
                {speaker.avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display-cyrl text-[18px] font-semibold text-[#d8f0ee] truncate leading-tight">{speaker.name}</h3>
                <p className="text-[12px] text-[#7aa8a4] truncate mt-0.5">{speaker.role}</p>
                <p className="text-[11px] text-[#4ec9c0] uppercase tracking-widest truncate mt-0.5">{speaker.company}</p>
              </div>
            </div>

            {speaker.topic && (
              <div className="rounded-2xl bg-[#03161c]/50 border border-[#4ec9c0]/22 p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-[#4ec9c0] shrink-0 mt-0.5" strokeWidth={1.6} />
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] text-[#7aa8a4] uppercase tracking-[0.22em] font-semibold">Тема доклада</p>
                  <p className="text-[13px] text-[#d8f0ee]/90 leading-relaxed">«{speaker.topic}»</p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => navigate(`/speakers/${speaker.id}`)}
                aria-label={`Открыть подробную биографию: ${speaker.name}`}
                className="border border-[#4ec9c0]/40 bg-[#03161c]/60 hover:border-[#4ec9c0]/70 hover:bg-[#0a2f38]/70 px-4 py-2 rounded-[12px] flex items-center gap-2 text-[#4ec9c0] hover:text-[#d8f0ee] transition-all active:scale-95"
              >
                <span className="font-display-cyrl text-[11px] font-semibold uppercase tracking-[0.16em]">О спикере</span>
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.6} />
              </button>
            </div>
          </motion.article>
        ))}
      </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-[#7aa8a4]">По запросу «{search}» никого не нашли</p>
        </div>
      )}
    </PageShell>
  );
}
