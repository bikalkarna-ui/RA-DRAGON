import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  color?: 'gray' | 'red' | 'blue' | 'violet' | 'amber' | 'green';
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-50 text-gray-400',
  red: 'bg-red-50 text-accent',
  blue: 'bg-blue-50 text-blue-500',
  violet: 'bg-violet-50 text-violet-500',
  amber: 'bg-amber-50 text-amber-500',
  green: 'bg-green-50 text-green-500',
};

export function EmptyState({ icon: Icon, title, description, action, color = 'gray', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl mb-4 shadow-soft', COLOR_MAP[color])}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-bold text-text text-[15px] mb-1">{title}</p>
      {description && <p className="text-sm text-muted max-w-xs leading-relaxed">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn btn-accent mt-5 px-6 text-sm py-2.5">
          {action.label}
        </button>
      )}
    </div>
  );
}
