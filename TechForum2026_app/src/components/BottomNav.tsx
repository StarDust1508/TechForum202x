import { NavLink } from 'react-router-dom';
import { Home, Calendar, LayoutGrid, MessageSquare, User } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function BottomNav() {
  const navItems = [
    { to: '/', icon: Home, label: 'Главная' },
    { to: '/feed', icon: LayoutGrid, label: 'Лента' },
    { to: '/schedule', icon: Calendar, label: 'Сессии' },
    { to: '/chat', icon: MessageSquare, label: 'Чат' },
    { to: '/profile', icon: User, label: 'Профиль' },
  ];

  return (
    <nav className="bg-[#0f1218]/90 backdrop-blur-xl border-t border-card-border px-4 pb-2 pt-2 z-50">
      <div className="flex items-center justify-between gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 transition-all duration-500 ease-out flex-1 py-1 rounded-2xl relative",
                isActive ? "text-accent scale-110 font-black" : "text-muted hover:text-primary active:scale-90"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute -inset-x-1 inset-y-0 bg-accent/10 border border-accent/20 rounded-2xl -z-10" />
                )}
                <Icon className={cn("w-5 h-5 transition-transform", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                <span className={cn(
                  "text-[9px] uppercase tracking-widest leading-none truncate w-full text-center transition-opacity",
                  isActive ? "opacity-100" : "opacity-40"
                )}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
