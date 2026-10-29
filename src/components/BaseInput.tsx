import { FC, InputHTMLAttributes } from 'react';

interface BaseInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const BaseInput: FC<BaseInputProps> = ({ label, className = '', ...props }) => (
  <div className="space-y-4 group">
    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest group-focus-within:text-emerald-500 transition-colors">
      {label}
    </label>
    <input
      {...props}
      className={`w-full bg-transparent border-b border-neutral-800 px-0 py-4 text-4xl text-white focus:outline-none focus:border-emerald-500 focus:ring-0 transition-all font-bold placeholder:text-neutral-800 uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    />
  </div>
);
