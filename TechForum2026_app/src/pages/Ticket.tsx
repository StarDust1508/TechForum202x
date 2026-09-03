// FILE: src/pages/Ticket.tsx
// VERSION: 2.1.0
// START_MODULE_CONTRACT:
// PURPOSE: Экран билета — реальный сканируемый QR с подписью HMAC, имя
//          держателя из API.
// SCOPE: UI билета + fetch /ticket/me + QR-генерация через qrcode-lib.
// INPUT: /api/v1/ticket/me → { qrPayload, name, email, tier, eventId }.
// OUTPUT: JSX страница.
// KEYWORDS: DOMAIN(8): TicketScanning; CONCEPT(8): QRCode, HMAC; TECH(8): qrcode lib
// LINKS: CALLS_API(9): /ticket/me
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v2.1.0 - Visual refresh: unified design language, improved
//                       ticket card styling, consistent typography.]
// PREV_CHANGE_SUMMARY: [v2.0.0 - Реальный QR через qrcode-lib (SVG), имя/email из API.]
// END_CHANGE_SUMMARY

import { motion } from 'motion/react';
import { Loader2, QrCode, CalendarDays, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';
import { EVENT_META } from '../data';

interface TicketData {
  eventId: string;
  publicId: string;
  name: string;
  email: string;
  tier: string;
  orderRef: string;
  qrPayload: string;
  issuedAt: string;
  validUntil: string;
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
          const body = await res.json().catch(() => ({})) as { error?: string };
          if (!cancelled) {
            setError(body.error === 'ticket_not_issued'
              ? 'Билет появится здесь после подтверждения оплаты'
              : 'Реестр билетов временно недоступен');
          }
          return;
        }
        const data: TicketData = await res.json();
        if (cancelled) return;
        setTicket(data);
        const svg = await QRCode.toString(data.qrPayload, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 1,
          color: { dark: '#0a0e17', light: '#ffffff' },
          width: 480,
        });
        if (!cancelled) setQrSvg(svg);
      } catch {
        if (!cancelled) setError('Нет соединения с сервером');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ticketShortId = ticket ? ticket.publicId.replace(/-/g, '').slice(0, 8).toUpperCase() : '';

  return (
    <div className="flex-1 flex flex-col px-5 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />

      <header className="space-y-2 mb-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff3399]/60 font-bold flex items-center gap-2">
          <QrCode className="w-3.5 h-3.5" />
          ЭЛЕКТРОННЫЙ БИЛЕТ
        </p>
        <h1 className="font-elite text-3xl leading-none text-white">Мой билет</h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto scrollbar-hide">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
        >
          {/* QR Section */}
          <div className="p-8 flex flex-col items-center gap-5">
            <div className={qrSvg ? 'bg-white p-4 rounded-2xl shadow-lg shadow-black/30' : 'w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5'}>
              <div className="w-52 h-52 relative overflow-hidden flex items-center justify-center">
                {qrSvg ? (
                  <div
                    className="w-full h-full"
                    // QR-svg от qrcode-lib — статический контент, генерируется
                    // нашим клиентом, не приходит из user-input. Безопасно.
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : error ? (
                  <div className="text-center space-y-4 px-2">
                    <QrCode className="w-9 h-9 mx-auto text-white/25" />
                    <p className="text-white/65 text-sm font-bold leading-snug">{error}</p>
                    <a
                      href="https://tech-pravo.ru/conference#tickets"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl border border-[#00ffff]/30 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#00ffff]"
                    >
                      Оформить билет
                    </a>
                  </div>
                ) : (
                  <Loader2 className="w-8 h-8 text-[#0a0e17] animate-spin" />
                )}
              </div>
            </div>

            {ticket && (
              <p className="text-[11px] text-white/30 font-mono font-bold tracking-[0.4em] uppercase">
                ТФ26 · {ticketShortId}
              </p>
            )}
          </div>

          {/* Divider — perforated line */}
          <div className="relative h-px mx-6">
            <div className="absolute inset-0 border-t border-dashed border-white/[0.08]" />
          </div>

          {/* Holder info */}
          <div className="p-6 space-y-4">
            <div className="text-center space-y-1.5">
              <p className="text-[9px] text-white/30 font-bold uppercase tracking-[0.2em]">Владелец билета</p>
              <h2 className="text-[18px] font-bold text-white/95 tracking-tight leading-tight">
                {ticket?.name ?? '—'}
              </h2>
              {ticket && (
                <p className="text-[11px] text-white/35">{ticket.email}</p>
              )}
              {ticket && (
                <p className="text-[10px] text-[#00ffff]/55 font-semibold uppercase tracking-[0.12em]">
                  {ticket.tier} · {ticket.orderRef}
                </p>
              )}
            </div>

            {/* Event info */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="inline-flex items-center gap-1.5 text-[10px] text-white/40 font-semibold">
                <CalendarDays className="w-3 h-3 text-[#00ffff]/50" />
                25–26 сентября 2026
              </div>
              <div className="w-1 h-1 rounded-full bg-white/15" />
              <div className="inline-flex items-center gap-1.5 text-[10px] text-white/40 font-semibold">
                <MapPin className="w-3 h-3 text-[#ff3399]/50" />
                {EVENT_META.city}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
