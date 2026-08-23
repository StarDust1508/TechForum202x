import { motion } from 'motion/react';
import { ArrowRight, Check, ExternalLink, Loader2, MessageCircle, TicketCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

interface AccountData { name: string; email: string; }

export default function Ticket() {
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [useAccountData, setUseAccountData] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noTicket, setNoTicket] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ticketResponse, meResponse] = await Promise.all([
          authFetch(resolveApiUrl('/ticket/me'), { credentials: 'include' }),
          authFetch(resolveApiUrl('/auth/me'), { credentials: 'include' }).catch(() => null),
        ]);
        if (meResponse?.ok) {
          const me = await meResponse.json();
          const email = String(me?.email || '');
          if (!cancelled && email && !email.endsWith('@phone.tech-pravo.ru')) setAccount({ name: String(me?.name || ''), email });
        }
        if (!ticketResponse.ok) {
          const body = await ticketResponse.json().catch(() => ({}));
          const code = String(body?.error || '');
          const isMissing = code === 'purchase_email_required' || code === 'ticket_not_found_for_email';
          if (!cancelled) {
            setNoTicket(isMissing);
            setError(isMissing ? '' : 'Не удалось проверить билет. Попробуйте ещё раз позже.');
          }
          return;
        }
        const data: TicketData = await ticketResponse.json();
        if (cancelled) return;
        setTicket(data);
        const dataUrl = await QRCode.toDataURL(data.qrPayload, {
          errorCorrectionLevel: 'H', margin: 2, width: 512,
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setError('Нет соединения с сервером. Билет не потерян — повторите проверку после восстановления связи.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const purchaseHref = useMemo(() => {
    const base = 'https://tech-pravo.ru/conference/uchastnik?tariff=fullpass&source=app';
    if (!useAccountData || !account) return base;
    // Fragment не отправляется в серверные access-логи. Лендинг считывает его
    // один раз для подстановки полей и сразу очищает адресную строку.
    const fragment = new URLSearchParams({ name: account.name, email: account.email }).toString();
    return `${base}#${fragment}`;
  }, [account, useAccountData]);

  return (
    <div className="flex min-h-full flex-col px-4 min-[360px]:px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <div className="mb-6 flex items-center gap-3">
        <BackButton />
        <h1 className="font-display text-[28px] font-bold leading-none">Билет</h1>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {loading && <div className="flex min-h-64 w-full max-w-sm items-center justify-center rounded-3xl border border-border bg-card" role="status"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="sr-only">Проверяем билет</span></div>}

        {!loading && ticket && <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }} className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card p-5">
          <div className="mx-auto w-full max-w-[272px] rounded-2xl bg-white p-4 shadow-lg shadow-black/25">
            {qrDataUrl ? <img src={qrDataUrl} alt="QR-код билета" className="aspect-square w-full" style={{ imageRendering: 'pixelated' }} /> : <div className="flex aspect-square items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0f1118]" /></div>}
          </div>
          <div className="mt-5 text-center"><h2 className="text-lg font-bold">{ticket.name}</h2><p className="mt-1 text-[13px] text-foreground/50">{ticket.email}</p><p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-primary">{ticket.tier}</p></div>
          <p className="mt-5 rounded-xl border border-border bg-background/45 p-3 text-center text-[12px] leading-relaxed text-foreground/55">Покажите этот QR на регистрации. Не публикуйте его и не пересылайте другим людям.</p>
        </motion.section>}

        {!loading && noTicket && <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }} className="w-full max-w-sm rounded-3xl border border-border bg-card p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><TicketCheck className="h-6 w-6" /></div>
          <h2 className="mt-4 font-display text-[22px] font-bold leading-tight">Билет ещё не оформлен</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground/65">Выберите тариф Full Pass на сайте. После подтверждения оплаты билет появится здесь в аккаунте с той же почтой.</p>
          {account && <label className="mt-5 flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background/40 p-3.5"><input type="checkbox" checked={useAccountData} onChange={(event) => setUseAccountData(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" /><span className="text-[13px] leading-snug text-foreground/70"><span className="font-semibold text-foreground">Использовать данные аккаунта</span><span className="mt-1 block break-all text-[12px] text-foreground/45">{account.email}</span></span>{useAccountData && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}</label>}
          <a href={purchaseHref} target="_blank" rel="noreferrer" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">Оформить участие <ArrowRight className="h-4 w-4" /></a>
          <a href="https://t.me/NeuroPravo_Bot?start=conference_participant" target="_blank" rel="noreferrer" className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-[13px] font-semibold text-foreground/70"><MessageCircle className="h-4 w-4" /> Открыть раздел в Telegram</a>
        </motion.section>}

        {!loading && error && !noTicket && <section className="w-full max-w-sm rounded-3xl border border-amber-300/25 bg-card p-5 text-center"><p className="text-[14px] leading-relaxed text-foreground/70">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-11 rounded-xl border border-border px-4 text-[13px] font-bold">Проверить снова</button><a href="https://tech-pravo.ru/conference" target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1 text-[12px] text-foreground/45">Открыть сайт <ExternalLink className="h-3.5 w-3.5" /></a></section>}
      </div>
    </div>
  );
}
