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
  Bell, FileText, ShieldCheck, Info, ChevronRight, X, ArrowLeft, Loader2, EyeOff, Send, Moon, Sun, Trash2,
} from 'lucide-react';
import PageShell from '@/src/components/ui/PageShell';
import BrandLogo from '@/src/components/BrandLogo';
import { hapticSelection } from '@/src/lib/haptics';
import { getPushNotificationState, registerPushNotifications, unregisterPushNotifications } from '@/src/lib/push';
import { resolveApiUrl, authFetch } from '@/src/lib/runtimeEndpoint';
import { getTheme, setTheme, type Theme } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';

type Section = 'notifications' | 'telegram' | 'terms' | 'privacy' | 'about' | 'account';

const TERMS_TEXT = `Используя приложение ТехнологИИ Права 2026, вы соглашаетесь с правилами форума и политикой конфиденциальности.

Приложение разработано для участников конференции и предоставляется для удобства навигации по программе, общения с другими участниками и получения уведомлений от организатора.

Запрещено: спам, оскорбления других участников, использование чужих учётных записей, попытки получить несанкционированный доступ к чужим данным или серверу.

При обнаружении нарушений организатор оставляет за собой право заблокировать аккаунт без возврата стоимости билета.

Все материалы (доклады, фото, видео) защищены авторским правом и не могут быть опубликованы вне приложения без разрешения авторов и организатора.

Полную версию пользовательского соглашения см. на сайте tech-pravo.ru.`;

const PRIVACY_TEXT = `Согласно ФЗ-152 «О персональных данных», вы даёте согласие на обработку следующих данных:
— ФИО, контактный email, телефон;
— фото профиля (если загружено);
— ваша активность в приложении (регистрации на сессии и переписка с другими участниками);
— технические данные устройства (модель, ОС, IP-адрес) — для диагностики и защиты от злоупотреблений.

Цели обработки: предоставление функционала приложения, отправка уведомлений о форуме, статистика для организатора (анонимизированная).

Срок хранения: пока действует аккаунт. При удалении аккаунта связанные персональные данные и пользовательский контент удаляются; обязательные технические записи могут сохраняться только в пределах сроков, установленных законом.

Передача третьим лицам: только организатору форума и его техническому подрядчику. Не передаётся партнёрам или рекламным сетям.

Вы можете в любой момент:
— скачать копию своих данных (запрос через info@tech-pravo.ru);
— удалить аккаунт через профиль (необратимо).

Полная политика конфиденциальности доступна на сайте tech-pravo.ru/privacy.`;

const APP_VERSION = '1.8.6';
const APP_BUILD = (import.meta.env.VITE_BUILD_SHORT_SHA as string | undefined) ?? 'dev';

