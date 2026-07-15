import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, ChevronRight, Sparkles, Clock3, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { SESSIONS, TRACKS, getDayById } from '../data';
import PageShell from '@/src/components/ui/PageShell';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';

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

export default function SpeakerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [speaker, setSpeaker] = useState<ApiSpeaker | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(resolveApiUrl('/speakers'));
        if (r.ok && !cancelled) {
          const data = await r.json();
          setSpeaker(Array.isArray(data) ? (data.find((s: ApiSpeaker) => s.id === id) ?? null) : null);
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
            className="text-primary text-[12px] font-semibold uppercase tracking-widest hover:underline"
          >
            ← К списку спикеров
          </button>
        </div>
      </PageShell>
    );
  }

  const speakerSessions = SESSIONS.filter((s) => s.speakerIds.includes(speaker.id));
  const track = TRACKS.find((t) => t.id === speaker.trackId);
  const bioParagraphs = (speaker.bio || '').split('\n\n').filter(Boolean);

  return (
    <PageShell kicker={track?.name || 'Спикер'} title={speaker.name} subtitle={`${speaker.role} · ${speaker.company}`}>
      {/* Hero — фото (или инициал) + базовые факты */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="rounded-3xl border border-primary/30 bg-gradient-to-br from-card to-card/50 p-6 mb-6 flex items-center gap-5"
      >
        {speaker.avatarUrl ? (
          <img
            src={resolveAssetUrl(speaker.avatarUrl)}
            alt={speaker.name}
            className="w-20 h-20 rounded-2xl border border-primary/55 object-cover shrink-0 bg-background/80 shadow-[0_0_24px_rgba(255,51,153,0.25)]"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl border border-primary/55 bg-background/80 flex items-center justify-center text-primary font-display text-[32px] font-semibold shrink-0 shadow-[0_0_24px_rgba(255,51,153,0.25)]">
            {speaker.avatarLetter}
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          {track && (
            <p className="text-[12px] text-foreground/40">
              Трек:{' '}
              <span className="text-foreground" style={{ color: track.color }}>{track.name}</span>
            </p>
          )}
          <p className="text-[12px] text-foreground/40">
            {speakerSessions.length} {speakerSessions.length === 1 ? 'выступление' : 'выступления'} на форуме
          </p>
        </div>
      </motion.section>

      {/* Тема доклада на форуме — выделено */}
      {speaker.topic && (
        <section className="rounded-2xl border border-primary/35 bg-card p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.8} />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/85">Тема на форуме</p>
          </div>
          <p className="font-display text-[18px] font-semibold text-foreground leading-snug">
            «{speaker.topic}»
          </p>
        </section>
      )}

      {/* Биография */}
      <section className="mb-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary mb-3">Биография</h2>
        <div className="space-y-3 text-[14px] leading-relaxed text-foreground/85 font-sans">
          {bioParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* Сессии этого спикера на форуме */}
      {speakerSessions.length > 0 && (
        <section className="mb-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" strokeWidth={1.8} />
            Выступления на форуме
          </h2>
          <div className="space-y-3">
            {speakerSessions.map((s) => {
              const day = getDayById(s.dayId);
              return (
                <Link
                  key={s.id}
                  to="/schedule"
                  className="block rounded-2xl border border-primary/22 bg-card p-4 hover:border-primary/55 active:scale-[0.99] transition-all"
                >
                  <h3 className="font-display text-[15px] font-semibold text-foreground leading-tight">{s.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-foreground/40">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-accent" strokeWidth={1.8} />
                      {day?.label || ''} · {day?.weekday || ''}
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
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary uppercase tracking-widest">
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
