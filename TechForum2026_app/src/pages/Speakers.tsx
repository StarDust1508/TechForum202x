import { Search, ChevronRight, RefreshCw, Users } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/src/components/BackButton';
import { resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import { fetchCachedJson, readCachedPublicJson } from '@/src/lib/cachedPublicApi';

// Спикеры тянутся из API (GET /speakers), который живым синком отражает
// опубликованных спикеров сайта — с фото. Новые спикеры появляются сами,
// без пересборки приложения.
interface ApiSpeaker {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarLetter: string;
  avatarUrl?: string | null;
  topic?: string | null;
  trackId: string;
}

const cleanField = (value?: string | null) => {
  const normalized = (value || '').trim();
  return normalized && normalized !== '—' && normalized !== '-' ? normalized : '';
};
const cleanTopic = (value?: string | null) => cleanField(value)
  .replace(/^«|»$/g, '')
  .replace(/^тема\s*:\s*/i, '')
  .trim();

export default function Speakers() {
  const initialSpeakers = useMemo(() => readCachedPublicJson<ApiSpeaker[]>('/speakers') || [], []);
  const [search, setSearch] = useState(() => {
    try { return sessionStorage.getItem('tp_speakers_search') || ''; } catch { return ''; }
  });
  const [speakers, setSpeakers] = useState<ApiSpeaker[]>(initialSpeakers);
  const [loading, setLoading] = useState(initialSpeakers.length === 0);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchCachedJson<ApiSpeaker[]>('/speakers');
        if (!cancelled && Array.isArray(result.data)) setSpeakers(result.data);
      } catch {
        if (!cancelled) setError('Не удалось загрузить список спикеров.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem('tp_speakers_search', search); } catch { /* noop */ }
  }, [search]);

  // Возврат из карточки восстанавливает ровно тот фрагмент списка, который
  // пользователь только что смотрел. На обычном новом входе список начинается
  // сверху, поэтому старое положение не «прилипает» навсегда.
  useEffect(() => {
    if (loading) return;
    let shouldRestore = false;
    let savedTop = 0;
    let selectedSpeakerId = '';
    try {
      shouldRestore = sessionStorage.getItem('tp_speakers_restore') === '1';
      savedTop = Number(sessionStorage.getItem('tp_speakers_scroll') || '0');
      selectedSpeakerId = sessionStorage.getItem('tp_speakers_selected') || '';
    } catch { /* noop */ }
    if (!shouldRestore || !Number.isFinite(savedTop)) return;
    let restoreTimer = 0;
    const frame = requestAnimationFrame(() => {
      restoreTimer = window.setTimeout(() => {
        try { sessionStorage.removeItem('tp_speakers_restore'); } catch { /* noop */ }
        const selectedCard = selectedSpeakerId
          ? document.getElementById(`speaker-card-${selectedSpeakerId}`)
          : null;
        if (selectedCard) {
          selectedCard.scrollIntoView({ block: 'center', behavior: 'auto' });
          selectedCard.focus({ preventScroll: true });
          return;
        }
        const scroller = document.querySelector<HTMLElement>('[data-app-scroll-container]');
        if (scroller) scroller.scrollTop = savedTop;
      }, 340);
    });
    return () => { cancelAnimationFrame(frame); window.clearTimeout(restoreTimer); };
  }, [loading]);

  const openSpeaker = (speakerId: string) => {
    const scroller = document.querySelector<HTMLElement>('[data-app-scroll-container]');
    try {
      sessionStorage.setItem('tp_speakers_scroll', String(scroller?.scrollTop || 0));
      sessionStorage.setItem('tp_speakers_selected', speakerId);
      sessionStorage.setItem('tp_speakers_restore', '1');
    } catch { /* noop */ }
    navigate(`/speakers/${speakerId}`);
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredSpeakers = speakers.filter((speaker) => [speaker.name, speaker.role, speaker.company, speaker.topic]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(normalizedSearch));

  return (
    <div className="relative mx-auto flex-1 w-full max-w-[44rem] space-y-5 px-4 min-[360px]:px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="sticky top-0 z-20 -mx-4 space-y-4 border-b border-border bg-background/95 px-4 pb-4 pt-1 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1
              className="font-display text-[clamp(25px,7vw,30px)] font-bold leading-none"
              style={{
                background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >Спикеры</h1>
          </div>
          <p className="ml-[52px] text-[14px] text-foreground/60">{speakers.length} {speakers.length === 1 ? 'эксперт' : 'экспертов'} в программе</p>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Имя, компания или тема"
            aria-label="Поиск спикеров"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-12 w-full rounded-2xl border border-border bg-card py-3 pl-11 pr-4 text-base font-medium text-foreground/90 placeholder:text-foreground/45 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </header>

      {loading && (
        <div className="grid gap-3" aria-label="Загружаем спикеров">
          {[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-3xl border border-border bg-card" />)}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-primary/25 bg-card p-6 text-center">
          <p className="text-base text-foreground/70">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
            <RefreshCw className="h-4 w-4" /> Повторить
          </button>
        </div>
      )}

      {!loading && !error && <div className="space-y-3">
        {filteredSpeakers.map((speaker) => (
          <button
            key={speaker.id}
            id={`speaker-card-${speaker.id}`}
            type="button"
            onClick={() => openSpeaker(speaker.id)}
            className="block h-[252px] w-full overflow-hidden rounded-3xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 min-[380px]:p-5"
          >
            <div className="flex gap-4">
              {speaker.avatarUrl ? (
                <img
                  src={resolveAssetUrl(speaker.avatarUrl)}
                  alt={speaker.name}
                  loading="lazy"
                  className="h-[72px] w-[72px] shrink-0 rounded-2xl border border-primary/25 bg-background object-cover"
                />
              ) : (
                <div
                  className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl border border-primary/25 text-[22px] font-bold text-primary"
                  style={{ background: 'linear-gradient(135deg, rgba(255,51,153,0.18) 0%, rgba(0,255,255,0.08) 100%)' }}
                >
                  {speaker.avatarLetter}
                </div>
              )}
              {/* Иерархия: имя (крупно, переносится) → роль (приглушённо) → компания (акцент) */}
              <div className="flex-1 min-w-0 self-center">
                <h3 className="line-clamp-2 text-[18px] font-bold leading-snug text-foreground [overflow-wrap:anywhere]">{speaker.name}</h3>
                {cleanField(speaker.role) && <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-foreground/75">{cleanField(speaker.role)}</p>}
                {cleanField(speaker.company) && <p className="mt-1 line-clamp-1 text-[14px] font-semibold leading-snug text-primary/90">{cleanField(speaker.company)}</p>}
              </div>
              <ChevronRight className="w-5 h-5 text-foreground/25 shrink-0 self-center" />
            </div>

            {cleanTopic(speaker.topic) && (
              <div className="mt-4 border-l-2 border-accent/50 pl-3.5">
                <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.1em] text-accent/80">Тема доклада</p>
                <p className="line-clamp-3 text-[15px] leading-relaxed text-foreground/90">«{cleanTopic(speaker.topic)}»</p>
              </div>
            )}
          </button>
        ))}
      </div>}

      {!loading && !error && filteredSpeakers.length === 0 && (
        <div className="rounded-3xl border border-dashed border-primary/25 bg-card p-8 text-center">
          {search ? <Search className="mx-auto h-9 w-9 text-foreground/35" /> : <Users className="mx-auto h-9 w-9 text-foreground/35" />}
          <p className="mt-3 text-base font-medium text-foreground/65">{search ? 'Ничего не найдено' : 'Спикеры пока не опубликованы'}</p>
          <p className="mt-1 text-[14px] text-foreground/45">{search ? 'Проверьте написание или измените запрос.' : 'Список появится после подтверждения в программе.'}</p>
        </div>
      )}
    </div>
  );
}
