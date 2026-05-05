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
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';

interface PublicUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
  bio: string;
}

const isUploadedAvatar = (url: string | null | undefined): boolean =>
  typeof url === 'string' && url.startsWith('/uploads/');

export default function Attendees() {
  const navigate = useNavigate();
  const [list, setList] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Debounced fetch — 300ms после последнего изменения query.
  useEffect(() => {
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const url = search.trim()
          ? resolveApiUrl(`/users/list?q=${encodeURIComponent(search.trim())}`)
          : resolveApiUrl('/users/list');
        const r = await fetch(url, { credentials: 'include' });
        if (r.ok) {
          const data: PublicUser[] = await r.json();
          setList(data);
        }
      } catch { /* offline */ } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  return (
    <PageShell
      kicker="Нетворкинг"
      title="Участники"
      subtitle={loading ? undefined : `${list.length} ${list.length === 1 ? 'участник' : list.length < 5 ? 'участника' : 'участников'} на форуме`}
    >
      <div className="relative mb-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#4ec9c0]/65"
          strokeWidth={1.6}
        />
        <input
          type="text"
          placeholder="Имя, роль, компания…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
          className="w-full rounded-[14px] border border-[#4ec9c0]/30 bg-[#03161c]/40 py-3.5 pl-12 pr-12 text-[15px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/65 outline-none focus:border-[#4ec9c0]/70 focus:bg-[#0a2f38]/55 transition-colors font-blueprint"
        />
        {search && (
          <button
            type="button"
            aria-label="Очистить"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[#7aa8a4] hover:text-[#d8f0ee]"
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {loading && list.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 bg-[#0a2f38]/40 border border-[#4ec9c0]/22 p-3.5 rounded-2xl">
              <Skeleton className="rounded-full" width={48} height={48} />
              <div className="flex-1 space-y-2">
                <Skeleton height={13} width="55%" />
                <Skeleton height={10} width="75%" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#4ec9c0]/25 bg-[#0a2f38]/30 p-8 text-center">
          <UsersIcon className="w-9 h-9 mx-auto text-[#4ec9c0]/60" strokeWidth={1.4} />
          <p className="mt-3 text-[#d8f0ee]/75">
            {search ? `По запросу «${search}» никого не нашли.` : 'Пока никого нет.'}
          </p>
          {!search && (
            <p className="mt-1 text-[12px] text-[#7aa8a4]">
              Поделитесь приложением с коллегами — приходите вместе.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        {list.map((u, idx) => {
          const avatarSrc = isUploadedAvatar(u.avatar) ? resolveAssetUrl(u.avatar) : (u.avatar || null);
          return (
            <motion.article
              key={u.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(idx * 0.025, 0.3) }}
              className="flex items-center gap-3 rounded-2xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-3.5 hover:border-[#4ec9c0]/45 transition-colors"
            >
              <button
                type="button"
                onClick={() => navigate(`/users/${u.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
              >
                <div className="relative w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-[#0a2f38] border border-[#4ec9c0]/35 shrink-0">
                  <AvatarImage src={avatarSrc} name={u.name} className="h-full w-full" letterClassName="text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display-cyrl text-[14px] font-semibold text-[#d8f0ee] truncate">{u.name}</p>
                  <p className="text-[11px] text-[#7aa8a4] truncate">{u.role || 'Участник'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#4ec9c0]/60 shrink-0" strokeWidth={1.6} />
              </button>
              <button
                type="button"
                onClick={() => navigate(`/chat/${u.id}`)}
                aria-label={`Написать ${u.name}`}
                className="h-9 w-9 rounded-xl border border-[#4ec9c0]/35 bg-[#03161c]/60 flex items-center justify-center text-[#4ec9c0] active:scale-90 hover:border-[#4ec9c0]/60 transition-all shrink-0"
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
