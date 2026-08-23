import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, ChevronRight, Sparkles, Clock3, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { TRACKS } from '../data';
import PageShell from '@/src/components/ui/PageShell';
import { resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import { fetchCachedJson } from '@/src/lib/cachedPublicApi';

// Спикер тянется из API (живой синк с сайта, с фото). Сессии — из статической
// программы (id спикеров сохранены → связка работает для программных спикеров).
interface ApiSpeaker {
  id: string;
  name: string;
  role: string;
  company: string;
  bio: string;
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

export default function SpeakerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [speaker, setSpeaker] = useState<ApiSpeaker | null>(null);
  const [speakerSessions, setSpeakerSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [speakerResult, sessionResult] = await Promise.all([fetchCachedJson<ApiSpeaker[]>('/speakers'), fetchCachedJson<any[]>('/sessions')]);
        if (!cancelled) {
          setSpeaker(Array.isArray(speakerResult.data) ? (speakerResult.data.find((s) => s.id === id) ?? null) : null);
          setSpeakerSessions(Array.isArray(sessionResult.data) ? sessionResult.data.filter((session: any) => session.speakerIds?.includes(id)) : []);
        }
      } catch {
        /* offline */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <PageShell kicker="Спикер" title="Загрузка…">
        <div className="mt-8 h-24 rounded-3xl border border-primary/20 bg-card animate-pulse" />
      </PageShell>
    );
  }

  if (!speaker) {
    return (
      <PageShell kicker="Ошибка" title="Спикер не найден">
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-foreground/40">Возможно, ссылка устарела.</p>
          <button
            type="button"
            onClick={() => navigate('/speakers')}
            className="min-h-11 rounded-xl px-4 text-[14px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            ← К списку спикеров
          </button>
        </div>
      </PageShell>
    );
  }

  const track = TRACKS.find((t) => t.id === speaker.trackId);
  const bioParagraphs = cleanField(speaker.bio).split('\n\n').filter(Boolean);
  const identity = [cleanField(speaker.role), cleanField(speaker.company)].filter(Boolean).join(' · ');

  return (
    <PageShell kicker={track?.name || 'Спикер'} title={speaker.name} subtitle={identity || undefined}>
      {/* Hero — фото (или инициал) + базовые факты */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="mb-6 flex flex-col items-start gap-4 rounded-3xl border border-primary/30 bg-gradient-to-br from-card to-card/50 p-5 min-[360px]:flex-row min-[360px]:items-center"
      >
        {speaker.avatarUrl ? (
          <img
            src={resolveAssetUrl(speaker.avatarUrl)}
            alt={speaker.name}
            className="h-24 w-24 shrink-0 rounded-2xl border border-primary/55 bg-background/80 object-cover shadow-[0_0_24px_rgba(255,51,153,0.18)] min-[360px]:h-20 min-[360px]:w-20"
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-primary/55 bg-background/80 font-display text-[32px] font-semibold text-primary shadow-[0_0_24px_rgba(255,51,153,0.18)] min-[360px]:h-20 min-[360px]:w-20">
            {speaker.avatarLetter}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          {track && (
            <p className="text-[14px] text-foreground/60">
              Трек:{' '}
              <span className="text-foreground" style={{ color: track.color }}>{track.name}</span>
            </p>
          )}
          <p className="text-[14px] text-foreground/60">
            {speakerSessions.length} {speakerSessions.length === 1 ? 'выступление' : 'выступления'} на форуме
          </p>
        </div>
      </motion.section>

      {/* Тема доклада на форуме — выделено */}
      {cleanTopic(speaker.topic) && (
        <section className="mb-7 rounded-3xl border border-primary/35 bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.8} />
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-primary/90">Тема на форуме</p>
          </div>
          <p className="font-display text-[19px] font-semibold leading-snug text-foreground">
            «{cleanTopic(speaker.topic)}»
          </p>
        </section>
      )}

      {/* Биография */}
      {bioParagraphs.length > 0 && <section className="mb-6">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-primary">Биография</h2>
        <div className="space-y-4 font-sans text-base leading-[1.65] text-foreground/85">
          {bioParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>}

      {/* Сессии этого спикера на форуме */}
      {speakerSessions.length > 0 && (
        <section className="mb-2">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-primary">
            <Calendar className="w-3.5 h-3.5" strokeWidth={1.8} />
            Выступления на форуме
          </h2>
          <div className="space-y-3">
            {speakerSessions.map((s) => {
              return (
                <Link
                  key={s.id}
                  to={`/schedule?session=${encodeURIComponent(s.id)}`}
                  className="block rounded-2xl border border-primary/25 bg-card p-4 transition-colors hover:border-primary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  <h3 className="font-display text-base font-semibold leading-snug text-foreground">{s.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-[13px] text-foreground/60">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-accent" strokeWidth={1.8} />
                      {s.day || ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3 h-3 text-accent" strokeWidth={1.8} />
                      {s.startTime}–{s.endTime}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-accent" strokeWidth={1.8} />
                      {s.location}
                    </span>
                  </div>
                  <div className="mt-3 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-primary">
                    Открыть в программе
                    <ChevronRight className="w-3 h-3" strokeWidth={1.8} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </PageShell>
  );
}
