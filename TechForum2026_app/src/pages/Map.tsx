// FILE: src/pages/Map.tsx
// VERSION: 2.0.0 — реальная схема залов вместо SVG-сетки + ссылки на OSM.
//
// Round 4 (АРХИТЕКТУРА): «Карта» теперь интерактивный floor-plan форума.
// Раньше был только blueprint-сетки с одной точкой и ссылка наружу — найти
// зал физически было нельзя. Эталон Eventicious даёт схему с кликабельными
// зонами и подсказками — здесь то же самое.
//
// Layout (упрощённое представление 1-го этажа):
//   ┌──────────────────────────────────────┐
//   │  [Зал Альфа]    [Зал Бета]    [Гамма]│  ← keynote / talk / workshop
//   │                                       │
//   │  ┌──Кофе-брейк─┐  ┌─Лаунж зона─┐     │
//   │  │             │  │             │     │
//   │  └─────────────┘  └─────────────┘     │
//   │                                       │
//   │   [Регистрация]   [Поддержка]         │
//   │       ↑ вход                          │
//   └──────────────────────────────────────┘
//
// Источник истины — HALLS из programData (раунд 3 перевёл их в БД).
// Тап по зоне → bottom-sheet «<Зал> · сейчас идёт: <session>» (или next).
// Если sessions ещё грузятся — bottom-sheet показывает только название зоны.

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Coffee, Wifi, X, Clock, Users, Sparkles, Headphones } from 'lucide-react';
import PageShell from '@/src/components/ui/PageShell';
import { useHalls, useSessions } from '@/src/lib/programData';

// SVG zones — координаты в viewBox 320x420 (4:5).
// Каждая zone: id (для матчинга с HALL.id), label, координаты прямоугольника,
// иконка, тип (для UI-различения).
type Zone = {
  id: string;
  /** id Hall'а в БД (для матчинга с sessions). null для не-зальных зон. */
  hallId: string | null;
  label: string;
  type: 'hall' | 'lounge' | 'food' | 'service' | 'entrance';
  /** Прямоугольник в SVG-координатах. */
  x: number;
  y: number;
  w: number;
  h: number;
};

// Раскладка приближенная к реальной — 3 зала рядом сверху, лаунж + кофе
// центром, регистрация снизу. Если HALLS из БД содержит другие id —
// рендерим эти из БД, остальное (лаунж, кофе) статика.
const STATIC_ZONES: Zone[] = [
  { id: 'lounge',   hallId: null, label: 'Лаунж зона',   type: 'lounge',  x: 20,  y: 200, w: 130, h: 80 },
  { id: 'coffee',   hallId: null, label: 'Кофе-брейк',   type: 'food',    x: 170, y: 200, w: 130, h: 80 },
  { id: 'wifi',     hallId: null, label: 'Wi-Fi: TF-Guests', type: 'service', x: 20,  y: 295, w: 130, h: 45 },
  { id: 'support',  hallId: null, label: 'Поддержка',    type: 'service', x: 170, y: 295, w: 130, h: 45 },
  { id: 'entrance', hallId: null, label: 'Регистрация · вход', type: 'entrance', x: 60, y: 355, w: 200, h: 45 },
];

const TYPE_STYLES: Record<Zone['type'], { fill: string; stroke: string; iconColor: string }> = {
  hall:     { fill: 'rgba(78, 201, 192, 0.15)', stroke: 'rgba(78, 201, 192, 0.65)', iconColor: '#4ec9c0' },
  lounge:   { fill: 'rgba(167, 139, 250, 0.15)', stroke: 'rgba(167, 139, 250, 0.55)', iconColor: '#a78bfa' },
  food:     { fill: 'rgba(251, 191, 36, 0.15)', stroke: 'rgba(251, 191, 36, 0.55)',  iconColor: '#fbbf24' },
  service:  { fill: 'rgba(125, 211, 252, 0.10)', stroke: 'rgba(125, 211, 252, 0.45)',iconColor: '#7dd3fc' },
  entrance: { fill: 'rgba(94, 234, 212, 0.20)', stroke: 'rgba(94, 234, 212, 0.70)',  iconColor: '#5eead4' },
};

const ICON_BY_TYPE: Record<Zone['type'], typeof Coffee> = {
  hall: Sparkles,
  lounge: Users,
  food: Coffee,
  service: Wifi,
  entrance: MapPin,
};

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  return h * 60 + m;
}

