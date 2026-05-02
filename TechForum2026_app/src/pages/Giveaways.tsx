import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Zap, Laptop, Headphones, Trophy, ChevronRight, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface Giveaway {
  id: string;
  title: string;
  item: string;
  image: string;
  description: string;
  endTime: string;
  participants: number;
  featured?: boolean;
}

const GIVEAWAYS: Giveaway[] = [
  {
    id: 'g1',
    title: 'Главный приз форума',
    item: 'MacBook Pro 16" M3 Max',
    image: 'https://picsum.photos/seed/macbook/800/600',
    description: 'Вершина производительности для разработчиков и дизайнеров. 128GB RAM, 2TB SSD.',
    endTime: 'Сегодня, 18:00',
    participants: 1240,
    featured: true
  },
  {
    id: 'g2',
    title: 'Звук будущего',
    item: 'AirPods Max',
    image: 'https://picsum.photos/seed/airpods/800/600',
    description: 'Кристально чистый звук и адаптивное шумоподавление. Цвет "Космический серый".',
    endTime: '16 мая, 12:00',
    participants: 856
  },
  {
    id: 'g3',
    title: 'Для активных',
    item: 'Apple Watch Ultra 2',
    image: 'https://picsum.photos/seed/watch/800/600',
    description: 'Самые прочные и функциональные часы для экстремальных условий.',
    endTime: '16 мая, 15:00',
    participants: 432
  }
];

export default function Giveaways() {
  const [participatingIds, setParticipatingIds] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('techforum_giveaways');
    if (stored) {
      try {
        setParticipatingIds(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load giveaway data", e);
      }
    }
  }, []);

  const toggleParticipation = (id: string) => {
    if (participatingIds.includes(id)) return;

    const updated = [...participatingIds, id];
    setParticipatingIds(updated);
    localStorage.setItem('techforum_giveaways', JSON.stringify(updated));
    setShowSuccess(id);
    setTimeout(() => setShowSuccess(null), 3000);
  };

  return (
    <div className="flex-1 pb-24 pt-6 px-6 space-y-8 bg-tech-grid min-h-full relative">
      <header className="space-y-6">
        <div className="space-y-1 relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent glow-accent" />
          <p className="italic text-accent text-sm tracking-wide flex items-center gap-2">
            <Gift className="w-4 h-4" />
            ЗОНА ПРИЗОВ
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-primary">Розыгрыши</h1>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy className="w-16 h-16 text-accent" />
          </div>
          <div className="relative z-10 space-y-2">
            <h2 className="text-lg font-black text-primary leading-tight">Испытай удачу!</h2>
            <p className="text-[11px] text-muted leading-relaxed max-w-[80%] uppercase font-black tracking-widest">
              Учувствуй в розыгрышах гаджетов от наших партнеров. Победители будут объявлены на главной сцене.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {GIVEAWAYS.map((giveaway) => (
          <div 
            key={giveaway.id}
            className={cn(
              "bg-[#13161f]/40 backdrop-blur-xl border rounded-[2rem] overflow-hidden transition-all group",
              participatingIds.includes(giveaway.id) ? "border-green-500/30" : "border-card-border hover:border-accent/40"
            )}
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src={giveaway.image} 
                alt={giveaway.item}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] to-transparent" />
              <div className="absolute top-4 left-4 flex gap-2">
                {giveaway.featured && (
                  <span className="bg-accent text-surface text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-accent/20">
                    <Sparkles className="w-3 h-3" />
                    MAIN PRIZE
                  </span>
                )}
                <span className="bg-[#0b0e14]/80 backdrop-blur-md text-primary text-[9px] font-black px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest flex items-center gap-1">
                  <Clock className="w-3 h-3 text-accent" />
                  {giveaway.endTime}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white leading-tight">
                  {giveaway.item}
                </h3>
                <p className="text-xs text-muted font-medium">{giveaway.title}</p>
              </div>

              <p className="text-[11px] leading-relaxed text-muted/80">
                {giveaway.description}
              </p>

              <div className="flex items-center justify-between pt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-accent uppercase tracking-widest">Участников</span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-accent" />
                    <span className="text-sm font-mono font-bold text-primary">{giveaway.participants + (participatingIds.includes(giveaway.id) ? 1 : 0)}</span>
                  </div>
                </div>

                <button 
                  onClick={() => toggleParticipation(giveaway.id)}
                  disabled={participatingIds.includes(giveaway.id)}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2",
                    participatingIds.includes(giveaway.id)
                      ? "bg-green-500/10 border border-green-500/20 text-green-500"
                      : "bg-accent text-surface shadow-lg shadow-accent/20 hover:brightness-110"
                  )}
                >
                  {participatingIds.includes(giveaway.id) ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Участвую
                    </>
                  ) : (
                    <>
                      Участвовать
                      <ChevronRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-6 right-6 z-50 bg-green-500 text-surface p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white/10"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest">Вы в деле!</p>
              <p className="text-xs font-bold opacity-90">Ваш билет №{Math.floor(Math.random() * 9000) + 1000} зарегистрирован.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
