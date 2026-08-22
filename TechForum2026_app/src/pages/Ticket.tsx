import { motion } from 'motion/react';
import { ExternalLink, Loader2, Mail, Send } from 'lucide-react';
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
          const body = await res.json().catch(() => ({}));
          const code = String(body?.error || '');
          const message = code === 'purchase_email_required'
            ? 'Войдите по email, который был указан при покупке билета.'
            : code === 'ticket_not_found_for_email'
              ? 'На этой почте нет оплаченного билета.'
              : 'Не удалось проверить билет. Попробуйте ещё раз позже.';
          if (!cancelled) setError(message);
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
        className="w-full max-w-[320px] rounded-3xl border border-border bg-foreground/[0.03] overflow-hidden"
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
                <div className="text-[#0f1118] text-center px-3">
                  <Mail className="w-8 h-8 mx-auto mb-3" />
                  <p className="text-xs font-bold leading-relaxed">{error}</p>
                </div>
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
      {error && (
        <div className="mt-5 w-full max-w-[320px] rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-[12px] leading-relaxed text-foreground/55">Скачивать приложение может каждый. QR-билет открывается только в аккаунте с почтой покупателя.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href="mailto:info@tech-pravo.ru" className="rounded-xl border border-accent/30 py-2.5 text-[11px] font-bold text-accent">Написать на email</a>
            <a href="https://t.me/CEO_WYRM1" target="_blank" rel="noreferrer" className="rounded-xl bg-primary py-2.5 text-[11px] font-bold text-white inline-flex items-center justify-center gap-1.5"><Send className="w-3.5 h-3.5" />Telegram</a>
          </div>
          <a href="https://tech-pravo.ru/profile" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] text-foreground/45">Проверить покупку на сайте <ExternalLink className="w-3 h-3" /></a>
        </div>
      )}
      </div>
    </div>
  );
}
