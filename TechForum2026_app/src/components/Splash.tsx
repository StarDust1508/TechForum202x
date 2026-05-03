import { motion } from 'motion/react';
import { Landmark } from 'lucide-react';
import AppBackground from './AppBackground';
import BrandTitle from './ui/BrandTitle';
import EventBadge from './ui/EventBadge';

export default function Splash() {
  return (
    <AppBackground>
      <div
        className="flex flex-1 flex-col items-center px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
        >
          <BrandTitle />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
          className="mt-5"
        >
          <EventBadge />
        </motion.div>

        <div className="mt-12 flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            className="relative"
          >
            <motion.span
              aria-hidden
              className="absolute inset-0 -m-10 rounded-full bg-[radial-gradient(circle,rgba(78,201,192,0.35),transparent_65%)] blur-xl"
              animate={{ opacity: [0.55, 0.85, 0.55] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-full border border-[#4ec9c0]/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              style={{ inset: '-22px' }}
            />
            <motion.div
              aria-hidden
              className="absolute rounded-full border border-dashed border-[#4ec9c0]/20"
              animate={{ rotate: -360 }}
              transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
              style={{ inset: '-44px' }}
            />
            <span className="relative flex h-[150px] w-[150px] items-center justify-center rounded-full border border-[#4ec9c0]/55 bg-[#03161c]/65 shadow-[0_0_60px_rgba(78,201,192,0.35),inset_0_0_24px_rgba(78,201,192,0.12)] backdrop-blur-sm">
              <Landmark className="h-16 w-16 text-[#4ec9c0]" strokeWidth={1.4} />
            </span>
          </motion.div>
        </div>

        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="h-1 w-1 rounded-full bg-[#4ec9c0]/70 shadow-[0_0_12px_rgba(78,201,192,0.7)]"
          style={{ animation: 'splashPulse 1.6s ease-in-out infinite' }}
        />
      </div>
      <style>{`@keyframes splashPulse { 0%,100%{opacity:.4;transform:scale(.85)} 50%{opacity:1;transform:scale(1.15)} }`}</style>
    </AppBackground>
  );
}
