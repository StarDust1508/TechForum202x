// FILE: src/pages/Attendees.tsx
// Round 6: «Участники» — раздел из эталона Eventicious (которого у нас не было).
// Список юзеров с поиском (debounced) + тап → /users/:id профиль или /chat/:id DM.
// Endpoint /users/list (см. server.ts) — auth-only, не отдаёт private-юзеров.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, X, ChevronRight, Users as UsersIcon, MessageCircle } from 'lucide-react';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import AvatarImage from '@/src/components/ui/AvatarImage';
import { resolveApiUrl, resolveAssetUrl, authFetch } from '@/src/lib/runtimeEndpoint';

interface PublicUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
  bio: string;
  company?: string;
}

const isUploadedAvatar = (url: string | null | undefined): boolean =>
  typeof url === 'string' && url.startsWith('/uploads/');

export default function Attendees() {
  const navigate = useNavigate();
  const [list, setList] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await authFetch(resolveApiUrl('/users/list'), { credentials: 'include' });
        if (r.ok && !cancelled) {
          const data: PublicUser[] = await r.json();
          setList(data);
        }
      } catch { /* offline */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = search.trim()
    ? list.filter(u => {
        const q = search.trim().toLowerCase();
        return u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || (u.company ?? '').toLowerCase().includes(q);
      })
    : list;

  return (
    <PageShell
      title="Участники"
      subtitle={loading ? undefined : `${list.length} ${list.length === 1 ? 'участник' : list.length < 5 ? 'участника' : 'участников'} зарегистрировано`}
    >
      <div className="relative mb-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-primary/65"
          strokeWidth={1.6}
        />
        <input
          type="text"
          placeholder="Имя, роль, компания…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
          className="w-full rounded-[14px] border border-primary/30 bg-card py-3.5 pl-12 pr-12 text-[15px] text-foreground placeholder:text-foreground/40 outline-none focus:border-primary/70 focus:bg-card transition-colors font-sans"
        />
        {search && (
          <button
            type="button"
            aria-label="Очистить"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-foreground/40 hover:text-foreground"
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {loading && list.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 bg-card border border-primary/22 p-3.5 rounded-2xl">
              <Skeleton className="rounded-full" width={48} height={48} />
              <div className="flex-1 space-y-2">
                <Skeleton height={13} width="55%" />
                <Skeleton height={10} width="75%" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-primary/25 bg-card p-8 text-center">
          <UsersIcon className="w-9 h-9 mx-auto text-primary/60" strokeWidth={1.4} />
          <p className="mt-3 text-foreground/75">
            {search ? `По запросу «${search}» никого не нашли.` : 'Пока никого нет.'}
          </p>
          {!search && (
            <p className="mt-1 text-[12px] text-foreground/40">
              Зарегистрируйтесь и поделитесь приложением с коллегами.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((u, idx) => {
          const avatarSrc = isUploadedAvatar(u.avatar) ? resolveAssetUrl(u.avatar) : (u.avatar || null);
          return (
            <motion.article
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(idx * 0.025, 0.3) }}
              className="flex items-center gap-3 rounded-2xl border border-primary/22 bg-card p-3.5 hover:border-primary/45 transition-colors"
            >
              <button
                type="button"
                onClick={() => navigate(`/users/${u.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
              >
                <div className="relative w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-card border border-primary/35 shrink-0">
                  <AvatarImage src={avatarSrc} name={u.name} className="h-full w-full" letterClassName="text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[14px] font-semibold text-foreground truncate">{u.name}</p>
                  <p className="text-[11px] text-foreground/40 truncate">{u.company ? `${u.role || 'Участник'} · ${u.company}` : (u.role || 'Участник')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-primary/60 shrink-0" strokeWidth={1.6} />
              </button>
              <button
                type="button"
                onClick={() => navigate(`/chat?dm=${u.id}`)}
                aria-label={`Написать ${u.name}`}
                className="h-9 w-9 rounded-xl border border-primary/35 bg-background/60 flex items-center justify-center text-primary active:scale-90 hover:border-primary/60 transition-all shrink-0"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </motion.article>
          );
        })}
      </div>
    </PageShell>
  );
}
