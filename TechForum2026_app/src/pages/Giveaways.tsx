import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Zap, Laptop as LaptopIcon, Headphones, Watch, Trophy, ChevronRight, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import BackButton from '@/src/components/BackButton';

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

// Список призов от партнёров. Раньше использовались picsum.photos placeholders
// и придуманные счётчики «1240 участников» — заглушки. Когда заказчик пришлёт
// финальный список призов с реальными счётчиками — переедем на серверный
// эндпоинт /giveaways. Пока — иконки lucide вместо stock-фото.
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
    <div className="flex-1 pb-24 pt-6 px-6 space-y-8 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-6">
        <div className="space-y-1 relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent" />
          <p className="italic text-accent text-sm tracking-wide flex items-center gap-2">
            <Gift className="w-4 h-4" />
            ЗОНА ПРИЗОВ
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-[#d8f0ee]">Розыгрыши</h1>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-3xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy className="w-16 h-16 text-accent" />
          </div>
          <div className="relative z-10 space-y-2">
            <h2 className="text-lg font-semibold text-[#d8f0ee] leading-tight">Испытай удачу!</h2>
            <p className="text-[11px] text-[#7aa8a4] leading-relaxed max-w-[80%] uppercase font-semibold tracking-widest">
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
              "bg-[#0a2f38]/40 backdrop-blur-xl border rounded-[2rem] overflow-hidden transition-all group",
              participatingIds.includes(giveaway.id) ? "border-green-500/30" : "border-[#4ec9c0]/28 hover:border-accent/40"
            )}
          >
            <div className="relative h-48 overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#0a2f38]/80 to-[#03161c]">
              {/* Декоративная сетка вместо stock-фото */}
              <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id={`grid-${giveaway.id}`} width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#4ec9c0" strokeWidth="0.4" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#grid-${giveaway.id})`} />
              </svg>
              <giveaway.Icon className="w-20 h-20 text-[#4ec9c0] drop-shadow-[0_0_24px_rgba(78,201,192,0.55)]" strokeWidth={1.2} />
              <div className="absolute top-4 left-4 flex gap-2">
                {giveaway.featured && (
                  <span className="bg-[#4ec9c0] text-[#03161c] text-[9px] font-semibold px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Главный приз
                  </span>
                )}
                <span className="bg-[#03161c]/80 backdrop-blur-md text-[#d8f0ee] text-[9px] font-semibold px-3 py-1 rounded-full border border-[#4ec9c0]/22 uppercase tracking-widest flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#4ec9c0]" />
                  {giveaway.endTime}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-white leading-tight">
                  {giveaway.item}
                </h3>
                <p className="text-xs text-[#7aa8a4] font-medium">{giveaway.title}</p>
              </div>

              <p className="text-[11px] leading-relaxed text-[#7aa8a4]/80">
                {giveaway.description}
              </p>

              <div className="flex items-center justify-between pt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-accent uppercase tracking-widest">Участников</span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-accent" />
                    <span className="text-sm font-mono font-bold text-[#d8f0ee]">{giveaway.participants + (participatingIds.includes(giveaway.id) ? 1 : 0)}</span>
                  </div>
                </div>

                <button 
                  onClick={() => toggleParticipation(giveaway.id)}
                  disabled={participatingIds.includes(giveaway.id)}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-[10px] font-semibold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2",
                    participatingIds.includes(giveaway.id)
                      ? "bg-green-500/10 border border-green-500/20 text-green-500"
                      : "bg-accent text-[#03161c] shadow-lg shadow-accent/20 hover:brightness-110"
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
            className="fixed bottom-24 left-6 right-6 z-50 bg-green-500 text-[#03161c] p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white/10"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest">Вы в деле!</p>
              <p className="text-xs font-bold opacity-90">Ваш билет №{Math.floor(Math.random() * 9000) + 1000} зарегистрирован.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
