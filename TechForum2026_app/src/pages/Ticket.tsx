import { motion } from 'motion/react';
import { ScanLine, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import { EVENT_DATE, EVENT_CITY } from '@/src/lib/event';

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
  const [qrSvg, setQrSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(resolveApiUrl('/ticket/me'), { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setError('Не удалось получить билет');
          return;
        }
        const data: TicketData = await res.json();
        if (cancelled) return;
        setTicket(data);
        const svg = await QRCode.toString(data.qrPayload, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 1,
          color: { dark: '#03161c', light: '#ffffff' },
          width: 480,
        });
        if (!cancelled) setQrSvg(svg);
      } catch (e) {
        console.error('[Ticket] fetch failed', e);
        if (!cancelled) setError('Нет соединения с сервером');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ticketShortId = ticket ? ticket.userId.replace(/-/g, '').slice(0, 8).toUpperCase() : '';

  return (
    <PageShell kicker="Электронный билет" title="Мой билет">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="rounded-[28px] border border-[#4ec9c0]/30 bg-[#0a2f38]/55 backdrop-blur-md overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="p-7 space-y-7">
          <div className="flex flex-col items-center gap-5">
            <div className="bg-white p-5 rounded-[20px] shadow-[0_8px_24px_rgba(78,201,192,0.18)]">
              <div className="w-56 h-56 relative overflow-hidden flex items-center justify-center">
                {qrSvg ? (
                  <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                ) : error ? (
                  <p className="text-[#03161c] text-xs font-bold text-center px-4">{error}</p>
                ) : (
                  <Skeleton className="w-full h-full !rounded-md" style={{ backgroundColor: '#e5e7eb' }} />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ScanLine className="w-3.5 h-3.5 text-[#4ec9c0]/85" strokeWidth={1.6} />
              <p className="font-mono text-[11px] text-[#4ec9c0]/85 tracking-[0.3em] uppercase">
                ТФ26 · {ticketShortId || '——————'}
              </p>
            </div>
          </div>

          <div className="text-center space-y-1.5 pt-5 border-t border-[#4ec9c0]/22">
            <p className="font-display-cyrl text-[10px] text-[#7aa8a4] font-semibold uppercase tracking-[0.3em]">
              Владелец билета
            </p>
            {ticket ? (
              <>
                <h2 className="font-display-cyrl text-[20px] font-semibold text-[#d8f0ee] tracking-wide leading-tight">
                  {ticket.name}
                </h2>
                <p className="text-[11px] text-[#7aa8a4] tracking-wider mt-0.5">{ticket.email}</p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <Skeleton className="!rounded-md" height={20} width={160} />
                <Skeleton className="!rounded-md" height={11} width={120} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="rounded-[10px] border border-[#4ec9c0]/22 bg-[#03161c]/40 p-3 text-center">
              <p className="font-mono text-[9px] text-[#7aa8a4] uppercase tracking-[0.22em]">Даты</p>
              <p className="font-display-cyrl text-[12px] text-[#d8f0ee] mt-0.5">{EVENT_DATE.toLowerCase()}</p>
            </div>
            <div className="rounded-[10px] border border-[#4ec9c0]/22 bg-[#03161c]/40 p-3 text-center">
              <p className="font-mono text-[9px] text-[#7aa8a4] uppercase tracking-[0.22em]">Город</p>
              <p className="font-display-cyrl text-[12px] text-[#d8f0ee] mt-0.5">{EVENT_CITY[0] + EVENT_CITY.slice(1).toLowerCase()}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#4ec9c0]/22 bg-[#0a2f38]/35 p-4">
        <ShieldCheck className="w-4 h-4 text-[#4ec9c0] shrink-0 mt-0.5" strokeWidth={1.6} />
        <p className="text-[12px] text-[#7aa8a4] leading-relaxed">
          QR-код подписан HMAC-SHA256. Не отдавайте скрин третьим лицам — для входа достаточно одного сканирования.
        </p>
      </div>
    </PageShell>
  );
}
