import { useState, forwardRef, type InputHTMLAttributes, type ComponentType } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  type?: string;
  toggleablePassword?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon: Icon, type = 'text', toggleablePassword = false, className = '', ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && toggleablePassword && show ? 'text' : type;

  return (
    <div className="relative w-full">
      {Icon && (
        <Icon
          className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] transition-colors ${focused ? 'text-primary' : 'text-primary/65'}`}
          strokeWidth={1.6}
        />
      )}
      <input
        ref={ref}
        {...rest}
        type={effectiveType}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        className={`w-full rounded-[14px] border bg-background/40 py-4 ${Icon ? 'pl-12' : 'pl-4'} ${isPassword && toggleablePassword ? 'pr-12' : 'pr-4'} text-[16px] text-foreground/90 placeholder:text-foreground/[0.26] outline-none transition-all duration-200 font-sans ${focused ? 'border-primary/70 bg-card shadow-[0_0_0_3px_rgba(0,255,255,0.10)]' : 'border-primary/30'} ${className}`}
      />
      {isPassword && toggleablePassword && (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-primary/70 hover:text-primary active:scale-95 transition-all"
        >
          {show ? <EyeOff className="h-5 w-5" strokeWidth={1.6} /> : <Eye className="h-5 w-5" strokeWidth={1.6} />}
        </button>
      )}
    </div>
  );
});

export default Input;
