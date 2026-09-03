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
  Handshake,
  ShieldCheck,
  Mic,
  Info,
  Sparkles,
  CalendarDays,
  MapPin,
  Settings,
  Users,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

interface MenuItem {
  label: string;
  icon: typeof User;
  to?: string;
  href?: string;
}

const menuItems: MenuItem[] = [
  { label: 'Профиль', icon: User, to: '/profile' },
  { label: 'Программа', icon: Calendar, to: '/schedule' },
  { label: 'Чат', icon: MessageCircle, to: '/chat' },
  { label: 'Билет', icon: ShieldCheck, to: '/ticket' },
  { label: 'Спикеры', icon: Mic, to: '/speakers' },
  { label: 'Новости', icon: Newspaper, to: '/feed' },
  { label: 'Настройки', icon: Settings, to: '/settings' },
  { label: 'Участники', icon: Users, to: '/attendees' },
  { label: 'Розыгрыши', icon: Sparkles, to: '/giveaways' },
  { label: 'О форуме', icon: Info, to: '/about' },
  { label: 'Партнёры', icon: Handshake, to: '/partners' },
  { label: 'TG Бот', icon: Send, href: 'https://t.me/NeuroPravo_Bot' },
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
      className="px-5"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
        {/* STICKY_HEADER: остаётся видимым при scroll вниз. Полупрозрачный
            тёмный фон + backdrop-blur (как в ChatGPT). 5мм (≈20px) padding
            снизу/сверху. Заголовок "TechForum / 2026" в две строки — как
            на главном экране. */}
        <header
          className="sticky top-0 z-20 -mx-5 px-5 pb-5 text-center bg-[#0f1118] border-b border-white/[0.06]"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
          }}
        >
          <h1
            className="font-display font-extrabold tracking-[0.03em]"
            style={{
              fontSize: 'clamp(38px, 12vw, 62px)',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 18px rgba(0,255,255,0.4)) drop-shadow(0 0 36px rgba(0,255,255,0.15))',
            }}
          >
            TechForum
          </h1>

          {/* Кликабельная плашка с датой/локацией → ведёт в /about */}
          <Link
            to="/about"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/65 backdrop-blur-sm hover:border-primary/40 hover:bg-white/[0.06] active:scale-[0.97] transition-all"
            aria-label="О форуме: 25–26 сентября 2026, Москва"
          >
            <CalendarDays className="h-3.5 w-3.5 text-accent" />
            <span>25–26 сент.</span>
            <span className="h-0.5 w-0.5 rounded-full bg-white/30" />
            <MapPin className="h-3.5 w-3.5 text-accent" />
            <span>Москва</span>
          </Link>
        </header>

        <section>
          <div className="grid grid-cols-3 gap-x-3 gap-y-8 mt-8">
            {menuItems.map(({ label, icon: Icon, to, href }, idx) => {
              const isCyan = idx % 3 === 1;
              const inner = (
                <>
                  <div className={`h-16 w-16 rounded-2xl border flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.42)] ${
                    isCyan
                      ? 'border-accent/30 bg-accent/[0.10]'
                      : 'border-primary/25 bg-primary/[0.10]'
                  }`}>
                    <Icon className={`h-7 w-7 ${isCyan ? 'text-accent' : 'text-primary'}`} />
                  </div>
                  <span
                    className="font-display text-foreground tracking-[0.01em] whitespace-nowrap"
                    style={{ fontSize: 'clamp(11px, 3.2vw, 14px)', lineHeight: 1.1 }}
                  >
                    {label}
                  </span>
                </>
              );
              const wrapClass = "flex flex-col items-center text-center gap-2.5 rounded-2xl px-1 py-1 active:scale-95 transition-transform";
              const tile = href ? (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={wrapClass}>
                  {inner}
                </a>
              ) : (
                <Link key={label} to={to!} className={wrapClass}>
                  {inner}
                </Link>
              );
              return (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.04, ease: [0.32, 0.72, 0, 1] }}
                >
                  {tile}
                </motion.div>
              );
            })}
          </div>
        </section>
    </div>
  );
}
