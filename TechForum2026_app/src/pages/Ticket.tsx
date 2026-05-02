// FILE: src/pages/Ticket.tsx
// VERSION: 2.0.0
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
// START_RATIONALE:
// Q: Почему qrcode-lib SVG (toString), а не canvas?
// A: SVG масштабируется без потери качества (важно для разных DPI APK), не
//    содержит pixelation на маленьких экранах, и его можно стилизовать через CSS.
// Q: Почему QR на клиенте, а не серверной картинкой?
// A: SVG-генерация занимает <5ms и не требует round-trip; payload приходит
//    с сервера. Клиент не может подделать payload без HMAC, поэтому
//    безопасность не страдает.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v2.0.0 - Реальный QR через qrcode-lib (SVG), имя/email из API
//                       /ticket/me, HMAC-подпись для проверки на входе.]
// PREV_CHANGE_SUMMARY: [v1.0.0 - Math.random() rect-noise + хардкод имени.]
// END_CHANGE_SUMMARY

import { motion } from 'motion/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';

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
  const navigate = useNavigate();
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
          color: { dark: '#13161f', light: '#ffffff' },
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
    <div className="flex-1 bg-surface flex flex-col px-5 pb-10">
      <header className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-card border border-card-border active:scale-90 transition-all"
        >
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Мой билет</h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto scrollbar-hide pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card border border-card-border rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/60"
        >
          <div className="p-10 space-y-12">
            <div className="flex flex-col items-center gap-6">
              <div className="bg-white p-5 rounded-[2.5rem] border-[6px] border-[#1a1e2a] shadow-xl">
                <div className="w-56 h-56 relative overflow-hidden flex items-center justify-center">
                  {qrSvg ? (
                    <div
                      className="w-full h-full"
                      // QR-svg от qrcode-lib — статический контент, генерируется
                      // нашим клиентом, не приходит из user-input. Безопасно.
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : error ? (
                    <p className="text-[#13161f] text-xs font-bold text-center px-4">{error}</p>
                  ) : (
                    <Loader2 className="w-8 h-8 text-[#13161f] animate-spin" />
                  )}
                </div>
              </div>
              {ticket && (
                <p className="text-sm text-muted font-bold tracking-[0.5em] uppercase opacity-60">
                  ТФ26 · {ticketShortId}
                </p>
              )}
            </div>

            <div className="text-center space-y-2 py-6 border-t border-card-border/50">
              <p className="text-[10px] text-muted font-black uppercase tracking-[0.3em]">Владелец билета</p>
              <h2 className="text-xl font-black text-primary tracking-tight leading-tight px-4">
                {ticket?.name ?? '—'}
              </h2>
              {ticket && (
                <p className="text-[11px] text-muted/70 tracking-wider mt-1">{ticket.email}</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
