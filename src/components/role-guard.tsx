'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRole, ViewRole } from '@/hooks/use-role';
import { Loader2 } from 'lucide-react';

export function RoleGuard({ allow, children }: { allow: ViewRole[]; children: React.ReactNode }) {
  const { role, ready } = useRole();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!allow.includes(role)) {
      router.replace('/home');
      return;
    }
    setChecked(true);
  }, [ready, role, allow, router]);

  if (!ready || !checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  return <>{children}</>;
}
