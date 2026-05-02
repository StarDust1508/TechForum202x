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
    <div className="flex-1 pb-24 pt-6 px-6 space-y-8 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-6">
        <div className="space-y-1 relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent glow-accent" />
          <p className="italic text-accent text-sm tracking-wide flex items-center gap-2">
            <Mic2 className="w-4 h-4" />
            СПРАВОЧНИК ЭКСПЕРТОВ
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-primary">Спикеры</h1>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent rounded-full" />
            <p className="text-[10px] text-muted font-bold tracking-widest uppercase">{filteredSpeakers.length} человек на сцене</p>
          </div>
        </div>
        
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            placeholder="Поиск по имени или компании..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#13161f] border border-card-border rounded-[1.75rem] py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-accent/40 placeholder:text-muted/40 transition-all font-medium shadow-inner"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5">
        <div>
          {filteredSpeakers.map((speaker, i) => (
            <div 
              key={speaker.id}
              className="mb-5 bg-[#13161f]/40 backdrop-blur-xl border border-card-border p-6 rounded-3xl hover:border-accent/30 group shadow-2xl relative overflow-hidden circuit-border"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 blur-3xl rounded-full" />
              
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-accent border-[3px] border-surface rounded-[1.5rem] flex items-center justify-center text-xl font-black text-surface shrink-0 group-hover:scale-105 transition-transform rotate-3 hover:rotate-0 shadow-lg">
                  {speaker.avatarLetter}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-xl text-primary truncate group-hover:text-accent transition-colors leading-none mb-1">{speaker.name}</h3>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted text-[10px] font-bold uppercase tracking-widest truncate">{speaker.role}</span>
                    <span className="text-accent text-[11px] font-black uppercase tracking-widest underline decoration-accent/20 underline-offset-4">{speaker.company}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 rounded-3xl bg-surface/50 border border-card-border flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-muted font-black uppercase tracking-widest leading-none">Тема доклада</p>
                  <p className="text-xs text-primary font-medium line-clamp-2 leading-relaxed italic opacity-90">
                    «{speaker.topic || "Цифровая трансформация в 2026 году: тренды и вызовы"}»
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => navigate('/chat')}
                  aria-label={`Открыть AI-чат и спросить про ${speaker.name}`}
                  className="bg-surface border border-card-border hover:border-accent px-5 py-2.5 rounded-2xl flex items-center gap-2 text-primary hover:text-accent transition-all active:scale-95 group/btn"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">Спросить AI</span>
                  <Send className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {filteredSpeakers.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <p className="text-muted font-medium">Ничего не найдено</p>
        </div>
      )}
    </div>
  );
}
