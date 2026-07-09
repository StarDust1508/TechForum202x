import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { resolveApiUrl, authFetch } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';

interface TicketData {
  eventId: string;
  userId: string;
  name: string;
  email: string;
  tier: string;
  qrPayload: string;
  issuedAt: string;
}

export default function Ticket() {
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(resolveApiUrl('/ticket/me'), { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setError('Не удалось получить билет');
          return;
        }
        const data: TicketData = await res.json();
        if (cancelled) return;
        setTicket(data);
        const dataUrl = await QRCode.toDataURL(data.qrPayload, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 512,
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setError('Нет соединения с сервером');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex-1 flex flex-col px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <h1
          className="font-display text-[28px] leading-none font-bold"
          style={{
            background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >Билет</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[320px] rounded-3xl border border-border bg-white/[0.03] overflow-hidden"
      >
        <div className="p-8 flex flex-col items-center gap-6">
          <div className="bg-white p-4 rounded-2xl shadow-lg shadow-black/30">
            <div className="w-56 h-56 relative overflow-hidden flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR-код билета"
                  className="w-full h-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : error ? (
                <p className="text-[#0f1118] text-xs font-bold text-center px-4">{error}</p>
              ) : (
                <Loader2 className="w-8 h-8 text-[#0f1118] animate-spin" />
              )}
            </div>
          </div>

          {ticket && (
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                {ticket.name}
              </h2>
              <p className="text-[12px] text-foreground/40">{ticket.email}</p>
            </div>
          )}
        </div>
      </motion.div>
      </div>
    </div>
  );
}
