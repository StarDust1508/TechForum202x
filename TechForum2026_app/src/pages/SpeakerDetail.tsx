import { useParams, useNavigate, Link } from 'react-router-dom';
import { Award, Calendar, Mic2, ChevronRight, Briefcase, Sparkles, Clock3, MapPin } from 'lucide-react';
import { SPEAKERS, SESSIONS, TRACKS, getDayById } from '../data';
import PageShell from '@/src/components/ui/PageShell';

export default function SpeakerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const speaker = SPEAKERS.find((s) => s.id === id);

  if (!speaker) {
    return (
      <PageShell kicker="Ошибка" title="Спикер не найден">
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-[#7aa8a4]">Возможно, ссылка устарела.</p>
          <button
            type="button"
            onClick={() => navigate('/speakers')}
            className="text-[#4ec9c0] text-[12px] font-semibold uppercase tracking-widest hover:underline"
          >
            ← К списку спикеров
          </button>
        </div>
      </PageShell>
    );
  }

  // Сессии этого спикера
  const speakerSessions = SESSIONS.filter((s) => s.speakerIds.includes(speaker.id));
  const track = TRACKS.find((t) => t.id === speaker.trackId);
  const bioParagraphs = (speaker.extendedBio || speaker.bio || '').split('\n\n').filter(Boolean);

  return (
    <PageShell kicker={track?.name || 'Спикер'} title={speaker.name} subtitle={`${speaker.role} · ${speaker.company}`}>
      {/* Hero — большая HUD-плашка с инициалом + базовые факты */}
      <section className="rounded-3xl border border-[#4ec9c0]/30 bg-gradient-to-br from-[#0a2f38]/70 to-[#03161c]/40 p-6 mb-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl border border-[#4ec9c0]/55 bg-[#03161c]/80 flex items-center justify-center text-[#4ec9c0] font-display-cyrl text-[32px] font-semibold shrink-0 shadow-[0_0_24px_rgba(78,201,192,0.25)]">
          {speaker.avatarLetter}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          {typeof speaker.yearsExperience === 'number' && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#4ec9c0]/85">
              {speaker.yearsExperience}+ лет в индустрии
            </p>
          )}
          {track && (
            <p className="text-[12px] text-[#7aa8a4]">
              Трек:{' '}
              <span className="text-[#d8f0ee]" style={{ color: track.color }}>{track.name}</span>
            </p>
          )}
          <p className="text-[12px] text-[#7aa8a4]">
            {speakerSessions.length} {speakerSessions.length === 1 ? 'выступление' : 'выступления'} на форуме
          </p>
        </div>
      </section>

      {/* Тема доклада на форуме — выделено */}
      {speaker.topic && (
        <section className="rounded-2xl border border-[#4ec9c0]/35 bg-[#0a2f38]/55 p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#4ec9c0]" strokeWidth={1.8} />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4ec9c0]/85">Тема на форуме</p>
          </div>
          <p className="font-display-cyrl text-[18px] font-semibold text-[#d8f0ee] leading-snug">
            «{speaker.topic}»
          </p>
        </section>
      )}

      {/* Расширенная биография */}
      <section className="mb-6">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#4ec9c0] mb-3">Биография</h2>
        <div className="space-y-3 text-[14px] leading-relaxed text-[#d8f0ee]/85 font-blueprint">
          {bioParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* Достижения и регалии */}
      {speaker.achievements && speaker.achievements.length > 0 && (
        <section className="mb-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#4ec9c0] mb-3 flex items-center gap-2">
            <Award className="w-3.5 h-3.5" strokeWidth={1.8} />
            Регалии и достижения
          </h2>
          <ul className="space-y-2">
            {speaker.achievements.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-[#4ec9c0]/22 bg-[#0a2f38]/35 p-3"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#4ec9c0] shadow-[0_0_8px_rgba(78,201,192,0.7)] shrink-0" />
                <span className="text-[13px] text-[#d8f0ee]/85 leading-relaxed">{a}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Известные доклады / публикации */}
      {speaker.talks && speaker.talks.length > 0 && (
        <section className="mb-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#4ec9c0] mb-3 flex items-center gap-2">
            <Mic2 className="w-3.5 h-3.5" strokeWidth={1.8} />
            Известные доклады
          </h2>
          <ul className="space-y-2">
            {speaker.talks.map((t, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-[#4ec9c0]/15 bg-[#03161c]/40 p-3"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#4ec9c0]/85 mt-1 shrink-0" strokeWidth={1.6} />
                <span className="text-[12px] text-[#d8f0ee]/80 leading-relaxed italic">«{t}»</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Сессии этого спикера на форуме — переход в расписание */}
      {speakerSessions.length > 0 && (
        <section className="mb-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#4ec9c0] mb-3 flex items-center gap-2">
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
                  className="block rounded-2xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-4 hover:border-[#4ec9c0]/55 active:scale-[0.99] transition-all"
                >
                  <h3 className="font-display-cyrl text-[15px] font-semibold text-[#d8f0ee] leading-tight">{s.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#7aa8a4]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#4ec9c0]" strokeWidth={1.8} />
                      {day?.label || ''} · {day?.weekday || ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3 h-3 text-[#4ec9c0]" strokeWidth={1.8} />
                      {s.startTime}–{s.endTime}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#4ec9c0]" strokeWidth={1.8} />
                      {s.location}
                    </span>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#4ec9c0] uppercase tracking-widest">
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
