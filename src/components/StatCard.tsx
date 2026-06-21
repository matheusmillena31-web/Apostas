import { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: 'neutral' | 'green' | 'red' | 'blue';
};

const tones = {
  neutral: 'text-slate-300',
  green: 'text-emerald-300',
  red: 'text-red-300',
  blue: 'text-sky-300',
};

export function StatCard({ label, value, icon, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="rounded-lg border border-white/8 bg-ink-850 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
        {icon && <div className="text-electric-500">{icon}</div>}
      </div>
      <p className={`mt-3 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}
