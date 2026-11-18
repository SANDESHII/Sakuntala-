import { FC, InputHTMLAttributes, useId } from 'react';

interface BaseInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const BaseInput: FC<BaseInputProps> = ({ label, className = '', id, ...props }) => {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-xs font-medium text-slate-400"
      >
        {label}
      </label>
      <input
        id={inputId}
        {...props}
        className={`w-full min-h-[44px] bg-slate-900/70 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      />
    </div>
  );
};
