import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type FieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-10 w-full rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-24 w-full resize-y rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-10 w-full rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white outline-none transition focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 ${className}`}
      {...props}
    />
  );
}
