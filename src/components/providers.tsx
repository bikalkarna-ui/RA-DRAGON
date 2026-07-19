'use client';
import { RoleProvider } from '@/hooks/use-role';

export function Providers({ children }: { children: React.ReactNode }) {
  return <RoleProvider>{children}</RoleProvider>;
}
