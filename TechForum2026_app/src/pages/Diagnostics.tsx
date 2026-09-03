import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, Server } from 'lucide-react';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';

type HealthState = {
  loading: boolean;
  ok: boolean;
  code: number | null;
  message: string;
};

export default function Diagnostics() {
  const [health, setHealth] = useState<HealthState>({
    loading: true,
    ok: false,
    code: null,
    message: 'Проверяем соединение с сервером...',
  });

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(resolveApiUrl('/health'), { credentials: 'include' });
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
    <div className="flex-1 min-h-full px-6 pt-8 pb-10 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent/85 font-semibold">System</p>
        <h1 className="font-elite text-4xl leading-none text-white">Диагностика</h1>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
            <Server className="w-5 h-5 text-white/80" />
          </div>
          <div>
            <p className="text-sm text-white/60">Backend API</p>
            <p className="text-lg font-semibold text-white">{resolveApiUrl('/health')}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#140d26]/70 p-4">
          {health.loading ? (
            <div className="flex items-center gap-2 text-white/80">
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
          <p className="mt-2 text-sm text-white/65">Статус: {health.message}</p>
        </div>
      </section>
    </div>
  );
}
