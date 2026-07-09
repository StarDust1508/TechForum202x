// FILE: src/pages/UserProfile.tsx
// Публичный профиль другого участника. Открывается из DM-room по тапу
// на аватар/имя в шапке. Сторонний юзер видит только: имя, роль, аватар,
// био. Email/phone скрыты сервером.

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2 } from 'lucide-react';
import { resolveApiUrl, resolveAssetUrl, authFetch } from '@/src/lib/runtimeEndpoint';
import PageShell from '@/src/components/ui/PageShell';
import AvatarImage from '@/src/components/ui/AvatarImage';

interface PublicProfile {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  bio: string | null;
}

export default function UserProfile() {
  const { id: userId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await authFetch(resolveApiUrl(`/users/${userId}`), { credentials: 'include' });
        if (!r.ok) {
          if (alive) setError(r.status === 404 ? 'Пользователь не найден' : 'Не удалось загрузить профиль');
          return;
        }
        const data: PublicProfile = await r.json();
        if (alive) setProfile(data);
      } catch {
        if (alive) setError('Нет соединения');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const avatarSrc = profile?.avatar ? resolveAssetUrl(profile.avatar) : null;

  return (
    <PageShell kicker="Профиль" title={profile?.name || 'Участник'}>
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={1.6} />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/[0.06] p-6 text-center">
          <p className="text-[14px] text-rose-200">{error}</p>
        </div>
      )}

      {profile && !loading && (
        <>
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-primary/45 bg-white/[0.06] shadow-[0_0_28px_rgba(255,51,153,0.25)]">
              <AvatarImage src={avatarSrc || undefined} name={profile.name} className="h-full w-full" letterClassName="text-4xl" />
            </div>
            <div className="text-center">
              <h2 className="font-display text-[22px] font-semibold text-foreground tracking-wide">{profile.name}</h2>
              {profile.role && (
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary/85 mt-1">{profile.role}</p>
              )}
            </div>
          </div>

          <section className="mt-7 rounded-3xl border border-primary/22 bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-2">О себе</p>
            {profile.bio
              ? <p className="text-[14px] text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">{profile.bio}</p>
              : <p className="text-[13px] text-foreground/40 italic">Участник пока не заполнил «О себе».</p>}
          </section>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => navigate(`/chat?dm=${userId}`)}
              className="w-full rounded-[14px] border border-primary/55 bg-white/[0.06] text-foreground py-4 text-[14px] font-display font-semibold uppercase tracking-[0.08em] flex items-center justify-center gap-2 hover:border-primary/80 active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(255,51,153,0.18)]"
            >
              <MessageCircle className="w-4 h-4 text-primary" strokeWidth={1.6} />
              Написать сообщение
            </button>
          </div>
        </>
      )}
    </PageShell>
  );
}
