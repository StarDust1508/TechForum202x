import { useEffect, useState, type ComponentType } from 'react';
import { Activity, CheckCircle2, CircleAlert, Server, Wifi, Fingerprint, Database, Loader2, RefreshCw } from 'lucide-react';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { isBiometricAvailable, isBiometricEnabled } from '@/src/lib/biometric';
import PageShell from '@/src/components/ui/PageShell';

interface Probe {
  loading: boolean;
  ok: boolean;
  status: 'pending' | 'up' | 'down';
  latencyMs: number | null;
  detail: string;
}

const initialProbe: Probe = { loading: true, ok: false, status: 'pending', latencyMs: null, detail: '...' };

export default function Diagnostics() {
  const [health, setHealth] = useState<Probe>(initialProbe);
  const [bioState, setBioState] = useState<{ available: boolean | null; enabled: boolean }>({
    available: null,
    enabled: false,
  });
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Backend probe — измеряет latency, парсит payload {db: 'up'|'down'}.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setHealth((p) => ({ ...p, loading: true }));
      const t0 = Date.now();
      try {
        const res = await fetch(resolveApiUrl('/health'), { credentials: 'include' });
        const latency = Date.now() - t0;
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        const dbField = typeof payload?.db === 'string' ? payload.db : '?';
        setHealth({
          loading: false,
          ok: res.ok,
          status: res.ok ? 'up' : 'down',
          latencyMs: latency,
          detail: res.ok ? `db: ${dbField} · http ${res.status}` : `http ${res.status}`,
        });
      } catch (err) {
        if (cancelled) return;
        setHealth({
          loading: false,
          ok: false,
          status: 'down',
          latencyMs: null,
          detail: err instanceof Error ? err.message.slice(0, 80) : 'network_error',
        });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [refreshNonce]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const available = await isBiometricAvailable();
      if (cancelled) return;
      setBioState({ available, enabled: isBiometricEnabled() });
    })();
    return () => { cancelled = true; };
  }, []);

  const apiUrl = resolveApiUrl('/health');
  const latency = health.latencyMs;
  const latencyTone =
    latency == null ? 'text-[#7aa8a4]'
    : latency < 250 ? 'text-emerald-300'
    : latency < 800 ? 'text-amber-300'
    : 'text-rose-300';

  return (
    <PageShell
      kicker="System"
      title="Диагностика"
      subtitle="Проверка соединения с backend и состояния устройства."
      headerAction={
        <button
          type="button"
          onClick={() => setRefreshNonce((n) => n + 1)}
          aria-label="Обновить"
          className="h-10 w-10 rounded-[12px] border border-[#4ec9c0]/35 bg-[#03161c]/60 text-[#4ec9c0] flex items-center justify-center hover:border-[#4ec9c0]/60 active:scale-90 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${health.loading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
        </button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl border border-[#4ec9c0]/28 bg-[#03161c]/40 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5 text-[#4ec9c0]" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#7aa8a4] font-semibold">Backend API</p>
              <p className="text-[13px] text-[#d8f0ee] mt-0.5 break-all">{apiUrl}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#4ec9c0]/20 bg-[#03161c]/55 p-4 space-y-2">
            {health.loading ? (
              <div className="flex items-center gap-2 text-[#d8f0ee]/80">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[13px]">Проверка…</span>
              </div>
            ) : health.ok ? (
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                <span className="text-[13px] font-semibold">Сервер доступен</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-300">
                <CircleAlert className="w-4 h-4" strokeWidth={2} />
                <span className="text-[13px] font-semibold">Нет связи</span>
              </div>
            )}
            <div className="flex justify-between text-[12px] font-mono">
              <span className="text-[#7aa8a4]">latency</span>
              <span className={latencyTone}>{latency == null ? '—' : `${latency} ms`}</span>
            </div>
            <div className="flex justify-between text-[12px] font-mono gap-3">
              <span className="text-[#7aa8a4] shrink-0">detail</span>
              <span className="text-[#d8f0ee]/85 truncate text-right">{health.detail}</span>
            </div>
          </div>
        </div>

        <DiagRow
          icon={Wifi}
          label="Сеть устройства"
          value={online ? 'Online' : 'Offline'}
          tone={online ? 'good' : 'bad'}
        />

        <DiagRow
          icon={Database}
          label="База данных"
          value={health.loading ? '…' : (health.detail.includes('db: up') ? 'up' : (health.detail.includes('db: down') ? 'down' : 'unknown'))}
          tone={health.detail.includes('db: up') ? 'good' : health.detail.includes('db: down') ? 'bad' : 'neutral'}
        />

        <DiagRow
          icon={Fingerprint}
          label="Биометрия"
          value={
            bioState.available === null ? '…'
            : !bioState.available ? 'Недоступна на устройстве'
            : bioState.enabled ? 'Включена'
            : 'Доступна, не включена'
          }
          tone={bioState.available && bioState.enabled ? 'good' : bioState.available ? 'neutral' : 'bad'}
        />

        <DiagRow
          icon={Activity}
          label="Сборка"
          value={`${import.meta.env.MODE} · ${import.meta.env.DEV ? 'dev' : 'production'}`}
          tone="neutral"
        />
      </div>
    </PageShell>
  );
}

function DiagRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'neutral';
}) {
  const valueClass =
    tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-[#d8f0ee]/85';
  return (
    <div className="rounded-[14px] border border-[#4ec9c0]/22 bg-[#03161c]/40 p-4 flex items-center gap-3">
      <Icon className="w-4 h-4 text-[#4ec9c0] shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#7aa8a4] font-semibold">{label}</p>
        <p className={`text-[14px] ${valueClass} mt-0.5 truncate`}>{value}</p>
      </div>
    </div>
  );
}
