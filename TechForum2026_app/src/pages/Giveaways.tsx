import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Trophy, ChevronRight, CheckCircle2, Clock, Sparkles, X,
  Laptop, Headphones, Watch, Smartphone, Camera, Plane, BookOpen,
  Mic2, Coffee, Backpack, Award,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import PageShell from '@/src/components/ui/PageShell';

export interface Giveaway {
  id: string;
  /** Краткое название (1-3 слова, для бейджа в верху карточки). */
  category: string;
  /** Что разыгрывается (h3 в карточке). */
  item: string;
  Icon: LucideIcon;
  /** Цветовой акцент карточки — gradient «from → to» в Tailwind-формате. */
  gradient: string;
  /** Маркетинговое описание приза. */
  description: string;
  /** Условие участия — что нужно сделать. */
  condition: string;
  /** Когда подведут итоги. */
  endTime: string;
  /** Premium-флаг — для главного приза. */
  featured?: boolean;
  /** Стартовая «социальная» цифра (просто визуал — реальный счётчик локальный). */
  participants: number;
}

// Призы от партнёров форума. Сейчас захардкожены — если форум вырастет
// в постоянный продукт и потребует админку, переедем на серверный
// эндпоинт `/giveaways` с CRUD.
const GIVEAWAYS: Giveaway[] = [
  {
    id: 'g_main',
    category: 'Главный приз',
    item: 'Игровой ноутбук от партнёра',
    Icon: Laptop,
    gradient: 'from-[#4ec9c0]/40 to-[#4ec9c0]/10',
    description: 'Топовый ноутбук с дискретной видеокартой — для разработки, рендера и игр на максимуме.',
    condition: 'Зарегистрироваться на форум до 20 мая 18:00, посетить минимум 3 сессии (отметка через QR-сканер у входа в зал).',
    endTime: '21 мая, 18:00',
    participants: 0,
    featured: true,
  },
  {
    id: 'g_phone',
    category: 'Smartphone',
    item: 'Флагманский смартфон',
    Icon: Smartphone,
    gradient: 'from-purple-500/35 to-fuchsia-500/15',
    description: 'Современный флагман с Pro-камерой и AI-ассистентом на устройстве.',
    condition: 'Опубликовать пост о форуме в любой соцсети с хэштегом #TechForum2026 и отметить @techforum.',
    endTime: '21 мая, 17:00',
    participants: 0,
  },
  {
    id: 'g_headphones',
    category: 'Audio',
    item: 'Беспроводные наушники',
    Icon: Headphones,
    gradient: 'from-indigo-500/35 to-blue-500/15',
    description: 'Премиальные over-ear наушники с активным шумоподавлением и Hi-Res звуком.',
    condition: 'Задать самый интересный вопрос любому из спикеров — лучший выбирает сам спикер на сцене.',
    endTime: '21 мая, 16:00',
    participants: 0,
  },
  {
    id: 'g_watch',
    category: 'Wearables',
    item: 'Smart-часы Sport Edition',
    Icon: Watch,
    gradient: 'from-emerald-500/35 to-teal-500/15',
    description: 'Часы с продвинутым health-tracking, GPS и автономностью до 7 дней.',
    condition: 'Пройти 6000+ шагов в течение дня форума (трек через любой fitness-app, скриншот на стенде).',
    endTime: '21 мая, 15:30',
    participants: 0,
  },
  {
    id: 'g_camera',
    category: 'Photo',
    item: 'Беззеркальная камера',
    Icon: Camera,
    gradient: 'from-rose-500/35 to-pink-500/15',
    description: 'Mirrorless-камера с матрицей APS-C и универсальным kit-объективом.',
    condition: 'Снять лучшее фото форума, опубликовать с хэштегом #TFCapture2026. Жюри отбирает 3-х финалистов.',
    endTime: '21 мая, 14:00',
    participants: 0,
  },
  {
    id: 'g_trip',
    category: 'Experience',
    item: 'Поездка на международную конференцию',
    Icon: Plane,
    gradient: 'from-sky-500/35 to-cyan-500/15',
    description: 'Билеты + проживание на одну из крупных IT-конференций (KubeCon / WebSummit / DevDays на выбор).',
    condition: 'Победитель хакатона форума (трек 20 мая, 14:00–18:00). Открытая регистрация для всех участников.',
    endTime: '20 мая, 19:00',
    participants: 0,
  },
  {
    id: 'g_courses',
    category: 'Education',
    item: 'Годовая подписка на онлайн-курсы',
    Icon: BookOpen,
    gradient: 'from-amber-500/35 to-orange-500/15',
    description: 'Полный доступ ко всем материалам образовательной платформы партнёра на 12 месяцев.',
    condition: 'Заполнить feedback-форму после форума (присылается на email 22 мая) с развёрнутыми ответами.',
    endTime: '22 мая, 23:59',
    participants: 0,
  },
  {
    id: 'g_podcast',
    category: 'Media',
    item: 'Гость в IT-подкасте',
    Icon: Mic2,
    gradient: 'from-violet-500/35 to-purple-500/15',
    description: 'Запись эпизода на одном из ведущих IT-подкастов в качестве гостя — расскажите о своём опыте.',
    condition: 'Лучший питч на сцене Open Mic (21 мая, 12:00) — у каждого участника 90 секунд.',
    endTime: '21 мая, 13:00',
    participants: 0,
  },
  {
    id: 'g_merch',
    category: 'Merch',
    item: 'Премиум-набор мерча',
    Icon: Backpack,
    gradient: 'from-lime-500/35 to-green-500/15',
    description: 'Рюкзак Premium + лимитированная футболка форума + термокружка + наклейки.',
    condition: 'Посетить стенды всех 4 генеральных партнёров и собрать QR-печати в приложении (раздел «Партнёры»).',
    endTime: '21 мая, 17:30',
    participants: 0,
  },
  {
    id: 'g_coffee',
    category: 'Networking',
    item: 'Кофе со спикером',
    Icon: Coffee,
    gradient: 'from-yellow-600/35 to-amber-700/15',
    description: 'Часовая встреча тет-а-тет с любым спикером форума по выбору победителя.',
    condition: 'Случайный выбор среди тех, кто отметил минимум 5 сессий в личном расписании в разделе «Программа».',
    endTime: '21 мая, 18:30',
    participants: 0,
  },
];

