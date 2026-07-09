import { SPEAKERS } from '../data';
import { Search, Send, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/src/components/BackButton';

export default function Speakers() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filteredSpeakers = SPEAKERS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 px-5 space-y-7 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="space-y-5">
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
            className="rounded-2xl border border-border bg-card p-5 space-y-4 transition-all hover:border-primary/20 active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl border border-primary/25 flex items-center justify-center text-[18px] font-bold text-primary shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(255,51,153,0.18) 0%, rgba(255,102,178,0.10) 100%)' }}
              >
                {speaker.avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-bold text-foreground/95 truncate leading-tight">{speaker.name}</h3>
                <p className="text-[11px] text-foreground/40 truncate mt-0.5">{speaker.role}</p>
                <p className="text-[11px] text-primary/70 font-semibold truncate">{speaker.company}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/[0.06] border border-accent/15 flex items-center justify-center shrink-0">
                <Info className="w-3.5 h-3.5 text-accent/60" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[9px] text-foreground/35 font-bold uppercase tracking-[0.15em]">Тема доклада</p>
                <p className="text-[12px] text-foreground/70 font-medium leading-relaxed line-clamp-2">
                  {speaker.topic ? `«${speaker.topic}»` : 'Тема уточняется'}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => navigate('/chat')}
                aria-label={`Открыть AI-чат и спросить про ${speaker.name}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-foreground/60 hover:border-primary/25 hover:text-primary transition-all active:scale-[0.97]"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Спросить AI</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredSpeakers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-primary/25 bg-card p-8 text-center">
          <Search className="w-9 h-9 mx-auto text-foreground/25" />
          <p className="mt-3 text-foreground/50 text-[14px] font-medium">По запросу ничего не найдено</p>
          <p className="mt-1 text-[12px] text-foreground/30">Попробуйте изменить поисковый запрос</p>
        </div>
      )}
    </div>
  );
}
