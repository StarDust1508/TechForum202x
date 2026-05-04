import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Zap, Laptop as LaptopIcon, Headphones, Watch, Trophy, ChevronRight, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import PageShell from '@/src/components/ui/PageShell';

interface Giveaway {
  id: string;
  title: string;
  item: string;
  Icon: typeof LaptopIcon;
  description: string;
  endTime: string;
  participants: number;
  featured?: boolean;
}

const GIVEAWAYS: Giveaway[] = [
  {
    id: 'g1',
    title: 'Главный приз',
    item: 'Топовый ноутбук от партнёра',
    Icon: LaptopIcon,
    description: 'Розыгрыш ноутбука среди всех участников форума, прошедших регистрацию на месте.',
    endTime: '21 мая, 18:00',
    participants: 0,
    featured: true,
  },
  {
    id: 'g2',
    title: 'Звук будущего',
    item: 'Беспроводные наушники',
    Icon: Headphones,
    description: 'Премиальные наушники с активным шумоподавлением от партнёра форума.',
    endTime: '21 мая, 16:00',
    participants: 0,
  },
  {
    id: 'g3',
    title: 'Для активных',
    item: 'Smart-часы',
    Icon: Watch,
    description: 'Часы с продвинутым health-tracking от технологического партнёра.',
    endTime: '21 мая, 15:00',
    participants: 0,
  },
];

const LS_KEY = 'techforum_giveaways';

export default function Giveaways() {
  const [participatingIds, setParticipatingIds] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [ticketNo, setTicketNo] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setParticipatingIds(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to load giveaway data', e);
    }
  }, []);

  const join = (id: string) => {
    if (participatingIds.includes(id)) return;
    const updated = [...participatingIds, id];
    setParticipatingIds(updated);
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch { /* noop */ }
    setTicketNo(Math.floor(Math.random() * 9000) + 1000);
    setShowSuccess(id);
    window.setTimeout(() => setShowSuccess(null), 3000);
  };

  return (
    <PageShell kicker="Зона призов" title="Розыгрыши">
      <div className="rounded-3xl border border-[#4ec9c0]/30 bg-[#0a2f38]/55 p-5 mb-6 relative overflow-hidden">
        <Trophy className="absolute -right-4 -top-4 w-24 h-24 text-[#4ec9c0]/10" strokeWidth={1.2} />
        <div className="relative z-10 flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl border border-[#4ec9c0]/35 bg-[#03161c]/60 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-[#4ec9c0]" strokeWidth={1.6} />
          </div>
          <div>
            <h2 className="font-display-cyrl text-[18px] font-semibold text-[#d8f0ee] leading-tight">Испытай удачу</h2>
            <p className="text-[12px] text-[#7aa8a4] leading-relaxed mt-1">
              Участвуй в розыгрышах гаджетов от партнёров. Победители объявят на главной сцене.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {GIVEAWAYS.map((giveaway) => {
          const joined = participatingIds.includes(giveaway.id);
          return (
            <article
              key={giveaway.id}
              className={cn(
                'rounded-3xl border bg-[#0a2f38]/40 overflow-hidden transition-all',
                joined ? 'border-emerald-500/35' : 'border-[#4ec9c0]/22 hover:border-[#4ec9c0]/45',
              )}
            >
              <div className="relative h-44 overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#0a2f38]/80 to-[#03161c]">
                <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id={`grid-${giveaway.id}`} width="28" height="28" patternUnits="userSpaceOnUse">
                      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#4ec9c0" strokeWidth="0.4" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#grid-${giveaway.id})`} />
                </svg>
                <giveaway.Icon className="w-20 h-20 text-[#4ec9c0] drop-shadow-[0_0_24px_rgba(78,201,192,0.55)]" strokeWidth={1.2} />
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {giveaway.featured && (
                    <span className="bg-[#4ec9c0] text-[#03161c] font-mono text-[9px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                      <Sparkles className="w-3 h-3" strokeWidth={2} />
                      Главный
                    </span>
                  )}
                  <span className="bg-[#03161c]/80 backdrop-blur-md text-[#d8f0ee] font-mono text-[9px] font-semibold px-2.5 py-0.5 rounded-full border border-[#4ec9c0]/30 uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#4ec9c0]" strokeWidth={1.6} />
                    {giveaway.endTime}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <h3 className="font-display-cyrl text-[18px] font-semibold text-[#d8f0ee] leading-tight">{giveaway.item}</h3>
                  <p className="text-[11px] text-[#4ec9c0] uppercase tracking-widest mt-1">{giveaway.title}</p>
                </div>

                <p className="text-[12px] leading-relaxed text-[#7aa8a4]">{giveaway.description}</p>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold text-[#7aa8a4] uppercase tracking-[0.22em]">Участников</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Zap className="w-3 h-3 text-[#4ec9c0]" strokeWidth={2} />
                      <span className="text-[14px] font-mono font-semibold text-[#d8f0ee]">
                        {giveaway.participants + (joined ? 1 : 0)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => join(giveaway.id)}
                    disabled={joined}
                    className={cn(
                      'px-5 py-2.5 rounded-[12px] text-[11px] font-semibold uppercase tracking-[0.16em] transition-all active:scale-95 flex items-center gap-2 font-display-cyrl',
                      joined
                        ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border border-[#4ec9c0]/55 bg-[#0a2f38]/70 text-[#d8f0ee] hover:border-[#4ec9c0]/80 hover:bg-[#0e3a44]/80',
                    )}
                  >
                    {joined ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                        Участвую
                      </>
                    ) : (
                      <>
                        Участвовать
                        <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-6 right-6 z-50 rounded-2xl bg-[#0a2f38]/95 backdrop-blur border border-emerald-500/40 p-4 shadow-2xl flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-[10px] bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-emerald-300" strokeWidth={1.6} />
            </div>
            <div>
              <p className="font-display-cyrl text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Вы в деле</p>
              <p className="text-[12px] text-[#d8f0ee]/85 mt-0.5">
                Ваш билет № <span className="font-mono">{ticketNo}</span> зарегистрирован
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
