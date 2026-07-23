'use client';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScreenProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Screen({ title, subtitle, back = true, action, children, className }: ScreenProps) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="screen">
        <div className="flex items-center justify-between py-5">
          {back ? (
            <button onClick={() => window.history.back()} className="back-btn -ml-1">
              <ChevronLeft className="h-5 w-5" />Back
            </button>
          ) : <div />}
          {action && <div>{action}</div>}
        </div>
        <div className="mb-6">
          <h1 className="text-[28px] font-black text-text leading-tight">{title}</h1>
          {subtitle && <p className="text-sub text-sm mt-1">{subtitle}</p>}
        </div>
        <div className={cn('pb-20', className)}>{children}</div>
      </div>
    </div>
  );
}
