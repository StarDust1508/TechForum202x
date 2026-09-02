import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, Server } from 'lucide-react';
import { resolveApiUrl, authFetch } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';
import { readLastAuthDiagnostic } from '@/src/lib/authErrors';

type HealthState = {
  loading: boolean;
  ok: boolean;
  code: number | null;
  message: string;
};

export default function Diagnostics() {
  const lastAuthDiagnostic = readLastAuthDiagnostic();
  const [health, setHealth] = useState<HealthState>({
    loading: true,
    ok: false,
    code: null,
    message: 'Проверяем соединение с сервером...',
  });

  useEffect(() => {
    const run = async () => {
      try {
        const res = await authFetch(resolveApiUrl('/health'), { credentials: 'include' });
        const payload = await res.json().catch(() => ({}));
        setHealth({
          loading: false,
          ok: res.ok,
          code: res.status,
          message: typeof payload?.status === 'string' ? payload.status : 'no_status_field',
        });
      } catch {
        setHealth({
          loading: false,
          ok: false,
          code: null,
          message: 'Сеть недоступна',
        });
      }
    };

    void run();
  }, []);

  return (
    <div className="flex-1 min-h-full px-6 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="flex items-center gap-3">
        <BackButton />
        <h1
          className="font-display text-[28px] leading-none font-bold"
          style={{
            background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >Диагностика</h1>
      </header>

      <section className="rounded-3xl border border-border bg-foreground/[0.03] p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-border bg-foreground/5 flex items-center justify-center">
            <Server className="w-5 h-5 text-foreground/80" />
          </div>
          <div>
            <p className="text-sm text-foreground/60">Backend API</p>
            <p className="text-lg font-semibold text-foreground">{resolveApiUrl('/health')}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          {health.loading ? (
            <div className="flex items-center gap-2 text-foreground/80">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>Проверка...</span>
            </div>
          ) : health.ok ? (
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>Сервер доступен (HTTP {health.code})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-300">
              <CircleAlert className="w-4 h-4" />
              <span>Проблема соединения ({health.code ?? 'no_code'})</span>
            </div>
          )}
          <p className="mt-2 text-sm text-foreground/65">Статус: {health.message}</p>
        </div>
      </section>

      {lastAuthDiagnostic && (
        <section className="rounded-3xl border border-border bg-foreground/[0.03] p-5" aria-labelledby="auth-diagnostic-heading">
          <h2 id="auth-diagnostic-heading" className="text-base font-semibold text-foreground">Последняя ошибка входа</h2>
          <dl className="mt-3 space-y-2 text-sm text-foreground/65">
            <div><dt className="inline font-semibold text-foreground/80">Код: </dt><dd className="inline break-all">{lastAuthDiagnostic.code}</dd></div>
            <div><dt className="inline font-semibold text-foreground/80">Время: </dt><dd className="inline">{lastAuthDiagnostic.occurredAt}</dd></div>
            <div><dt className="inline font-semibold text-foreground/80">Техническая причина: </dt><dd className="inline break-words">{lastAuthDiagnostic.errorName}: {lastAuthDiagnostic.technicalMessage}</dd></div>
          </dl>
          <p className="mt-3 text-[12px] leading-relaxed text-foreground/50">Эти данные нужны только для диагностики и не содержат пароль.</p>
        </section>
      )}
    </div>
  );
}
