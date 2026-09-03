// FILE: src/pages/Settings.tsx
// VERSION: 1.0.0
// Settings страница — минимальный набор по эталону Eventicious-приложений
// (TechWeek Moscow). 4 пункта: Уведомления, Условия, Согласие на ПД, О приложении.
// Раньше «настроек» как раздела не было; cog-иконка в Profile открывала
// модалку редактирования профиля — что не интуитивно.
//
// Все 4 экрана внутри — простые info-страницы. Условия / Соглашение —
// полные тексты в комплект 152-ФЗ. О приложении — версия + ссылки.
//
// Уведомления — пока локальная toggle (без бэкенда push), Round 4 заведёт
// push_tokens table и реальные подписки.

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, FileText, ShieldCheck, Info, ChevronRight, X, ArrowLeft, Loader2, EyeOff,
} from 'lucide-react';
import PageShell from '@/src/components/ui/PageShell';
import { hapticSelection } from '@/src/lib/haptics';
import { registerPushNotifications, unregisterPushNotifications } from '@/src/lib/push';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';

type Section = 'notifications' | 'terms' | 'privacy' | 'about';

const TERMS_TEXT = `Используя приложение TechForum 2026, вы соглашаетесь с правилами форума и политикой конфиденциальности.

Приложение разработано для участников конференции и предоставляется для удобства навигации по программе, общения с другими участниками и получения уведомлений от организатора.

Запрещено: спам, оскорбления других участников, использование чужих учётных записей, попытки получить несанкционированный доступ к чужим данным или серверу.

При обнаружении нарушений организатор оставляет за собой право заблокировать аккаунт без возврата стоимости билета.

Все материалы (доклады, фото, видео) защищены авторским правом и не могут быть опубликованы вне приложения без разрешения авторов и организатора.

Полную версию пользовательского соглашения см. на сайте techforum.ru.`;

const PRIVACY_TEXT = `Согласно ФЗ-152 «О персональных данных», вы даёте согласие на обработку следующих данных:
— ФИО, контактный email, телефон;
— фото профиля (если загружено);
— ваша активность в приложении (регистрации на сессии, переписка с другими участниками — содержимое сообщений шифруется на сервере при хранении);
— технические данные устройства (модель, ОС, IP-адрес) — для диагностики и защиты от злоупотреблений.

Цели обработки: предоставление функционала приложения, отправка уведомлений о форуме, статистика для организатора (анонимизированная).

Срок хранения: пока действует ваш аккаунт + 6 месяцев после удаления (юридический архив).

Передача третьим лицам: только организатору форума и его техническому подрядчику. Не передаётся партнёрам или рекламным сетям.

Вы можете в любой момент:
— скачать копию своих данных (запрос через support@techforum.ru);
— удалить аккаунт через профиль (необратимо).

Полная политика конфиденциальности доступна на сайте techforum.ru/privacy.`;

const APP_VERSION = '1.0.0';
const APP_BUILD = (import.meta.env.VITE_BUILD_SHORT_SHA as string | undefined) ?? 'dev';

