import { Search, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/src/components/BackButton';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';

// Спикеры тянутся из API (GET /speakers), который живым синком отражает
// опубликованных спикеров сайта — с фото. Новые спикеры появляются сами,
// без пересборки приложения.
interface ApiSpeaker {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarLetter: string;
  avatarUrl?: string | null;
  topic?: string | null;
  trackId: string;
}

export default function Speakers() {
  const [search, setSearch] = useState('');
  const [speakers, setSpeakers] = useState<ApiSpeaker[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(resolveApiUrl('/speakers'));
        if (r.ok && !cancelled) {
          const data = await r.json();
          if (Array.isArray(data)) setSpeakers(data);
        }
      } catch {
        /* offline — экран покажет пустое состояние */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredSpeakers = speakers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 px-5 space-y-7 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="sticky top-0 z-20 -mx-5 px-5 pt-1 pb-4 space-y-5 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1
              className="font-display text-[28px] leading-none font-bold"
              style={{
                background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >Спикеры</h1>
          </div>
          <p className="text-[13px] text-foreground/40 ml-[52px]">{filteredSpeakers.length} человек на сцене</p>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Поиск по имени или компании..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl py-3.5 pl-11 pr-5 text-[13px] focus:outline-none focus:border-primary/30 placeholder:text-foreground/25 transition-all font-medium text-foreground/90"
          />
        </div>
      </header>

      <div className="space-y-3">
        {filteredSpeakers.map((speaker, idx) => (
          <motion.div
            key={speaker.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4), ease: [0.32, 0.72, 0, 1] }}
            onClick={() => navigate(`/speakers/${speaker.id}`)}
            className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/25 active:scale-[0.98] cursor-pointer"
          >
            <div className="flex gap-4">
              {speaker.avatarUrl ? (
                <img
                  src={resolveAssetUrl(speaker.avatarUrl)}
                  alt={speaker.name}
                  loading="lazy"
                  className="w-16 h-16 rounded-2xl border border-primary/25 object-cover shrink-0 bg-background"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl border border-primary/25 flex items-center justify-center text-[20px] font-bold text-primary shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(255,51,153,0.18) 0%, rgba(0,255,255,0.08) 100%)' }}
                >
                  {speaker.avatarLetter}
                </div>
              )}
              {/* Иерархия: имя (крупно, переносится) → роль (приглушённо) → компания (акцент) */}
              <div className="flex-1 min-w-0 self-center">
                <h3 className="text-[17px] font-bold text-foreground leading-snug">{speaker.name}</h3>
                <p className="text-[12px] text-foreground/45 mt-1 leading-tight line-clamp-1">{speaker.role}</p>
                <p className="text-[12px] text-primary/80 font-semibold mt-0.5 line-clamp-1">{speaker.company}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground/25 shrink-0 self-center" />
            </div>

            {speaker.topic && (
              <div className="mt-4 border-l-2 border-accent/50 pl-3.5">
                <p className="text-[9px] text-accent/70 font-bold uppercase tracking-[0.15em] mb-1">Тема доклада</p>
                <p className="text-[13px] text-foreground/75 leading-relaxed line-clamp-2">«{speaker.topic}»</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {filteredSpeakers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-primary/25 bg-card p-8 text-center">
          <Search className="w-9 h-9 mx-auto text-foreground/25" />
          <p className="mt-3 text-foreground/50 text-[14px] font-medium">Спикеры загружаются…</p>
          <p className="mt-1 text-[12px] text-foreground/30">Если список пуст — проверьте соединение</p>
        </div>
      )}
    </div>
  );
}
