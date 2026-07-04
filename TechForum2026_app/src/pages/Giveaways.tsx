import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Zap, Watch, Trophy, ChevronRight, CheckCircle2, Clock, Sparkles, Cpu, Headphones } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import BackButton from '@/src/components/BackButton';

interface Giveaway {
  id: string;
  title: string;
  item: string;
  icon: typeof Cpu;
  gradient: string;
  glowColor: string;
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
    icon: Cpu,
    gradient: 'from-[#00ffff]/20 via-[#ff3399]/10 to-[#00ffff]/5',
    glowColor: 'rgba(0,255,255,0.3)',
    description: 'Вершина производительности для разработчиков и дизайнеров. 128GB RAM, 2TB SSD.',
    endTime: 'Сегодня, 18:00',
    participants: 1240,
    featured: true,
  },
  {
    id: 'g2',
    title: 'Звук будущего',
    item: 'AirPods Max',
    icon: Headphones,
    gradient: 'from-[#ff3399]/15 via-[#a855f7]/10 to-[#ff3399]/5',
    glowColor: 'rgba(255,51,153,0.25)',
    description: 'Кристально чистый звук и адаптивное шумоподавление. Цвет "Космический серый".',
    endTime: '26 сентября, 12:00',
    participants: 856,
  },
  {
    id: 'g3',
    title: 'Для активных',
    item: 'Apple Watch Ultra 2',
    icon: Watch,
    gradient: 'from-[#a855f7]/15 via-[#00ffff]/10 to-[#a855f7]/5',
    glowColor: 'rgba(168,85,247,0.25)',
    description: 'Самые прочные и функциональные часы для экстремальных условий.',
    endTime: '26 сентября, 15:00',
    participants: 432,
  },
];

function generateTicketNumber(giveawayId: string, salt: string): number {
  let hash = 0;
  const str = giveawayId + salt;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return 1000 + Math.abs(hash % 9000);
}

export default function Giveaways() {
  const [participatingIds, setParticipatingIds] = useState<string[]>([]);
  const [ticketNumbers, setTicketNumbers] = useState<Record<string, number>>({});
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('techforum_giveaways');
    const tickets = localStorage.getItem('techforum_giveaway_tickets');
    if (stored) {
      try { setParticipatingIds(JSON.parse(stored)); } catch { /* ignore */ }
    }
    if (tickets) {
      try { setTicketNumbers(JSON.parse(tickets)); } catch { /* ignore */ }
    }
  }, []);

  const toggleParticipation = useCallback((id: string) => {
    if (participatingIds.includes(id)) return;

    const salt = Date.now().toString(36);
    const ticket = generateTicketNumber(id, salt);

    const updatedIds = [...participatingIds, id];
    const updatedTickets = { ...ticketNumbers, [id]: ticket };

    setParticipatingIds(updatedIds);
    setTicketNumbers(updatedTickets);

    localStorage.setItem('techforum_giveaways', JSON.stringify(updatedIds));
    localStorage.setItem('techforum_giveaway_tickets', JSON.stringify(updatedTickets));

    setShowSuccess(id);
    setTimeout(() => setShowSuccess(null), 3000);
  }, [participatingIds, ticketNumbers]);

  return (
    <div className="flex-1 pb-24 pt-6 px-5 space-y-7 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />

      {/* Header */}
      <header className="space-y-5">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff3399]/60 font-bold flex items-center gap-2">
            <Gift className="w-3.5 h-3.5" />
            ЗОНА ПРИЗОВ
          </p>
          <h1 className="font-elite text-3xl leading-none text-white">Розыгрыши</h1>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#00ffff]/15 bg-[#00ffff]/[0.04] p-5">
          <div className="absolute top-0 right-0 p-4 opacity-[0.06]">
            <Trophy className="w-20 h-20 text-[#00ffff]" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,255,255,0.08),transparent_60%)]" />
          <div className="relative z-10 space-y-2">
            <h2 className="text-[15px] font-bold text-white/90 leading-tight">Испытай удачу!</h2>
            <p className="text-[11px] text-white/45 leading-relaxed max-w-[85%]">
              Участвуй в розыгрышах гаджетов от наших партнёров. Победители будут объявлены на главной сцене.
            </p>
          </div>
        </div>
      </header>

      {/* Giveaway cards */}
      <div className="space-y-4">
        {GIVEAWAYS.map((giveaway) => {
          const isParticipating = participatingIds.includes(giveaway.id);
          const GiveawayIcon = giveaway.icon;

          return (
            <div
              key={giveaway.id}
              className={cn(
                'rounded-2xl overflow-hidden transition-all border',
                isParticipating
                  ? 'border-green-500/25 bg-green-500/[0.03]'
                  : 'border-white/[0.06] bg-white/[0.02]',
              )}
            >
              {/* Hero area — gradient + icon instead of external image */}
              <div className={cn('relative h-44 overflow-hidden bg-gradient-to-br', giveaway.gradient)}>
                {/* Grid texture */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }} />

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-20 h-20 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm flex items-center justify-center"
                    style={{ boxShadow: `0 0 40px ${giveaway.glowColor}` }}
                  >
                    <GiveawayIcon className="w-10 h-10 text-white/70" />
                  </div>
                </div>

                {/* Bottom gradient fade */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0e17] to-transparent" />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                  {giveaway.featured && (
                    <span className="bg-[#ff3399] text-white text-[8px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.15em] flex items-center gap-1 shadow-lg shadow-[#ff3399]/30">
                      <Sparkles className="w-2.5 h-2.5" />
                      ГЛАВНЫЙ ПРИЗ
                    </span>
                  )}
                  <span className="bg-black/50 backdrop-blur-md text-white/80 text-[8px] font-bold px-2.5 py-1 rounded-full border border-white/10 uppercase tracking-[0.1em] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-[#00ffff]" />
                    {giveaway.endTime}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-[17px] font-bold text-white/95 leading-tight">
                    {giveaway.item}
                  </h3>
                  <p className="text-[11px] text-white/40 font-medium">{giveaway.title}</p>
                </div>

                <p className="text-[12px] leading-relaxed text-white/50">
                  {giveaway.description}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-[#00ffff]/60 uppercase tracking-[0.15em]">Участников</span>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-[#00ffff]" />
                      <span className="text-[14px] font-mono font-bold text-white/90">
                        {giveaway.participants + (isParticipating ? 1 : 0)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleParticipation(giveaway.id)}
                    disabled={isParticipating}
                    className={cn(
                      'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.96] flex items-center gap-2',
                      isParticipating
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-gradient-to-r from-[#00ffff] to-[#ff3399] text-[#0a0e17] shadow-lg shadow-[#00ffff]/20',
                    )}
                  >
                    {isParticipating ? (
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
          );
        })}
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-5 right-5 z-50 bg-green-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/20"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em]">Вы в деле!</p>
              <p className="text-[12px] font-medium opacity-90">
                Ваш билет №{ticketNumbers[showSuccess] ?? '—'} зарегистрирован.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
