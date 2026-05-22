// FILE: src/pages/Home.tsx
// VERSION: 2.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Главная страница — заголовок бренда, кликабельная плашка с датами/
//          локацией (ведёт на About), 12 ярлыков разделов в сетке 3×4.
// SCOPE: UI only. Без API.
// INPUT: react-router-dom Link.
// OUTPUT: JSX страница.
// KEYWORDS: DOMAIN(7): NavigationHub; CONCEPT(7): GridMenu; TECH(6): React, Tailwind
// LINKS: NAVIGATES_TO(8): все 12 разделов
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему clamp() и vw для шрифта заголовка, а не Tailwind text-[Npx]?
// A: На Samsung S25 / OnePlus 9R / iPhone 16 — разная ширина (393–430dp).
//    text-[62px] обрезался справа. clamp(36px, 12vw, 60px) даёт плавную
//    адаптацию без media-query или Tailwind breakpoints (xs не определён).
// Q: Почему все labels в одну строку, а "Схема\nмероприятия" исчезла?
// A: Заказчик хотел все labels на одной линии. Длинные сократил: «Схема»
//    (вместо «Схема мероприятия»), «О форуме» (вместо «О TechForum»).
//    Семантически достаточно: у иконок Map / Info контекст ясен.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v2.0.0 - Responsive шрифт через clamp(); все labels в 1 строку;
//                       плашка дата/локация → Link to /about; min-h-[100dvh]
//                       чтобы фон растягивался на весь viewport (исправляет
//                       чёрную полосу внизу на Samsung/OnePlus).]
// PREV_CHANGE_SUMMARY: [v1.0.0 - text-[62px] hardcoded, "Схема\nмероприятия"
//                                ломал grid-row, нет min-h, фон обрезался.]
// END_CHANGE_SUMMARY

import {
  User,
  Newspaper,
  MessageCircle,
  Calendar,
  Map,
  Handshake,
  ShieldCheck,
  MonitorCog,
  Mic,
  FileText,
  Info,
  Sparkles,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface MenuItem {
  label: string;
  icon: typeof User;
  to: string;
}

const menuItems: MenuItem[] = [
  { label: 'Профиль', icon: User, to: '/profile' },
  { label: 'Новости', icon: Newspaper, to: '/feed' },
  { label: 'Чат', icon: MessageCircle, to: '/chat' },
  { label: 'Программа', icon: Calendar, to: '/schedule' },
  { label: 'Схема', icon: Map, to: '/map' },
  { label: 'Партнёры', icon: Handshake, to: '/partners' },
  { label: 'Билет', icon: ShieldCheck, to: '/ticket' },
  { label: 'Диагностика', icon: MonitorCog, to: '/diagnostics' },
  { label: 'Спикеры', icon: Mic, to: '/speakers' },
  { label: 'Записи', icon: FileText, to: '/my-records' },
  { label: 'О форуме', icon: Info, to: '/about' },
  { label: 'Розыгрыши', icon: Sparkles, to: '/giveaways' },
];

export default function Home() {
  // BUG_FIX_CONTEXT: Home больше не рендерит свой фон — единый фон даёт
  // <AppBackground> в App.tsx (применяется ко всем разделам). Здесь только контент.
  // STICKY_HEADER: header вынесен в sticky top-0 — заголовок виден всегда при скролле,
  // полупрозрачный тёмный фон с backdrop-blur (как в ChatGPT). Скролл-контейнер —
  // `flex-1 overflow-y-auto` в App.tsx; sticky работает относительно него.
  // AppBackground имеет overflow-hidden, но это не scroll-ancestor для sticky,
  // т.к. он не overflow:auto/scroll → не ломает sticky.
  return (
    <div
      className="px-5 pb-10"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
        {/* STICKY_HEADER: остаётся видимым при scroll вниз. Полупрозрачный
            тёмный фон + backdrop-blur (как в ChatGPT). 5мм (≈20px) padding
            снизу/сверху. Заголовок "TechForum / 2026" в две строки — как
            на главном экране. */}
        <header
          className="sticky top-0 z-20 -mx-5 px-5 pb-5 text-center bg-[#0a0e17]/75 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_12px_32px_-14px_rgba(0,0,0,0.7)]"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)',
          }}
        >
          <h1
            className="font-elite font-bold tracking-[0.03em] text-accent drop-shadow-[0_10px_34px_rgba(0,255,255,0.35)]"
            style={{
              fontSize: 'clamp(36px, 12vw, 56px)',
              lineHeight: 0.95,
            }}
          >
            TechForum
            <span className="block mt-1">2026</span>
          </h1>

          {/* Кликабельная плашка с датой/локацией → ведёт в /about */}
          <Link
            to="/about"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.22em] text-white/75 backdrop-blur-sm hover:border-accent/40 hover:bg-white/[0.06] active:scale-[0.97] transition-all"
            aria-label="О форуме: 20–21 мая 2026, Саратов"
          >
            <CalendarDays className="h-4 w-4 text-accent" />
            <span>20–21 мая</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <MapPin className="h-4 w-4 text-accent" />
            <span>Саратов</span>
          </Link>
        </header>

        <section>
          <div className="grid grid-cols-3 gap-x-3 gap-y-9 mt-10">
            {menuItems.map(({ label, icon: Icon, to }) => (
              <Link
                key={label}
                to={to}
                className="flex flex-col items-center text-center gap-3 rounded-2xl px-1 py-1 active:scale-95 transition-transform"
              >
                <div className="h-16 w-16 rounded-2xl border border-accent/15 bg-accent/[0.04] flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.42)]">
                  <Icon className="h-8 w-8 text-accent/80" />
                </div>
                <span
                  className="font-elite text-white/90 tracking-[0.01em] whitespace-nowrap"
                  style={{ fontSize: 'clamp(13px, 4vw, 17px)', lineHeight: 1.1 }}
                >
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>
    </div>
  );
}