function NotificationsPage() {
  // Round 5: переключатель реально регистрирует/удаляет push-токен на бэке.
  // Round 7: + privacy-toggle «Скрывать предпросмотр» — body push'а становится
  // generic «Новое сообщение» вместо реального текста (lock-screen не светит).
  const NOTIF_LS_KEY = 'techforum_notifications_enabled';
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(NOTIF_LS_KEY) === '1'; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [pushDelivery, setPushDelivery] = useState<'checking' | 'live' | 'unavailable'>('checking');
  const [previewHidden, setPreviewHidden] = useState<boolean>(false);
  const [previewBusy, setPreviewBusy] = useState(false);

  // Подгружаем текущее значение pushPreviewHidden c бэка.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(resolveApiUrl('/auth/me'), { credentials: 'include' });
        if (r.ok) {
          const me = await r.json();
          if (!cancelled) setPreviewHidden(!!me.pushPreviewHidden);
        }
      } catch { /* offline */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Server delivery is a separate capability from OS permission. Fail closed:
  // a granted Android permission is not presented as a working subscription
  // when FCM credentials are absent on the backend.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(resolveApiUrl('/health'), { cache: 'no-store' });
        const health = response.ok ? await response.json() : null;
        const live = health?.pushDelivery === 'live';
        if (cancelled) return;
        setPushDelivery(live ? 'live' : 'unavailable');
        if (!live) {
          setEnabled(false);
          try { localStorage.setItem(NOTIF_LS_KEY, '0'); } catch { /* noop */ }
          setHint('Push-доставка временно недоступна. Переключатель станет активным после подключения сервиса организатором.');
        }
      } catch {
        if (!cancelled) {
          setPushDelivery('unavailable');
          setHint('Не удалось проверить сервис уведомлений. Подписка не включена.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const togglePreviewHidden = async () => {
    if (previewBusy) return;
    const next = !previewHidden;
    setPreviewBusy(true);
    setPreviewHidden(next);
    void hapticSelection();
    try {
      const r = await fetch(resolveApiUrl('/auth/me'), {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushPreviewHidden: next }),
      });
      if (!r.ok) throw new Error(`patch_failed_${r.status}`);
    } catch {
      setPreviewHidden(!next); // rollback
    } finally {
      setPreviewBusy(false);
    }
  };
  const toggle = async () => {
    if (busy || pushDelivery !== 'live') return;
    setBusy(true);
    void hapticSelection();
    if (!enabled) {
      // ON: register
      const ok = await registerPushNotifications();
      if (ok) {
        setEnabled(true);
        try { localStorage.setItem(NOTIF_LS_KEY, '1'); } catch { /* noop */ }
        setHint('Подписка зарегистрирована на этом устройстве.');
      } else {
        setHint('Разрешение на уведомления не получено или сервис недоступен. Откройте Настройки → Приложения → TechForum 2026 → Уведомления и включите вручную.');
      }
    } else {
      // OFF: unregister
      await unregisterPushNotifications();
      setEnabled(false);
      try { localStorage.setItem(NOTIF_LS_KEY, '0'); } catch { /* noop */ }
      setHint('Подписка отключена. Push-уведомления приходить не будут.');
    }
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || pushDelivery !== 'live'}
        className="w-full flex items-center justify-between gap-4 rounded-2xl border border-[#4ec9c0]/30 bg-[#0a2f38]/55 px-5 py-4 active:scale-[0.99] transition-transform disabled:opacity-70"
      >
        <div className="text-left">
          <p className="font-display-cyrl text-[15px] font-semibold text-[#d8f0ee]">
            Push-уведомления
          </p>
          <p className="text-[12px] text-[#7aa8a4] mt-0.5">
            {pushDelivery === 'checking' ? 'Проверяем доступность' : pushDelivery === 'live' ? 'Анонсы сессий, ответы на сообщения' : 'Временно недоступно'}
          </p>
        </div>
        {busy ? (
          <Loader2 className="w-5 h-5 animate-spin text-[#4ec9c0]" strokeWidth={1.8} />
        ) : (
          <span
            className={`relative w-11 h-6 rounded-full transition-colors ${
              enabled ? 'bg-[#4ec9c0]' : 'bg-[#0a2f38] border border-[#4ec9c0]/30'
            }`}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className={`absolute top-0.5 w-5 h-5 rounded-full ${
                enabled ? 'left-[22px] bg-[#03161c]' : 'left-0.5 bg-[#4ec9c0]'
              }`}
            />
          </span>
        )}
      </button>
      {hint && (
        <p className="px-5 text-[11px] text-[#7aa8a4]/85 leading-relaxed">
          {hint}
        </p>
      )}
      {!hint && (
        <p className="px-5 text-[11px] text-[#7aa8a4]/85 leading-relaxed">
          Включите чтобы получать важные оповещения форума: начало сессии,
          новые сообщения, объявления оргкомитета. Отключение применяется
          мгновенно и не требует переустановки.
        </p>
      )}

      {/* Round 7: privacy-toggle. Только если push-уведомления вообще включены —
          иначе скрываем (нечего скрывать). */}
      {enabled && (
        <button
          type="button"
          onClick={togglePreviewHidden}
          disabled={previewBusy}
          className="mt-4 w-full flex items-center justify-between gap-4 rounded-2xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 px-5 py-4 active:scale-[0.99] transition-transform disabled:opacity-70"
        >
          <div className="flex items-start gap-3 text-left flex-1 min-w-0">
            <EyeOff className="w-4 h-4 mt-0.5 text-[#4ec9c0] shrink-0" strokeWidth={1.6} />
            <div>
              <p className="font-display-cyrl text-[14px] font-semibold text-[#d8f0ee]">
                Скрывать предпросмотр
              </p>
              <p className="text-[11px] text-[#7aa8a4] mt-0.5 leading-relaxed">
                Текст сообщения не будет виден на заблокированном экране — только «Новое сообщение».
              </p>
            </div>
          </div>
          {previewBusy ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#4ec9c0] shrink-0" strokeWidth={1.8} />
          ) : (
            <span
              className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${
                previewHidden ? 'bg-[#4ec9c0]' : 'bg-[#0a2f38] border border-[#4ec9c0]/30'
              }`}
              style={{ height: 22, width: 40 }}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className={`absolute top-0.5 w-4 h-4 rounded-full ${
                  previewHidden ? 'left-[20px] bg-[#03161c]' : 'left-0.5 bg-[#4ec9c0]'
                }`}
              />
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export default function Settings() {
  const [section, setSection] = useState<Section | null>(null);

  const items: Array<{ key: Section; icon: typeof Bell; label: string; sub: string }> = [
    { key: 'notifications', icon: Bell, label: 'Уведомления', sub: 'Push, анонсы сессий' },
    { key: 'terms', icon: FileText, label: 'Условия использования', sub: 'Правила форума' },
    { key: 'privacy', icon: ShieldCheck, label: 'Согласие на обработку ПД', sub: '152-ФЗ' },
    { key: 'about', icon: Info, label: 'О приложении', sub: `Версия ${APP_VERSION}` },
  ];

  return (
    <PageShell title="Настройки" kicker="Параметры">
      <div className="space-y-2.5">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => setSection(it.key)}
            className="w-full flex items-center gap-4 rounded-2xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 px-5 py-4 hover:border-[#4ec9c0]/45 active:scale-[0.99] transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl border border-[#4ec9c0]/35 bg-[#03161c]/55 flex items-center justify-center text-[#4ec9c0] shrink-0">
              <it.icon className="w-4.5 h-4.5" strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display-cyrl text-[15px] font-semibold text-[#d8f0ee]">
                {it.label}
              </p>
              <p className="text-[12px] text-[#7aa8a4] mt-0.5 truncate">{it.sub}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#4ec9c0]/55" strokeWidth={1.6} />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {section && (
          <motion.div
            key="settings-detail"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[80] bg-[#03161c] flex flex-col"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            }}
          >
            <div className="flex items-center gap-3 px-5 pb-4 border-b border-[#4ec9c0]/22">
              <button
                type="button"
                onClick={() => setSection(null)}
                aria-label="Назад"
                className="h-10 w-10 rounded-xl border border-[#4ec9c0]/35 bg-[#0a2f38]/45 flex items-center justify-center text-[#4ec9c0] active:scale-90 transition-transform"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
              </button>
              <h2 className="font-display-cyrl text-[18px] font-semibold text-[#d8f0ee]">
                {section === 'notifications' && 'Уведомления'}
                {section === 'terms' && 'Условия использования'}
                {section === 'privacy' && 'Согласие на обработку ПД'}
                {section === 'about' && 'О приложении'}
              </h2>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setSection(null)}
                aria-label="Закрыть"
                className="h-10 w-10 rounded-xl border border-[#4ec9c0]/22 flex items-center justify-center text-[#7aa8a4] active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {section === 'notifications' && <NotificationsPage />}
              {section === 'terms' && (
                <p className="text-[14px] text-[#d8f0ee]/85 leading-relaxed whitespace-pre-line">
                  {TERMS_TEXT}
                </p>
              )}
              {section === 'privacy' && (
                <p className="text-[14px] text-[#d8f0ee]/85 leading-relaxed whitespace-pre-line">
                  {PRIVACY_TEXT}
                </p>
              )}
              {section === 'about' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#4ec9c0]/30 bg-[#0a2f38]/45 p-5 text-center">
                    <p className="font-display text-[24px] font-semibold text-[#d8f0ee]">TechForum 2026</p>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-[#4ec9c0] mt-1">
                      Версия {APP_VERSION} · build {APP_BUILD}
                    </p>
                  </div>
                  <p className="text-[13px] text-[#d8f0ee]/85 leading-relaxed">
                    Приложение TechForum 2026 — официальный гид по программе форума,
                    инструмент нетворкинга и личный кабинет участника.
                  </p>
                  <p className="text-[12px] text-[#7aa8a4] leading-relaxed">
                    Поддержка: support@techforum.ru<br />
                    Сайт: techforum.ru
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
