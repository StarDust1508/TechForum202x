import { motion } from 'motion/react';

/**
 * Заставка приложения: технологичный фон (узор схем + свечения),
 * под ним надпись «TechForum 2026».
 *
 * Полностью SVG/CSS — никаких внешних картинок (работает оффлайн, мгновенно).
 */
export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-[#04020f] overflow-hidden">
      {/* Слои фона */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(94,234,212,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(20,184,166,0.18),transparent_45%)]" />

      {/* Технологичный SVG-фон: схемы + узлы + glow */}
      <svg
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full opacity-50"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="0" />
            <stop offset="50%" stopColor="#5eead4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#5eead4" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="node" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="1" />
            <stop offset="100%" stopColor="#5eead4" stopOpacity="0" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* «Схемы» — углы и линии как на материнской плате */}
        <g stroke="url(#line)" strokeWidth="1" fill="none" opacity="0.55">
          <path d="M30 80 H140 V160 H260 V60 H380" />
          <path d="M0 230 H80 V300 H180 V250 H320 V340 H400" />
          <path d="M40 420 V480 H160 V540 H300 V500 H400" />
          <path d="M0 620 H120 V680 H220 V640 H340 V720 H400" />
          <path d="M70 0 V90 H170 V40" />
          <path d="M250 0 V40 H310 V120 H260 V200" />
          <path d="M380 0 V70 H320 V140" />
        </g>

        {/* Узлы (точки соединения) */}
        <g fill="#5eead4">
          {[
            [30, 80], [140, 80], [140, 160], [260, 160], [260, 60], [380, 60],
            [80, 230], [80, 300], [180, 300], [180, 250], [320, 250], [320, 340],
            [40, 420], [40, 480], [160, 480], [160, 540], [300, 540], [300, 500],
            [120, 620], [120, 680], [220, 680], [220, 640], [340, 640], [340, 720],
            [70, 0], [70, 90], [170, 90], [170, 40],
            [250, 40], [310, 40], [310, 120], [260, 120], [260, 200],
            [380, 70], [320, 70], [320, 140],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2.5" />
          ))}
        </g>

        {/* Glow-узлы (большие светящиеся точки) */}
        <g>
          <circle cx="80" cy="230" r="12" fill="url(#node)" />
          <circle cx="320" cy="250" r="14" fill="url(#node)" />
          <circle cx="160" cy="540" r="14" fill="url(#node)" />
          <circle cx="220" cy="680" r="12" fill="url(#node)" />
          <circle cx="260" cy="120" r="10" fill="url(#node)" />
        </g>
      </svg>

      {/* Центральный AI-чип/иконка с пульсацией */}
      <motion.div
        className="relative z-10 flex flex-1 items-center justify-center"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="relative h-32 w-32">
          {/* Внешнее кольцо */}
          <motion.div
            className="absolute inset-0 rounded-3xl border border-[#5eead4]/40"
            animate={{ rotate: 360 }}
            transition={{ duration: 12, ease: 'linear', repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-2 rounded-3xl border border-[#5eead4]/25"
            animate={{ rotate: -360 }}
            transition={{ duration: 16, ease: 'linear', repeat: Infinity }}
          />
          {/* Центральный чип */}
          <div className="absolute inset-5 rounded-2xl bg-gradient-to-br from-[#5eead4]/20 to-[#14b8a6]/10 border border-[#5eead4]/35 backdrop-blur-sm flex items-center justify-center shadow-[0_0_60px_rgba(94,234,212,0.5)]">
            <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#ccfbf1]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {/* Минималистичный «AI/чип» */}
              <rect x="5" y="5" width="14" height="14" rx="2" />
              <path d="M9 5v-2 M15 5v-2 M9 21v-2 M15 21v-2 M5 9h-2 M5 15h-2 M21 9h-2 M21 15h-2" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </div>
          {/* Пульсирующий glow */}
          <motion.div
            className="absolute inset-0 rounded-3xl"
            style={{ boxShadow: '0 0 80px rgba(94,234,212,0.4)' }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>
      </motion.div>

      {/* Надпись TechForum 2026 снизу */}
      <motion.div
        className="relative z-10 pb-16 px-8 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
      >
        <h1 className="font-elite text-[44px] leading-[0.95] font-bold tracking-[0.04em] text-[#ccfbf1] drop-shadow-[0_8px_32px_rgba(94,234,212,0.55)]">
          TechForum
          <span className="block mt-1">2026</span>
        </h1>
        <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/55">
          <span className="h-px w-6 bg-white/30" />
          конференция технологий
          <span className="h-px w-6 bg-white/30" />
        </div>

        {/* Loader-точки */}
        <div className="mt-8 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#5eead4]"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
