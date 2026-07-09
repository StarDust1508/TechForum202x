// FILE: src/pages/MyCard.tsx
// Round 6: «Моя визитка» (QR для нетворкинга — раздел из эталона Eventicious).
// Отличается от Ticket: тут payload подписывает (userId|name|role|exp),
// сканер другой стороны добавляет в свой список контактов.
//
// Flow:
//   А открывает /my-card → большой QR
//   Б тапает «Сканировать» → камера → расшифровывает QR Б → шлёт сервер
//   Сервер пишет contact_exchanges A↔Б, у обоих в /me/contacts появляется.
//
// Сканер — пробуем @capacitor/barcode-scanner (если установлен) или
// fallback на BarcodeDetector API. На web без обоих — кнопка «Скан»
// неактивна с подсказкой что нужно открыть в мобильном приложении.

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScanLine, RefreshCw, X, ContactRound, Camera } from 'lucide-react';
import QRCode from 'qrcode';
import { resolveApiUrl, resolveAssetUrl, authFetch } from '@/src/lib/runtimeEndpoint';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import AvatarImage from '@/src/components/ui/AvatarImage';
import HudFrame from '@/src/components/ui/HudFrame';
import { useToast } from '@/src/components/Toast';
import { hapticNotify } from '@/src/lib/haptics';

interface CardData {
  qrPayload: string;
  userId: string;
  name: string;
  role: string;
  avatar: string;
  issuedAt: string;
  expiresAt: string;
}

interface ContactRow {
  contactId: string;
  note: string;
  metAt: string;
  user: { id: string; name: string; role: string; avatar: string } | null;
}

