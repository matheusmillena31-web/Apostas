import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-electric-600 text-white hover:bg-electric-500 shadow-glow',
  secondary: 'bg-ink-700 text-slate-100 hover:bg-ink-600 border border-white/8',
  danger: 'bg-red-500/14 text-red-200 border border-red-500/30 hover:bg-red-500/22',
  ghost: 'bg-transparent text-slate-300 hover:bg-white/8',
};

export function Button({ variant = 'primary', icon, children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
