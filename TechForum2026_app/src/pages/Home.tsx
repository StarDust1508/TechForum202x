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
  return (
    <div
      className="px-5 pb-10"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
        <header className="pt-0 pb-4 text-center">
          <h1
            className="font-elite font-bold tracking-[0.03em] text-[#ccfbf1] drop-shadow-[0_10px_34px_rgba(13,148,136,0.55)]"
            style={{
              fontSize: 'clamp(36px, 12vw, 60px)',
              lineHeight: 0.95,
            }}
          >
            TechForum
            <span className="block mt-1">2026</span>
          </h1>

          {/* Кликабельная плашка с датой/локацией → ведёт в /about */}
          <Link
            to="/about"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur-sm hover:border-accent/40 hover:bg-white/[0.06] active:scale-[0.97] transition-all"
            aria-label="О форуме: 20–21 мая 2026, Саратов"
          >
            <CalendarDays className="h-3.5 w-3.5 text-accent" />
            <span>20–21 мая</span>
            <span className="h-1 w-1 rounded-full bg-white/30" />
            <MapPin className="h-3.5 w-3.5 text-accent" />
            <span>Саратов</span>
          </Link>
        </header>

        <section>
          <div className="grid grid-cols-3 gap-x-2 gap-y-6 mt-2">
            {menuItems.map(({ label, icon: Icon, to }) => (
              <Link
                key={label}
                to={to}
                className="flex flex-col items-center text-center gap-2.5 rounded-2xl px-1 py-1 active:scale-95 transition-transform"
              >
                <div className="h-11 w-11 rounded-2xl border border-white/12 bg-white/[0.02] flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.42)]">
                  <Icon className="h-6 w-6 text-white/88" />
                </div>
                <span
                  className="font-elite text-white/90 tracking-[0.01em] whitespace-nowrap"
                  style={{ fontSize: 'clamp(12px, 3.6vw, 15px)', lineHeight: 1.1 }}
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
