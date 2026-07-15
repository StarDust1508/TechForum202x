import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift,
  Zap,
  Trophy,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Ticket,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import BackButton from '@/src/components/BackButton';

interface Giveaway {
  id: string;
  title: string;
  item: string;
  image: string;
  gradient: string;
  accentColor: string;
  description: string;
  condition: string;
  endTime: string;
  participants: number;
  featured?: boolean;
}

const GIVEAWAYS: Giveaway[] = [
  {
    id: 'g1',
    title: 'Главный приз форума',
    item: 'MacBook Pro 16" M3 Max',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80',
    gradient: 'from-[#ff3399]/30 via-[#a855f7]/15 to-transparent',
    accentColor: '#ff3399',
    description: 'Вершина производительности для разработчиков и дизайнеров. 128GB RAM, 2TB SSD, 40-ядерный GPU.',
    condition: 'Посетить 3 доклада и оставить отзыв',
    endTime: 'Сегодня, 18:00',
    participants: 1240,
    featured: true,
  },
  {
    id: 'g2',
    title: 'Звук будущего',
    item: 'AirPods Max',
    image: 'https://images.unsplash.com/photo-1625245488600-f03fef636a3c?w=600&q=80',
    gradient: 'from-[#6366f1]/25 via-[#8b5cf6]/12 to-transparent',
    accentColor: '#8b5cf6',
    description: 'Кристально чистый звук и адаптивное шумоподавление. Цвет «Космический серый».',
    condition: 'Зарегистрироваться в приложении и заполнить профиль',
    endTime: '28 сентября, 16:00',
    participants: 856,
  },
  {
    id: 'g3',
    title: 'Для активных',
    item: 'Apple Watch Ultra 2',
    image: 'https://images.unsplash.com/photo-1551816230-ef5deaed4a26?w=600&q=80',
    gradient: 'from-[#f97316]/25 via-[#ef4444]/12 to-transparent',
    accentColor: '#f97316',
    description: 'Самые прочные и функциональные часы Apple для экстремальных условий и профессионального спорта.',
    condition: 'Обменяться контактами с 5 участниками',
    endTime: '28 сентября, 17:00',
    participants: 432,
  },
  {
    id: 'g4',
    title: 'Погружение в музыку',
    item: 'Sony WH-1000XM5',
    image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80',
    gradient: 'from-[#06b6d4]/25 via-[#0ea5e9]/12 to-transparent',
    accentColor: '#06b6d4',
    description: 'Флагманские наушники с лучшим в классе шумоподавлением и 30 часами автономной работы.',
    condition: 'Задать вопрос спикеру на Q&A сессии',
    endTime: '28 сентября, 19:00',
    participants: 678,
  },
  {
    id: 'g5',
    title: 'Для книголюбов',
    item: 'Kindle Paperwhite',
    image: 'https://images.unsplash.com/photo-1594377157609-5c996118ac7f?w=600&q=80',
    gradient: 'from-[#10b981]/25 via-[#34d399]/12 to-transparent',
    accentColor: '#10b981',
    description: 'Электронная книга с экраном 6.8", водозащитой IPX8 и 10 неделями автономной работы.',
    condition: 'Поделиться фото с форума в соцсетях с хэштегом #ТехнологииПрава2026',
    endTime: '28 сентября, 20:00',
    participants: 312,
  },
  {
    id: 'g6',
    title: 'Умный дом',
    item: 'Яндекс Станция Макс',
    image: 'https://images.unsplash.com/photo-1543512214-318228f2e004?w=600&q=80',
    gradient: 'from-[#eab308]/25 via-[#f59e0b]/12 to-transparent',
    accentColor: '#eab308',
    description: 'Умная колонка с Алисой, LED-дисплеем и звуком студийного качества для вашего дома.',
    condition: 'Пройти AI-квиз в зоне партнёров',
    endTime: '28 сентября, 21:00',
    participants: 543,
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
  const [toastMessage, setToastMessage] = useState<{ id: string; type: 'join' | 'leave' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup toast timer on unmount
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

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
    const isCurrentlyParticipating = participatingIds.includes(id);

    if (isCurrentlyParticipating) {
      const updatedIds = participatingIds.filter((pid) => pid !== id);
      const updatedTickets = { ...ticketNumbers };
      delete updatedTickets[id];

      setParticipatingIds(updatedIds);
      setTicketNumbers(updatedTickets);

      localStorage.setItem('techforum_giveaways', JSON.stringify(updatedIds));
      localStorage.setItem('techforum_giveaway_tickets', JSON.stringify(updatedTickets));

      setToastMessage({ id, type: 'leave' });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500);
    } else {
      const salt = Date.now().toString(36);
      const ticket = generateTicketNumber(id, salt);

      const updatedIds = [...participatingIds, id];
      const updatedTickets = { ...ticketNumbers, [id]: ticket };

      setParticipatingIds(updatedIds);
      setTicketNumbers(updatedTickets);

      localStorage.setItem('techforum_giveaways', JSON.stringify(updatedIds));
      localStorage.setItem('techforum_giveaway_tickets', JSON.stringify(updatedTickets));

      setToastMessage({ id, type: 'join' });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
    }
  }, [participatingIds, ticketNumbers]);

  return (
    <div className="flex-1 px-5 space-y-7 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="space-y-5">
        <div className="flex items-center gap-3">
          <BackButton to="/" />
          <h1
            className="font-display text-[28px] leading-none font-bold"
            style={{
              background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >Розыгрыши</h1>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.04] p-5">
          <div className="absolute top-0 right-0 p-4 opacity-[0.06]">
            <Trophy className="w-20 h-20 text-primary" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,51,153,0.08),transparent_60%)]" />
          <div className="relative z-10 space-y-2">
            <h2 className="text-[15px] font-bold text-foreground/90 leading-tight">Испытай удачу!</h2>
            <p className="text-[11px] text-foreground/45 leading-relaxed max-w-[85%]">
              Участвуй в розыгрышах гаджетов от наших партнёров. Выполни условие и нажми «Участвовать». Победители будут объявлены на главной сцене.
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-[11px] text-foreground/40">
            <Gift className="w-3.5 h-3.5 text-primary/60" />
            <span><span className="text-foreground/70 font-bold">{GIVEAWAYS.length}</span> призов</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-foreground/40">
            <Ticket className="w-3.5 h-3.5 text-green-400/60" />
            <span>Вы участвуете в <span className="text-green-400 font-bold">{participatingIds.length}</span></span>
          </div>
        </div>
      </header>

      {/* Giveaway cards */}
      <div className="space-y-5">
        {GIVEAWAYS.map((giveaway, idx) => {
          const isParticipating = participatingIds.includes(giveaway.id);
          const ticket = ticketNumbers[giveaway.id];

          return (
            <motion.div
              key={giveaway.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.07, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                'rounded-2xl overflow-hidden transition-all duration-300 border',
                isParticipating
                  ? 'border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.08)]'
                  : 'border-foreground/[0.06] shadow-[0_2px_20px_rgba(0,0,0,0.3)]',
              )}
              style={{
                background: isParticipating
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(0,0,0,0.4) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.4) 100%)',
              }}
            >
              {/* Hero image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={giveaway.image}
                  alt={giveaway.item}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Overlay gradient */}
                <div className={cn('absolute inset-0 bg-gradient-to-t', giveaway.gradient)} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  {giveaway.featured && (
                    <span className="bg-[#ff3399] text-white text-[8px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.15em] flex items-center gap-1 shadow-lg shadow-[#ff3399]/30">
                      <Sparkles className="w-2.5 h-2.5" />
                      ГЛАВНЫЙ ПРИЗ
                    </span>
                  )}
                  <span className="bg-black/60 backdrop-blur-md text-white/80 text-[8px] font-bold px-2.5 py-1 rounded-full border border-foreground/10 uppercase tracking-[0.1em] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" style={{ color: giveaway.accentColor }} />
                    {giveaway.endTime}
                  </span>
                </div>

                {/* Participating badge on image */}
                {isParticipating && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-3 right-3"
                  >
                    <span className="bg-green-500/90 backdrop-blur-md text-white text-[8px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.1em] flex items-center gap-1 shadow-lg shadow-green-500/30">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      УЧАСТВУЮ
                    </span>
                  </motion.div>
                )}

                {/* Item name overlay on image */}
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="text-[18px] font-bold text-white leading-tight drop-shadow-lg">
                    {giveaway.item}
                  </h3>
                  <p className="text-[11px] text-white/50 font-medium mt-0.5">{giveaway.title}</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                <p className="text-[12px] leading-relaxed text-foreground/50">
                  {giveaway.description}
                </p>

                {/* Condition */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06]">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${giveaway.accentColor}15`, border: `1px solid ${giveaway.accentColor}25` }}
                  >
                    <AlertCircle className="w-4 h-4" style={{ color: giveaway.accentColor }} />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/30">Условие участия</span>
                    <p className="text-[12px] text-foreground/70 leading-snug font-medium">
                      {giveaway.condition}
                    </p>
                  </div>
                </div>

                {/* Ticket number when participating */}
                <AnimatePresence>
                  {isParticipating && ticket && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-500/[0.06] border border-green-500/15">
                        <div className="w-8 h-8 rounded-lg bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0">
                          <Ticket className="w-4 h-4 text-green-400" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-green-400/60">Ваш билет</span>
                          <p className="text-[16px] font-mono font-bold text-green-400 tracking-wider">
                            #{ticket}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer: participants + button */}
                <div className="flex items-center justify-between pt-1">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/30">Участников</span>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3 h-3" style={{ color: giveaway.accentColor }} />
                      <span className="text-[14px] font-mono font-bold text-foreground/90">
                        {(giveaway.participants + (isParticipating ? 1 : 0)).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleParticipation(giveaway.id)}
                    className={cn(
                      'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] transition-all duration-200 active:scale-[0.96] flex items-center gap-2',
                      isParticipating
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15'
                        : 'text-white shadow-lg',
                    )}
                    style={
                      !isParticipating
                        ? {
                            background: `linear-gradient(135deg, ${giveaway.accentColor}, ${giveaway.accentColor}cc)`,
                            boxShadow: `0 4px 20px ${giveaway.accentColor}30`,
                          }
                        : undefined
                    }
                  >
                    {isParticipating ? (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        Отказаться
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Участвовать
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'fixed bottom-24 left-5 right-5 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-4 border',
              toastMessage.type === 'join'
                ? 'bg-green-500 border-green-400/30 text-white'
                : 'bg-zinc-800 border-zinc-700/50 text-foreground',
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              toastMessage.type === 'join' ? 'bg-foreground/20' : 'bg-foreground/10',
            )}>
              {toastMessage.type === 'join' ? (
                <Trophy className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5 text-foreground/60" />
              )}
            </div>
            <div>
              {toastMessage.type === 'join' ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em]">Вы в деле!</p>
                  <p className="text-[12px] font-medium opacity-90">
                    Ваш билет #{ticketNumbers[toastMessage.id] ?? '---'} зарегистрирован.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/80">Участие отменено</p>
                  <p className="text-[12px] font-medium text-foreground/50">
                    Вы можете вернуться в любой момент.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
