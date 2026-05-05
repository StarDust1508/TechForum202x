import { motion } from 'motion/react';
import BrandTitle from './ui/BrandTitle';
import EventBadge from './ui/EventBadge';

// Splash экран — встречает юзера при холодном старте.
// Тут нативный Capacitor SplashScreen уже отрисовал splash-bg.jpg на full-screen
// (см. capacitor.config.ts > SplashScreen, drawables в android/app/src/main/res/).
// Этот React-компонент рисуется поверх и держит ту же brand-картинку, чтобы
// переход native→web был бесшовным (без флика).
//
// Раньше было: AppBackground (blueprint-сетка) + BrandTitle с letter-by-letter
// typewriter + три пульсирующих точки = «у нас что-то грузится». Теперь —
// статичная hero-картинка + один общий fade-in для брендинга. Tier-1 polish:
// «у эталона splash статичный, без анимации» — здесь то же самое.
export default function Splash() {
  return (
    <div
      className="relative flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{
        minHeight: '100lvh',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        backgroundColor: '#03161c',
      }}
    >
      {/* Hero — та же картинка что в нативном splash (drawable/splash.png).
          object-cover держит композицию на любом aspect-ratio. */}
      <img
        src="/splash-bg.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      {/* Лёгкий вертикальный градиент для читаемости текста поверх картинки. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(3,22,28,0.55) 0%, rgba(3,22,28,0.15) 35%, rgba(3,22,28,0.65) 100%)',
        }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        <BrandTitle animateYear={false} />
        <div className="mt-6">
          <EventBadge />
        </div>
      </motion.div>
    </div>
  );
}
