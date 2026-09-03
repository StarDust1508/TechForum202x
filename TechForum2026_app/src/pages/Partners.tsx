import { Handshake } from 'lucide-react';
import BackButton from '@/src/components/BackButton';
import { useAppContent } from '@/src/lib/useAppContent';

export default function Partners() {
  const content = useAppContent();
  return (
    <div className="flex-1 min-h-full px-5 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1
            className="font-display text-[28px] leading-none font-bold"
            style={{
              background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
        >Партнёры</h1>
        </div>
        <p className="text-[13px] text-foreground/40 leading-relaxed ml-[52px]">
          Подтверждённые партнёры конференции
        </p>
      </header>

      <div className="space-y-3">
        <section className="rounded-3xl border border-accent/25 bg-card p-6 text-center">
          <Handshake className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-4 font-display text-lg">Партнёрский состав формируется</h2>
          <p className="mt-2 text-[13px] leading-6 text-foreground/55">Мы показываем здесь только подтверждённые компании. Хотите стать партнёром — свяжитесь с командой.</p>
          <a href={`https://t.me/${content.organizerTelegram}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 font-bold text-white">Написать организатору</a>
        </section>
      </div>
    </div>
  );
}
