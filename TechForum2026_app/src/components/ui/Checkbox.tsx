import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  id?: string;
}

export default function Checkbox({ checked, onChange, children, id }: CheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none">
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-[#4ec9c0]/55 bg-[#03161c]/40 transition-colors">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        {checked && <Check className="h-3.5 w-3.5 text-[#4ec9c0]" strokeWidth={2.5} />}
      </span>
      <span className="text-[14px] leading-snug text-[#7aa8a4] font-blueprint">{children}</span>
    </label>
  );
}