function NotificationsPage() {
  // Round 5: переключатель реально регистрирует/удаляет push-токен на бэке.
  // Round 7: + privacy-toggle «Скрывать предпросмотр» — body push'а становится
  // generic «Новое сообщение» вместо реального текста (lock-screen не светит).
  const NOTIF_LS_KEY = 'techforum_notifications_enabled';
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [previewHidden, setPreviewHidden] = useState<boolean>(false);
  const [previewBusy, setPreviewBusy] = useState(false);

  // Подгружаем фактическое разрешение ОС + регистрацию устройства в БД.
  // localStorage больше не является источником истины для положения тумблера.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await getPushNotificationState();
        if (!cancelled) {
          setAvailable(state.available);
          setEnabled(state.enabled);
          try { localStorage.setItem(NOTIF_LS_KEY, state.enabled ? '1' : '0'); } catch { /* noop */ }
          if (state.reason === 'service_not_configured') setHint('Уведомления пока недоступны. Когда доставка будет готова, переключатель станет активным автоматически.');
          else if (state.reason === 'permission_denied') setHint('Уведомления запрещены в настройках телефона. Разрешите их для TechPravo и вернитесь сюда.');
          else if (state.reason === 'check_failed') setHint('Не удалось проверить push-сервис. Проверьте соединение и откройте экран повторно.');
        }
        const r = await authFetch(resolveApiUrl('/auth/me'), { credentials: 'include' });
        if (r.ok) {
          const me = await r.json();
          if (!cancelled) setPreviewHidden(!!me.pushPreviewHidden);
        }
      } catch { /* offline */ }
      finally { if (!cancelled) setBusy(false); }
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
      const r = await authFetch(resolveApiUrl('/auth/me'), {
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
    if (busy || !available) return;
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
        const state = await getPushNotificationState();
        setAvailable(state.available);
        setHint(state.reason === 'permission_denied'
          ? 'Уведомления запрещены в настройках телефона. Разрешите их для TechPravo и вернитесь сюда.'
          : 'Устройство не удалось зарегистрировать для push. Проверьте соединение и попробуйте ещё раз.');
      }
    } else {
      // OFF: unregister
      const removed = await unregisterPushNotifications();
      if (removed) {
        setEnabled(false);
        try { localStorage.setItem(NOTIF_LS_KEY, '0'); } catch { /* noop */ }
        setHint('Подписка отключена. Push-уведомления приходить не будут.');
      } else {
        setHint('Не удалось отключить подписку на сервере. Проверьте соединение и попробуйте ещё раз.');
      }
    }
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || !available}
        aria-pressed={enabled}
        className="flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-foreground/[0.06] px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-70"
      >
        <div className="text-left">
          <p className="font-display text-[15px] font-semibold text-foreground">
            Push-уведомления
          </p>
          <p className="mt-1 text-[14px] text-foreground/60">
            Анонсы сессий, ответы на сообщения
          </p>
        </div>
        {busy ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" strokeWidth={1.8} />
        ) : (
          <span
            className={`relative w-11 h-6 rounded-full transition-colors ${
              enabled ? 'bg-primary' : 'bg-foreground/[0.06] border border-primary/30'
            }`}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className={`absolute top-0.5 w-5 h-5 rounded-full ${
                enabled ? 'left-[22px] bg-background' : 'left-0.5 bg-primary'
              }`}
            />
          </span>
        )}
      </button>
      {hint && (
        <p aria-live="polite" className="px-5 text-[14px] leading-relaxed text-foreground/65">
          {hint}
        </p>
      )}
      {!hint && (
        <p className="px-5 text-[14px] leading-relaxed text-foreground/65">
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
          aria-pressed={previewHidden}
          className="mt-4 flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-primary/22 bg-card px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-70"
        >
          <div className="flex items-start gap-3 text-left flex-1 min-w-0">
            <EyeOff className="w-4 h-4 mt-0.5 text-primary shrink-0" strokeWidth={1.6} />
            <div>
              <p className="font-display text-[14px] font-semibold text-foreground">
                Скрывать предпросмотр
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-foreground/60">
                Текст сообщения не будет виден на заблокированном экране — только «Новое сообщение».
              </p>
            </div>
          </div>
          {previewBusy ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" strokeWidth={1.8} />
          ) : (
            <span
              className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${
                previewHidden ? 'bg-primary' : 'bg-foreground/[0.06] border border-primary/30'
              }`}
              style={{ height: 22, width: 40 }}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className={`absolute top-0.5 w-4 h-4 rounded-full ${
                  previewHidden ? 'left-[20px] bg-background' : 'left-0.5 bg-primary'
                }`}
              />
            </span>
          )}
        </button>
      )}
    </div>
  );
}

// Привязка Telegram для безопасного сброса пароля. Владелец под своей сессией
// получает одноразовую ссылку → открывает @NeuroPravo_Bot → бот вяжет chat_id к
// аккаунту. При сбросе код приходит ТОЛЬКО в этот привязанный чат (см. Auth.tsx +
// server.ts forgot-password).
function TelegramLinkPage() {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    try {
      const r = await authFetch(resolveApiUrl('/auth/me'), { credentials: 'include' });
      if (r.ok) {
        const u = await r.json();
        setLinked(!!u.telegramLinked);
        setUsername(u.telegramUsername ?? null);
      }
    } catch {
      /* offline — оставляем текущее состояние */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);
  // Юзер уходит в Telegram привязывать и возвращается — перечитываем статус.
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  async function startLink(): Promise<void> {
    setBusy(true); setError(null); setManualLink(null);
    try {
      const r = await authFetch(resolveApiUrl('/me/telegram/link-token'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!r.ok) {
        setError(r.status === 503
          ? 'Привязка временно недоступна. Попробуйте позже.'
          : 'Не удалось создать ссылку. Попробуйте позже.');
        return;
      }
      const data = await r.json();
      const link = String(data?.deepLink || '');
      if (!link) { setError('Не удалось создать ссылку. Попробуйте позже.'); return; }
      const w = window.open(link, '_blank', 'noopener,noreferrer');
      if (!w) setManualLink(link); // всплывашка заблокирована — показываем ссылку вручную
    } catch {
      setError('Нет соединения с сервером');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(): Promise<void> {
    setBusy(true); setError(null);
    try {
      const r = await authFetch(resolveApiUrl('/me/telegram/unlink'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (r.ok) { setLinked(false); setUsername(null); }
      else setError('Не удалось отвязать. Попробуйте позже.');
    } catch {
      setError('Нет соединения с сервером');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/25 bg-foreground/[0.04] p-5">
        <p className="text-[14px] text-foreground/85 leading-relaxed">
          Привязка нужна для <b>безопасного сброса пароля</b>: если забудете пароль, код придёт
          в бота <span className="text-accent font-semibold">@NeuroPravo_Bot</span> — только в ваш
          привязанный аккаунт, никто другой его не получит.
        </p>
      </div>

      {linked ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-emerald-400/40 bg-background/40 flex items-center justify-center text-emerald-300 shrink-0">
              <Send className="w-[18px] h-[18px]" strokeWidth={1.7} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold text-foreground">Telegram привязан</p>
              <p className="text-[12px] text-foreground/50 mt-0.5 truncate">
                {username ? `@${username}` : 'Аккаунт привязан'}
              </p>
            </div>
          </div>
          {error && <p className="text-[13px] font-semibold text-rose-300 text-center">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={unlink}
            className="w-full border border-rose-400/40 text-rose-300 py-3.5 rounded-2xl text-[14px] font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Отвязать Telegram'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-[13px] font-semibold text-rose-300 text-center">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={startLink}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 shadow-[0_8px_28px_rgba(255,51,153,0.2)]"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : (<><Send className="w-4 h-4" strokeWidth={1.9} /> Привязать Telegram</>)}
          </button>
          {manualLink && (
            <a
              href={manualLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[13px] text-accent underline"
            >
              Открыть @NeuroPravo_Bot вручную
            </a>
          )}
          <p className="text-[12px] text-foreground/45 text-center leading-relaxed">
            Откроется бот в Telegram — нажмите «Start». Вернитесь сюда, статус обновится сам.
          </p>
        </div>
      )}
    </div>
  );
}

function AccountPage() {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (!confirmed || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await authFetch(resolveApiUrl('/auth/me'), {
        method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });
      if (!r.ok) throw new Error(`delete_failed_${r.status}`);
      localStorage.clear(); sessionStorage.clear(); window.location.reload();
    } catch { setError('Не удалось удалить аккаунт. Проверьте соединение и попробуйте ещё раз.'); setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="rounded-2xl border border-rose-400/30 bg-rose-400/[0.06] p-5"><h3 className="font-display text-[16px] font-semibold text-rose-300">Удаление необратимо</h3><p className="mt-2 text-[13px] leading-relaxed text-foreground/65">Будут удалены профиль, контакты, регистрации на сессии, сообщения и загруженные данные, кроме сведений, которые организатор обязан сохранять по закону.</p></div>
    <label className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-rose-400" /><span className="text-[13px] leading-relaxed text-foreground/75">Я понимаю последствия и хочу полностью удалить аккаунт.</span></label>
    {error && <p className="text-[12px] text-rose-300">{error}</p>}
    <button type="button" disabled={!confirmed || busy} onClick={() => void remove()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/45 py-4 text-[14px] font-bold text-rose-300 disabled:opacity-35">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}Удалить аккаунт</button>
  </div>;
}

export default function Settings() {
  const [section, setSectionRaw] = useState<Section | null>(null);
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const changeTheme = (t: Theme) => { setTheme(t); setThemeState(t); void hapticSelection(); };

  // Integrate with browser history so swipe-back closes the sub-section
  // instead of navigating away from Settings entirely
  const setSection = (next: Section | null) => {
    if (next && !section) {
      // Opening a sub-section: push a dummy history entry
      window.history.pushState({ settingsSection: next }, '');
    } else if (!next && section) {
      // Closing via UI button — go back to pop the dummy entry we pushed
      // (but only if the dummy entry is the current state)
      if (window.history.state?.settingsSection) {
        window.history.back();
        // The popstate handler will set section=null
        return;
      }
    }
    setSectionRaw(next);
  };

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      // If we're leaving a settings sub-section, just close it
      if (section) {
        setSectionRaw(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [section]);

  const items: Array<{ key: Section; icon: typeof Bell; label: string; sub: string }> = [
    { key: 'notifications', icon: Bell, label: 'Уведомления', sub: 'Push, анонсы сессий' },
    { key: 'telegram', icon: Send, label: 'Привязка Telegram', sub: 'Для безопасного сброса пароля' },
    { key: 'terms', icon: FileText, label: 'Условия использования', sub: 'Правила форума' },
    { key: 'privacy', icon: ShieldCheck, label: 'Согласие на обработку ПД', sub: '152-ФЗ' },
    { key: 'account', icon: Trash2, label: 'Управление аккаунтом', sub: 'Полное удаление данных' },
    { key: 'about', icon: Info, label: 'О приложении', sub: `Версия ${APP_VERSION}` },
  ];

  return (
    <PageShell title="Настройки">
      {/* Тема оформления — тёмная (бренд) / светлая */}
      <div className="mb-4 rounded-2xl border border-primary/22 bg-card p-4">
        <p className="font-display text-[14px] font-semibold text-foreground mb-3">Тема оформления</p>
        <div className="flex gap-2">
          {([['dark', 'Тёмная', Moon], ['light', 'Светлая', Sun]] as const).map(([val, label, Icon]) => (
            <button
              key={val}
              type="button"
              onClick={() => changeTheme(val)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold border transition-all active:scale-[0.98]',
                theme === val
                  ? 'bg-primary/15 border-primary/45 text-primary'
                  : 'bg-background/40 border-border text-foreground/55 hover:text-foreground/80',
              )}
            >
              <Icon className="w-4 h-4" strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((it, idx) => (
          <motion.button
            key={it.key}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.06, ease: [0.32, 0.72, 0, 1] }}
            onClick={() => setSection(it.key)}
            className="w-full flex items-center gap-4 rounded-2xl border border-primary/22 bg-card px-5 py-4 hover:border-primary/45 active:scale-[0.99] transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl border border-primary/35 bg-background/55 flex items-center justify-center text-primary shrink-0">
              <it.icon className="w-4.5 h-4.5" strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-[15px] font-semibold text-foreground">
                {it.label}
              </p>
              <p className="text-[12px] text-foreground/40 mt-0.5 truncate">{it.sub}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-primary/55" strokeWidth={1.6} />
          </motion.button>
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
            className="fixed inset-0 z-[80] bg-background flex flex-col"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            }}
          >
            <div className="flex items-center gap-3 px-5 pb-4 border-b border-primary/22">
              <button
                type="button"
                onClick={() => setSection(null)}
                aria-label="Назад"
                className="h-10 w-10 rounded-xl border border-primary/35 bg-foreground/[0.06] flex items-center justify-center text-primary active:scale-90 transition-transform"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
              </button>
              <h2 className="font-display text-[18px] font-semibold text-foreground">
                {section === 'notifications' && 'Уведомления'}
                {section === 'telegram' && 'Привязка Telegram'}
                {section === 'terms' && 'Условия использования'}
                {section === 'privacy' && 'Согласие на обработку ПД'}
                {section === 'about' && 'О приложении'}
                {section === 'account' && 'Управление аккаунтом'}
              </h2>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setSection(null)}
                aria-label="Закрыть"
                className="h-10 w-10 rounded-xl border border-primary/22 flex items-center justify-center text-foreground/40 active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {section === 'notifications' && <NotificationsPage />}
              {section === 'telegram' && <TelegramLinkPage />}
              {section === 'terms' && (
                <p className="text-[14px] text-foreground/85 leading-relaxed whitespace-pre-line">
                  {TERMS_TEXT}
                </p>
              )}
              {section === 'privacy' && (
                <p className="text-[14px] text-foreground/85 leading-relaxed whitespace-pre-line">
                  {PRIVACY_TEXT}
                </p>
              )}
              {section === 'account' && <AccountPage />}
              {section === 'about' && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-primary/30 bg-foreground/[0.06] p-5 text-center">
                    <p className="text-[17px]"><BrandLogo /></p>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-primary mt-1">
                      Версия {APP_VERSION} · build {APP_BUILD}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <h3 className="font-display text-[17px] font-bold text-foreground">Весь форум — в одном маршруте</h3>
                    <p className="text-[13px] text-foreground/75 leading-relaxed">ТехнологИИ Права объединяет юристов, предпринимателей и технологические команды, которые внедряют ИИ в реальную практику.</p>
                    <ul className="space-y-2 text-[12px] leading-relaxed text-foreground/60">
                      <li>• актуальная программа двух дней и личный план;</li>
                      <li>• проверенные профили спикеров и темы выступлений;</li>
                      <li>• электронный билет, навигация и новости форума;</li>
                      <li>• нетворкинг и общение участников.</li>
                    </ul>
                  </div>
                  <p className="text-[12px] text-foreground/50 leading-relaxed">Организатор — команда «ТехнологИИ Права». Москва, 25–26 сентября 2026 года, БЦ «Красные Ворота».</p>
                  <p className="text-[12px] text-foreground/40 leading-relaxed">
                    Поддержка: info@tech-pravo.ru<br />
                    Telegram: @CEO_WYRM1 · @TechPravoAI<br />
                    Сайт: tech-pravo.ru
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
