import { SPEAKERS } from '../data';
import { Search, Send, Info, Mic2 } from 'lucide-react';
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
    <div className="flex-1 pb-24 pt-6 px-5 space-y-7 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />

      <header className="space-y-5">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff3399]/60 font-bold flex items-center gap-2">
            <Mic2 className="w-3.5 h-3.5" />
            СПРАВОЧНИК ЭКСПЕРТОВ
          </p>
          <h1 className="font-elite text-3xl leading-none text-white">Спикеры</h1>
          <p className="text-[13px] text-white/40">{filteredSpeakers.length} человек на сцене</p>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#00ffff] transition-colors" />
          <input
            type="text"
            placeholder="Поиск по имени или компании..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3.5 pl-11 pr-5 text-[13px] focus:outline-none focus:border-[#00ffff]/30 placeholder:text-white/25 transition-all font-medium text-white/90"
          />
        </div>
      </header>

      <div className="space-y-3">
        {filteredSpeakers.map((speaker) => (
          <div
            key={speaker.id}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4 transition-all hover:border-[#00ffff]/20"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00ffff]/20 to-[#ff3399]/10 border border-[#00ffff]/15 flex items-center justify-center text-[18px] font-bold text-[#00ffff] shrink-0">
                {speaker.avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[16px] font-bold text-white/95 truncate leading-tight">{speaker.name}</h3>
                <p className="text-[11px] text-white/40 truncate mt-0.5">{speaker.role}</p>
                <p className="text-[11px] text-[#00ffff]/70 font-semibold truncate">{speaker.company}</p>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00ffff]/[0.06] border border-[#00ffff]/15 flex items-center justify-center shrink-0">
                <Info className="w-3.5 h-3.5 text-[#00ffff]/60" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[9px] text-white/35 font-bold uppercase tracking-[0.15em]">Тема доклада</p>
                <p className="text-[12px] text-white/70 font-medium leading-relaxed line-clamp-2">
                  «{speaker.topic || 'Цифровая трансформация в 2026 году: тренды и вызовы'}»
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => navigate('/chat')}
                aria-label={`Открыть AI-чат и спросить про ${speaker.name}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 hover:border-[#00ffff]/25 hover:text-[#00ffff] transition-all active:scale-[0.97]"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Спросить AI</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredSpeakers.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-white/40 text-[14px] font-medium">Ничего не найдено</p>
        </div>
      )}
    </div>
  );
}
