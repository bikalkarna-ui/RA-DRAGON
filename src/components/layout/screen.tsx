'use client';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScreenProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  backHref?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
}

export function Screen({
  title, subtitle, back = true, backHref, action, children, className, noPad
}: ScreenProps) {
  const router = useRouter();
  const goBack = () => backHref ? router.push(backHref) : router.back();

  return (
    <div className="min-h-screen bg-bg">
      <div className="screen">
        {/* Nav bar */}
        <div className="flex items-center justify-between py-5">
          {back ? (
            <button onClick={goBack} className="back-btn -ml-1">
              <ChevronLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
          ) : <div />}
          {action && <div>{action}</div>}
        </div>

        {/* Title */}
        <div className={cn('mb-6', noPad ? '' : '')}>
          <h1 className="text-[28px] font-bold text-text leading-tight">{title}</h1>
          {subtitle && <p className="text-sub text-sm mt-1">{subtitle}</p>}
        </div>

        {/* Content */}
        <div className={cn('pb-20', className)}>
          {children}
        </div>
      </div>
    </div>
  );
}
