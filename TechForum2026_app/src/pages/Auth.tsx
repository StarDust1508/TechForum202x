import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { isLocalAuthFallbackEnabled, loginLocalUser, registerLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';

interface AuthProps {
  onSuccess: (user: any) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    phone: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpointPath = mode === 'login' ? '/auth/login' : '/auth/register';
    const endpoint = resolveApiUrl(endpointPath);
    const identifier = method === 'email' ? form.email : form.phone;
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: identifier,
          password: form.password,
          name: form.name
        })
      });

      const contentType = String(res.headers.get('content-type') || '').toLowerCase();
      const data = contentType.includes('application/json') ? await res.json() : null;
      if (!contentType.includes('application/json')) {
        throw new Error('backend_invalid_response');
      }
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');
      if (!data || typeof data !== 'object') throw new Error('backend_invalid_response');
      
      onSuccess(data);
    } catch (err: any) {
      const message = String(err?.message || '');
      const shouldUseLocalFallback = /failed to fetch|network|fetch|backend_invalid_response|unexpected token|load failed|cors/i.test(message.toLowerCase());
      if (!shouldUseLocalFallback || !isLocalAuthFallbackEnabled()) {
        setError(err?.message || 'Ошибка входа');
        setLoading(false);
        return;
      }

      try {
        const user =
          mode === 'register'
            ? await registerLocalUser({
                name: form.name,
                identifier,
                password: form.password,
                method,
              })
            : await loginLocalUser({
                identifier,
                password: form.password,
              });
        onSuccess(user);
      } catch (fallbackError: any) {
        setError(fallbackError?.message || 'Не удалось выполнить вход');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center p-8 bg-surface">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-accent/20 border border-accent/30 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">
          {mode === 'login' ? 'Приветствуем' : 'Регистрация'}
        </h1>
        <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1">
          {mode === 'login' ? 'С возвращением в TechForum 2026' : 'Присоединяйтесь к сообществу'}
        </p>
      </div>

      <div className="flex bg-card/50 border border-card-border p-1 rounded-2xl mb-8">
        <button 
          onClick={() => setMethod('email')}
          className={cn(
            "flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl",
            method === 'email' ? "bg-accent text-surface shadow-lg shadow-accent/20" : "text-muted"
          )}
        >
          Email
        </button>
        <button 
          onClick={() => setMethod('phone')}
          className={cn(
            "flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl",
            method === 'phone' ? "bg-accent text-surface shadow-lg shadow-accent/20" : "text-muted"
          )}
        >
          Телефон
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence mode="wait">
          {mode === 'register' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              <label className="text-[10px] text-muted font-bold uppercase tracking-widest ml-1">Имя</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input 
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full bg-card border border-card-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-accent outline-none transition-colors"
                  placeholder="Иван Иванов"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <label className="text-[10px] text-muted font-bold uppercase tracking-widest ml-1">
            {method === 'email' ? 'Email адрес' : 'Номер телефона'}
          </label>
          <div className="relative">
            {method === 'email' ? <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /> : <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />}
            <input 
              type={method === 'email' ? 'email' : 'tel'}
              required
              value={method === 'email' ? form.email : form.phone}
              onChange={e => setForm({...form, [method]: e.target.value})}
              className="w-full bg-card border border-card-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-accent outline-none transition-colors"
              placeholder={method === 'email' ? 'user@example.com' : '+7 (999) 000-00-00'}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-muted font-bold uppercase tracking-widest ml-1">Пароль</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="password"
              required
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              className="w-full bg-card border border-card-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-accent outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <p className="text-pink-500 text-[10px] font-bold uppercase tracking-widest text-center mt-2">{error}</p>
        )}

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-surface py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-accent/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 mt-10"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <span>{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <button 
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="text-[9px] text-muted font-black uppercase tracking-[0.2em] hover:text-accent transition-colors"
        >
          {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  );
}
