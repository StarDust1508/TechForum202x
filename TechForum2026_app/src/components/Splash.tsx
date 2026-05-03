import { motion } from 'motion/react';
import AppBackground from './AppBackground';
import BrandTitle from './ui/BrandTitle';
import EventBadge from './ui/EventBadge';

// Splash экран — встречает юзера при холодном старте.
// Раньше использовался splash-bg.jpg с object-cover, но на узких/высоких
// экранах изображение обрезалось (юзер описывал как «скукоженное»).
// Теперь — единый brand-фон AppBackground + рендерим BrandTitle поверх,
// так Splash и Auth выглядят согласованно.
export default function Splash() {
  return (
    <AppBackground>
      <div
        className="flex flex-1 flex-col items-center justify-center px-6"
        style={{
          minHeight: '100lvh',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        <BrandTitle animateYear />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-6"
        >
          <EventBadge />
        </motion.div>

        {/* Подгрузочный аккорд — три точки-tracker'а в blueprint-стиле. */}
        <div className="mt-10 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#4ec9c0]"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ delay: i * 0.15, duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </AppBackground>
  );
}
