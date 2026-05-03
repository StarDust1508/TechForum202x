import { motion } from 'motion/react';

// Splash экран — встречает юзера при холодном старте.
// Источник изображения: эталон от заказчика (HUD-композиция с глобусом + лог).
// Картинка покрывает весь экран в режиме cover; поверх — анимированный год "2026"
// (поразрядное появление, единый стиль с заголовками /auth и /home).
export default function Splash() {
  return (
    <div
      className="relative bg-[#03161c] overflow-hidden"
      style={{ minHeight: '100lvh' }}
    >
      <img
        src="/splash-bg.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Лёгкая нижняя виньетка, чтобы год не дрался с гравировкой "TechForum" на фоне. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(3,22,28,0.55)_85%,rgba(3,22,28,0.85)_100%)]" />

      <div
        className="relative z-10 flex h-full w-full items-end justify-center"
        style={{
          minHeight: '100lvh',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <motion.span
            aria-hidden
            className="font-display text-[#d8f0ee]/85 text-[22px] tracking-[0.3em]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            ─ ◆ ─
          </motion.span>
          <h1
            aria-label="2026"
            className="font-display text-[#4ec9c0] tracking-[0.18em] flex gap-1 drop-shadow-[0_0_24px_rgba(78,201,192,0.6)]"
            style={{ fontSize: 'clamp(48px, 14vw, 72px)', lineHeight: 1, fontWeight: 600 }}
          >
            {['2', '0', '2', '6'].map((d, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.45 + i * 0.18, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              >
                {d}
              </motion.span>
            ))}
          </h1>
        </div>
      </div>
    </div>
  );
}