export default function MyCard() {
  const toast = useToast();
  const [card, setCard] = useState<CardData | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loadingCard, setLoadingCard] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Fetch card payload + рендер QR.
  const refreshCard = async () => {
    setLoadingCard(true);
    try {
      const r = await authFetch(resolveApiUrl('/me/business-card'), { credentials: 'include' });
      if (!r.ok) return;
      const data: CardData = await r.json();
      setCard(data);
      const svg = await QRCode.toString(data.qrPayload, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: { dark: '#0f1118', light: '#ffffff' },
        width: 360,
      });
      setQrSvg(svg);
    } catch { /* offline */ } finally {
      setLoadingCard(false);
    }
  };

  const refreshContacts = async () => {
    setLoadingContacts(true);
    try {
      const r = await authFetch(resolveApiUrl('/me/contacts'), { credentials: 'include' });
      if (r.ok) {
        const data: ContactRow[] = await r.json();
        setContacts(data);
      }
    } catch { /* offline */ } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    void refreshCard();
    void refreshContacts();
  }, []);

  // ====== Сканер QR другой стороны ======
  const stopScanning = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    setScanning(false);
  };

  const handleScannedPayload = async (qrPayload: string) => {
    stopScanning();
    try {
      const r = await authFetch(resolveApiUrl('/me/contacts/exchange'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPayload }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const errMsg =
          data.error === 'qr_expired' ? 'QR-код истёк (>24ч)' :
          data.error === 'invalid_signature' ? 'Подпись QR невалидна' :
          data.error === 'invalid_qr' ? 'Это не QR-визитка' :
          data.error === 'self_exchange' ? 'Это ваш собственный QR' :
          data.error === 'user_not_found' ? 'Пользователь не найден' :
          'Не удалось обменяться контактами';
        toast.show(errMsg, 2400);
        void hapticNotify('error');
        return;
      }
      toast.show(`Добавлен в контакты: ${data.contact?.name ?? 'участник'}`, 2400);
      void hapticNotify('success');
      void refreshContacts();
    } catch {
      toast.show('Нет соединения', 2400);
      void hapticNotify('error');
    }
  };

  const startScanning = async () => {
    setScanError(null);
    setScanning(true);
    // Web BarcodeDetector — Chrome/Edge на Android поддерживают; в Capacitor
    // WebView (Chromium) тоже работает. Если API нет — показываем ошибку.
    const BarcodeDetector = (window as any).BarcodeDetector;
    if (!BarcodeDetector) {
      setScanError('Сканер недоступен в этой версии. Обновите приложение или используйте устройство Android 11+.');
      setScanning(false);
      return;
    }
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (!formats.includes('qr_code')) {
        setScanError('Браузер не умеет сканировать QR.');
        setScanning(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      detectorRef.current = detector;
      // Подождём один tick — videoRef должен быть смонтирован.
      requestAnimationFrame(() => {
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        const tick = async () => {
          if (!videoRef.current || !detectorRef.current || !streamRef.current) return;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes.length > 0) {
              const value = codes[0]!.rawValue;
              if (value && value.startsWith('card|')) {
                await handleScannedPayload(value);
                return;
              }
            }
          } catch { /* one frame failed — retry */ }
          scanLoopRef.current = requestAnimationFrame(tick);
        };
        scanLoopRef.current = requestAnimationFrame(tick);
      });
    } catch (err) {
      setScanError(`Камера недоступна: ${(err as Error).message || 'permission_denied'}`);
      setScanning(false);
    }
  };

  useEffect(() => () => stopScanning(), []);

  return (
    <PageShell kicker="Нетворкинг" title="Моя визитка" subtitle="Покажите QR — другой участник сканирует — у обоих появится контакт">
      {loadingCard ? (
        <div className="rounded-3xl border border-primary/30 bg-card p-6">
          <Skeleton height={360} />
        </div>
      ) : card ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          className="rounded-3xl border border-primary/45 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 space-y-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-background border border-primary/45 shrink-0">
              <AvatarImage src={card.avatar ? resolveAssetUrl(card.avatar) : null} name={card.name} className="h-full w-full" letterClassName="text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-[18px] font-semibold text-foreground truncate leading-tight">{card.name}</p>
              <p className="text-[12px] text-foreground/40 truncate">{card.role || 'Участник'}</p>
            </div>
          </div>

          {/* Round 8: QR в octagon-обводке (HudFrame). Внутрь врисовывается
              белый square с QR через clip-path octagon. Сканер по углам не
              читает QR-данные (всегда внутри margin), поэтому угловые срезы
              не повреждают код. */}
          <div className="flex items-center justify-center">
            {qrSvg ? (
              (() => {
                const SIZE = 300;
                const cut = Math.round(SIZE * 0.18);
                const px = (x: number, y: number): string =>
                  `${((x / SIZE) * 100).toFixed(2)}% ${((y / SIZE) * 100).toFixed(2)}%`;
                const clip = `polygon(${px(cut, 4)}, ${px(SIZE - cut, 4)}, ${px(SIZE - 4, cut)}, ${px(SIZE - 4, SIZE - cut)}, ${px(SIZE - cut, SIZE - 4)}, ${px(cut, SIZE - 4)}, ${px(4, SIZE - cut)}, ${px(4, cut)})`;
                return (
                  <HudFrame size={{ w: SIZE, h: SIZE }} fillOpacity={0} glow={18}>
                    <div
                      className="absolute inset-0 bg-white flex items-center justify-center"
                      style={{ clipPath: clip, WebkitClipPath: clip }}
                    >
                      <div
                        className="w-[78%] h-[78%] [&>svg]:w-full [&>svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                    </div>
                  </HudFrame>
                );
              })()
            ) : (
              <Skeleton height={300} width={300} />
            )}
          </div>

          <p className="text-[11px] text-foreground/45 leading-relaxed text-center">
            QR действует 24 часа. После истечения — обновите кнопкой ниже.
          </p>

          <button
            type="button"
            onClick={refreshCard}
            className="w-full flex items-center justify-center gap-2 border border-primary/35 bg-white/[0.06] hover:border-primary/60 text-foreground py-3 rounded-2xl text-[12px] font-semibold uppercase tracking-[0.14em] active:scale-[0.98] transition-all font-display"
          >
            <RefreshCw className="w-4 h-4 text-primary" strokeWidth={1.8} />
            Обновить QR
          </button>
        </motion.div>
      ) : (
        <div className="rounded-3xl border border-rose-500/40 bg-card p-6 text-center text-foreground/85">
          Не удалось получить визитку. Попробуйте позже.
        </div>
      )}

      <button
        type="button"
        onClick={startScanning}
        className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-2xl text-[13px] font-semibold uppercase tracking-[0.14em] active:scale-[0.98] hover:brightness-110 transition-all font-display shadow-[0_8px_24px_rgba(255,51,153,0.25)]"
      >
        <ScanLine className="w-5 h-5" strokeWidth={2} />
        Сканировать чужой QR
      </button>

      {/* Список обмененных контактов */}
      <section className="mt-7 space-y-3">
        <h3 className="font-display text-[11px] uppercase tracking-[0.28em] font-semibold text-primary/85 px-1 flex items-center gap-2">
          <ContactRound className="w-3.5 h-3.5" strokeWidth={1.8} />
          Мои контакты
          {contacts.length > 0 && <span className="font-mono text-[10px] text-primary/85">· {contacts.length}</span>}
        </h3>
        {loadingContacts ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 bg-card border border-primary/22 p-3 rounded-2xl">
                <Skeleton className="rounded-full" width={40} height={40} />
                <div className="flex-1 space-y-1.5">
                  <Skeleton height={11} width="50%" />
                  <Skeleton height={9} width="70%" />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary/25 bg-white/[0.03] p-6 text-center">
            <p className="text-[12px] text-foreground/40 leading-relaxed">
              Пока пусто. Сканируйте QR-визитки других участников — список начнёт расти.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div
                key={c.contactId}
                className="flex items-center gap-3 bg-card border border-primary/22 p-3 rounded-2xl"
              >
                <div className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-background border border-primary/35 shrink-0">
                  <AvatarImage src={c.user?.avatar ? resolveAssetUrl(c.user.avatar) : null} name={c.user?.name ?? '?'} className="h-full w-full" letterClassName="text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[13px] font-semibold text-foreground truncate">
                    {c.user?.name ?? 'Удалённый участник'}
                  </p>
                  <p className="text-[11px] text-foreground/40 truncate">{c.user?.role ?? ''}</p>
                  {c.note && <p className="text-[10px] text-primary/85 truncate mt-0.5">«{c.note}»</p>}
                </div>
                <span className="font-mono text-[9px] text-foreground/45 uppercase tracking-widest shrink-0">
                  {new Date(c.metAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Scanner overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black flex flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div className="flex items-center justify-between px-5 py-3 bg-black/80 z-10">
              <div className="flex items-center gap-2 text-foreground">
                <Camera className="w-4 h-4" strokeWidth={1.8} />
                <span className="font-display text-[14px] font-semibold">Наведите на QR</span>
              </div>
              <button
                type="button"
                onClick={stopScanning}
                aria-label="Закрыть"
                className="h-9 w-9 rounded-xl border border-foreground/30 flex items-center justify-center text-foreground"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Frame guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-primary/85 rounded-2xl shadow-[0_0_36px_rgba(255,51,153,0.5)]" />
              </div>
            </div>
            {scanError && (
              <div className="px-5 py-3 bg-rose-500/15 border-t border-rose-500/35 text-rose-200 text-[12px] flex items-start gap-2">
                <X className="w-4 h-4 mt-0.5 shrink-0" />
                {scanError}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {scanError && !scanning && (
        <p className="mt-3 text-[11px] text-rose-300/85 leading-relaxed text-center">
          {scanError}
        </p>
      )}
    </PageShell>
  );
}