export default function Map() {
  const { data: halls, loading: hallsLoading } = useHalls();
  const { data: sessions } = useSessions();
  const [selected, setSelected] = useState<Zone | null>(null);

  // Залы из БД → SVG-зоны. 3 зала горизонтальный ряд сверху.
  // Если в БД залов >3, рендерим первые 3 (карта не масштабируется
  // динамически — реальный venue ограничен).
  const hallZones: Zone[] = useMemo(() => {
    const slots = [
      { x: 20,  y: 60, w: 90, h: 110 },
      { x: 115, y: 60, w: 90, h: 110 },
      { x: 210, y: 60, w: 90, h: 110 },
    ];
    return halls.slice(0, 3).map((h, i) => ({
      id: h.id,
      hallId: h.id,
      label: h.name,
      type: 'hall' as const,
      ...slots[i]!,
    }));
  }, [halls]);

  const allZones: Zone[] = [...hallZones, ...STATIC_ZONES];

  // Для зала — найти текущую/ближайшую сессию (для bottom-sheet info).
  const sessionInfo = useMemo(() => {
    if (!selected || !selected.hallId) return null;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const inHall = sessions.filter((s) => s.hallId === selected.hallId);
    const live = inHall.find((s) => {
      const start = timeToMinutes(s.startTime);
      const end = timeToMinutes(s.endTime);
      return start <= nowMin && nowMin < end;
    });
    if (live) return { kind: 'live' as const, session: live };
    const upcoming = inHall
      .filter((s) => timeToMinutes(s.startTime) > nowMin)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0];
    if (upcoming) return { kind: 'next' as const, session: upcoming };
    const last = inHall.sort((a, b) => timeToMinutes(b.endTime) - timeToMinutes(a.endTime))[0];
    if (last) return { kind: 'past' as const, session: last };
    return null;
  }, [selected, sessions]);

  return (
    <PageShell kicker="Площадка" title="Схема">
      <div className="rounded-3xl border border-[#4ec9c0]/30 bg-[#0a2f38]/45 p-3 overflow-hidden">
        {/* SVG floor-plan — viewBox 320x420 фиксированный, реагирует на любую
            ширину контейнера через preserveAspectRatio. */}
        <svg
          viewBox="0 0 320 420"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto block"
          role="img"
          aria-label="Схема площадки форума"
        >
          {/* Фоновая сетка для blueprint-стиля */}
          <defs>
            <pattern id="floorgrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4ec9c0" strokeOpacity="0.10" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="320" height="420" fill="#03161c" />
          <rect x="0" y="0" width="320" height="420" fill="url(#floorgrid)" />
          {/* Внешняя стена */}
          <rect x="6" y="6" width="308" height="408" fill="none" stroke="rgba(78, 201, 192, 0.45)" strokeWidth="1.5" rx="14" />

          {/* Header label "1 этаж" */}
          <text x="14" y="28" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#7aa8a4" letterSpacing="2">
            1 ЭТАЖ
          </text>
          <text x="14" y="44" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#7aa8a4" letterSpacing="2">
            ЗАЛЫ
          </text>

          {hallsLoading && hallZones.length === 0 && [0, 1, 2].map((i) => (
            <rect
              key={`hall-skel-${i}`}
              x={20 + i * 95}
              y={60}
              width={90}
              height={110}
              fill="rgba(78, 201, 192, 0.07)"
              stroke="rgba(78, 201, 192, 0.20)"
              strokeWidth="1"
              strokeDasharray="4 3"
              rx="8"
            />
          ))}

          {allZones.map((z) => {
            const style = TYPE_STYLES[z.type];
            const Icon = ICON_BY_TYPE[z.type];
            const cx = z.x + z.w / 2;
            const cy = z.y + z.h / 2;
            const isSelected = selected?.id === z.id;
            return (
              <g
                key={z.id}
                onClick={() => setSelected(z)}
                style={{ cursor: 'pointer' }}
                aria-label={z.label}
              >
                <motion.rect
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.h}
                  rx={8}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={isSelected ? 2.4 : 1.4}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                  whileTap={{ scale: 0.97 }}
                />
                {/* Icon в центре */}
                <foreignObject x={cx - 10} y={cy - 22} width={20} height={20}>
                  <div className="w-5 h-5 flex items-center justify-center" style={{ color: style.iconColor }}>
                    <Icon className="w-4.5 h-4.5" strokeWidth={1.6} />
                  </div>
                </foreignObject>
                {/* Label */}
                <text
                  x={cx}
                  y={cy + 12}
                  textAnchor="middle"
                  fontFamily="Manrope, sans-serif"
                  fontSize="10"
                  fontWeight="600"
                  fill="#d8f0ee"
                >
                  {z.label.length > 14 ? `${z.label.slice(0, 12)}…` : z.label}
                </text>
              </g>
            );
          })}

          {/* "Стрелка вход" внизу */}
          <text
            x="160"
            y="412"
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="8"
            fill="rgba(94, 234, 212, 0.75)"
            letterSpacing="2"
          >
            ↑ ВХОД
          </text>
        </svg>
      </div>

      <p className="mt-4 text-[12px] text-[#7aa8a4] leading-relaxed text-center px-4">
        Тапните по любой зоне — узнаете, что там сейчас происходит.
      </p>

      {/* Bottom-sheet с инфо по выбранной зоне */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="map-bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[80] bg-[#03161c]/70 backdrop-blur-sm flex items-end"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="w-full max-w-[480px] mx-auto rounded-t-3xl border-t border-x border-[#4ec9c0]/35 bg-[#03161c]/97 backdrop-blur-xl shadow-[0_-18px_60px_rgba(0,0,0,0.55)] p-5"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: TYPE_STYLES[selected.type].fill,
                      border: `1px solid ${TYPE_STYLES[selected.type].stroke}`,
                      color: TYPE_STYLES[selected.type].iconColor,
                    }}
                  >
                    {(() => {
                      const Icon = ICON_BY_TYPE[selected.type];
                      return <Icon className="w-5 h-5" strokeWidth={1.6} />;
                    })()}
                  </div>
                  <div>
                    <p className="font-display-cyrl text-[18px] font-semibold text-[#d8f0ee] leading-tight">
                      {selected.label}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#7aa8a4] mt-0.5">
                      {selected.type === 'hall' ? 'Зал' :
                       selected.type === 'lounge' ? 'Зона нетворкинга' :
                       selected.type === 'food' ? 'Питание' :
                       selected.type === 'service' ? 'Сервис' :
                       'Вход'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Закрыть"
                  className="h-9 w-9 rounded-xl border border-[#4ec9c0]/30 flex items-center justify-center text-[#7aa8a4] active:scale-90 transition-transform"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>

              {/* Контент — для залов из БД, для статики — фиксированный */}
              {selected.type === 'hall' && sessionInfo && (
                <div className="rounded-2xl border border-[#4ec9c0]/22 bg-[#0a2f38]/45 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      sessionInfo.kind === 'live' ? 'bg-rose-500 animate-pulse' :
                      sessionInfo.kind === 'next' ? 'bg-[#4ec9c0]' :
                      'bg-[#7aa8a4]'
                    }`} />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#4ec9c0]">
                      {sessionInfo.kind === 'live' ? 'Сейчас идёт' :
                       sessionInfo.kind === 'next' ? 'Дальше' :
                       'Последняя сессия'}
                    </span>
                  </div>
                  <p className="font-display-cyrl text-[15px] font-semibold text-[#d8f0ee] leading-snug">
                    {sessionInfo.session.title}
                  </p>
                  <div className="flex items-center gap-3 text-[12px] text-[#7aa8a4]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" strokeWidth={1.6} />
                      {sessionInfo.session.startTime}–{sessionInfo.session.endTime}
                    </span>
                    {sessionInfo.session.speakerName && sessionInfo.session.speakerName !== '—' && (
                      <span className="truncate">{sessionInfo.session.speakerName}</span>
                    )}
                  </div>
                </div>
              )}
              {selected.type === 'hall' && !sessionInfo && (
                <p className="text-[13px] text-[#7aa8a4] leading-relaxed">
                  В этом зале пока нет назначенных сессий.
                </p>
              )}
              {selected.type === 'lounge' && (
                <div className="space-y-2">
                  <p className="text-[13px] text-[#d8f0ee]/85 leading-relaxed">
                    Открытая зона для встреч с другими участниками. Удобные кресла,
                    столы для ноутбуков, розетки.
                  </p>
                  <p className="text-[12px] text-[#7aa8a4]">
                    Свободна весь день · доступна без записи.
                  </p>
                </div>
              )}
              {selected.type === 'food' && (
                <div className="space-y-2">
                  <p className="text-[13px] text-[#d8f0ee]/85 leading-relaxed">
                    Кофе, чай, выпечка, бутерброды. Перерывы между сессиями: 11:30, 14:00, 16:30.
                  </p>
                  <p className="text-[12px] text-[#7aa8a4]">
                    Бесплатно для всех участников · бейдж обязателен.
                  </p>
                </div>
              )}
              {selected.type === 'service' && selected.id === 'wifi' && (
                <div className="space-y-2">
                  <div className="rounded-xl bg-[#0a2f38]/60 border border-[#4ec9c0]/22 p-3 font-mono text-[12px] text-[#d8f0ee]">
                    <p>SSID: <span className="text-[#4ec9c0]">TF-Guests</span></p>
                    <p>Пароль: <span className="text-[#4ec9c0]">techforum2026</span></p>
                  </div>
                  <p className="text-[12px] text-[#7aa8a4] leading-relaxed">
                    Открытая сеть. Для рабочих презентаций используйте eth-розетки в залах.
                  </p>
                </div>
              )}
              {selected.type === 'service' && selected.id === 'support' && (
                <div className="space-y-2">
                  <p className="text-[13px] text-[#d8f0ee]/85 leading-relaxed flex items-start gap-2">
                    <Headphones className="w-4 h-4 text-[#4ec9c0] mt-0.5 shrink-0" strokeWidth={1.6} />
                    Стойка организаторов. Утерянные вещи, замена бейджа,
                    вопросы по программе и партнёрам.
                  </p>
                  <p className="text-[12px] text-[#7aa8a4]">support@techforum.ru</p>
                </div>
              )}
              {selected.type === 'entrance' && (
                <div className="space-y-2">
                  <p className="text-[13px] text-[#d8f0ee]/85 leading-relaxed">
                    Главный вход. Регистрация работает с 08:30. Получите бейдж
                    и стартовый пакет до 10:00, чтобы успеть на церемонию открытия.
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