const LS_KEY = 'techforum_giveaways';

// Экспорт для MyRecords — там используется тот же ключ.
export { GIVEAWAYS, LS_KEY };
export function readJoinedGiveaways(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch { return []; }
}

export default function Giveaways() {
  const [participatingIds, setParticipatingIds] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);

  useEffect(() => {
    setParticipatingIds(readJoinedGiveaways());
  }, []);

  const persist = (ids: string[]) => {
    setParticipatingIds(ids);
    try { localStorage.setItem(LS_KEY, JSON.stringify(ids)); } catch { /* noop */ }
  };

  const join = (id: string) => {
    if (participatingIds.includes(id)) return;
    persist([...participatingIds, id]);
    // Раньше тут генерили fake "Билет №<rng>" через Math.random() и
    // показывали юзеру — это было обманом: сервер ничего не знал. Теперь
    // честный flow: «заявка отмечена», условия будут проверены при выдаче
    // приза на сцене (см. server-side admin-pipeline в плане Round 3).
    setShowSuccess(id);
    window.setTimeout(() => setShowSuccess(null), 3200);
  };

  const leave = (id: string) => {
    persist(participatingIds.filter((x) => x !== id));
    setConfirmLeave(null);
  };

  return (
    <PageShell kicker="Зона призов" title="Розыгрыши">
      {/* Презентабельный banner — статистика, призовой фонд, призыв */}
      <section className="relative overflow-hidden rounded-3xl border border-[#4ec9c0]/40 bg-gradient-to-br from-[#0a2f38]/80 via-[#0a2f38]/55 to-[#03161c]/40 p-6 mb-6">
        <Trophy className="absolute -right-6 -top-6 w-32 h-32 text-[#4ec9c0]/8" strokeWidth={1.1} />
        <Sparkles className="absolute right-12 top-3 w-5 h-5 text-[#4ec9c0]/70" />
        <Sparkles className="absolute right-4 top-14 w-4 h-4 text-[#4ec9c0]/40" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#4ec9c0]/45 bg-[#03161c]/70 px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9c0] animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4ec9c0]">{GIVEAWAYS.length} активных розыгрышей</span>
          </div>
          <h2 className="font-display-cyrl text-[24px] font-semibold text-[#d8f0ee] leading-tight max-w-[80%]">
            Призовой фонд — больше миллиона рублей
          </h2>
          <p className="text-[13px] text-[#d8f0ee]/75 leading-relaxed max-w-[88%]">
            От ноутбуков и флагманских смартфонов до годовой подписки на курсы и поездки на международные IT-конференции.
            Чтобы участвовать, выполни условие розыгрыша. Победителей объявят на главной сцене 21 мая в 19:00.
          </p>
          <div className="flex gap-3 pt-1">
            <div className="flex-1 rounded-2xl border border-[#4ec9c0]/22 bg-[#03161c]/55 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#7aa8a4]">Вы участвуете</p>
              <p className="font-display-cyrl text-[20px] font-semibold text-[#4ec9c0] mt-0.5">{participatingIds.length}</p>
            </div>
            <div className="flex-1 rounded-2xl border border-[#4ec9c0]/22 bg-[#03161c]/55 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#7aa8a4]">Доступно</p>
              <p className="font-display-cyrl text-[20px] font-semibold text-[#d8f0ee] mt-0.5">{GIVEAWAYS.length - participatingIds.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {GIVEAWAYS.map((g) => {
          const joined = participatingIds.includes(g.id);
          return (
            <article
              key={g.id}
              className={cn(
                'rounded-3xl border bg-[#0a2f38]/40 overflow-hidden transition-all',
                joined ? 'border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.18)]' : 'border-[#4ec9c0]/22',
              )}
            >
              {/* Hero: gradient + центральная иконка + бейджи */}
              <div className={cn('relative h-44 overflow-hidden flex items-center justify-center bg-gradient-to-br', g.gradient)}>
                {/* Layered рисунок: SVG-сетка + большая полупрозрачная иконка */}
                <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id={`grid-${g.id}`} width="32" height="32" patternUnits="userSpaceOnUse">
                      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#4ec9c0" strokeWidth="0.4" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#grid-${g.id})`} />
                </svg>
                <g.Icon className="absolute -right-4 -bottom-6 w-44 h-44 text-white/8" strokeWidth={0.8} />
                <g.Icon className="relative z-10 w-24 h-24 text-[#d8f0ee] drop-shadow-[0_0_24px_rgba(255,255,255,0.4)]" strokeWidth={1.1} />

                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {g.featured && (
                    <span className="inline-flex items-center gap-1 bg-[#4ec9c0] text-[#03161c] font-mono text-[9px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" strokeWidth={2} />
                      Главный приз
                    </span>
                  )}
                  <span className="bg-[#03161c]/85 backdrop-blur-md text-[#d8f0ee] font-mono text-[9px] font-semibold px-2.5 py-1 rounded-full border border-[#4ec9c0]/40 uppercase tracking-widest">
                    {g.category}
                  </span>
                </div>

                <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-[#03161c]/85 backdrop-blur-md text-[#d8f0ee] font-mono text-[9px] font-semibold px-2.5 py-1 rounded-full border border-[#4ec9c0]/40 uppercase tracking-widest">
                  <Clock className="w-3 h-3 text-[#4ec9c0]" strokeWidth={1.6} />
                  {g.endTime}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <h3 className="font-display-cyrl text-[19px] font-semibold text-[#d8f0ee] leading-tight">{g.item}</h3>
                <p className="text-[13px] leading-relaxed text-[#d8f0ee]/80">{g.description}</p>

                {/* Условие участия — как требование/правило */}
                <div className="rounded-2xl border border-[#4ec9c0]/22 bg-[#03161c]/40 p-3 flex items-start gap-2.5">
                  <Award className="w-4 h-4 text-[#4ec9c0] mt-0.5 shrink-0" strokeWidth={1.8} />
                  <div className="space-y-1 min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#4ec9c0]/85">Условие участия</p>
                    <p className="text-[12px] leading-relaxed text-[#d8f0ee]/75">{g.condition}</p>
                  </div>
                </div>

                {/* CTA: join → outline-teal; joined → emerald with leave-option */}
                <div className="flex items-center gap-2 pt-1">
                  {joined ? (
                    <>
                      <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] border border-emerald-500/45 bg-emerald-500/10 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-300 font-display-cyrl">
                        <CheckCircle2 className="w-4 h-4" strokeWidth={1.8} />
                        Вы участвуете
                      </div>
                      <button
                        onClick={() => setConfirmLeave(g.id)}
                        className="px-4 py-3 rounded-[12px] border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 active:scale-95 transition-all"
                        aria-label="Отказаться от участия"
                      >
                        <X className="w-4 h-4" strokeWidth={1.8} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => join(g.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] border border-[#4ec9c0]/55 bg-[#0a2f38]/70 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d8f0ee] hover:border-[#4ec9c0]/85 hover:bg-[#0e3a44]/85 active:scale-[0.98] transition-all font-display-cyrl"
                    >
                      Участвовать
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Toast successful join */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-6 right-6 z-40 max-w-[420px] mx-auto rounded-3xl border border-[#4ec9c0]/55 bg-[#03161c]/95 backdrop-blur-xl shadow-[0_24px_60px_rgba(78,201,192,0.25)] p-4 flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#4ec9c0] flex items-center justify-center text-[#03161c]">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#4ec9c0]">Заявка принята</p>
              <p className="text-[13px] font-semibold text-[#d8f0ee] mt-0.5">
                Условия проверим у входа в зал по QR-билету
              </p>
            </div>
            <Gift className="w-5 h-5 text-[#4ec9c0]/65" strokeWidth={1.4} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm leave modal */}
      <AnimatePresence>
        {confirmLeave && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-[#03161c]/85 backdrop-blur-md"
            onClick={() => setConfirmLeave(null)}
          >
            <motion.div
              initial={{ y: 24, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 24, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[380px] rounded-3xl border border-[#4ec9c0]/30 bg-[#052830]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
            >
              <h3 className="font-display-cyrl text-[20px] text-[#d8f0ee] mb-2">Отказаться от участия?</h3>
              <p className="text-[13px] text-[#7aa8a4] mb-5 leading-relaxed">
                Вы выйдете из этого розыгрыша. Можно вернуться в любой момент до окончания приёма заявок.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmLeave(null)}
                  className="flex-1 rounded-[12px] border border-[#4ec9c0]/30 bg-[#0a2f38]/40 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d8f0ee] hover:border-[#4ec9c0]/55 transition-all"
                >
                  Остаться
                </button>
                <button
                  onClick={() => leave(confirmLeave)}
                  className="flex-1 rounded-[12px] border border-rose-500/55 bg-rose-500/15 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-rose-300 hover:bg-rose-500/25 transition-all"
                >
                  Отказаться
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
