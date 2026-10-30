import type { ReactNode } from 'react';
import { LockerBridge } from '@/components/LockerBridge';
import { WorkspaceShell } from '@/components/WorkspaceShell';

export default function Layout({ children }: { children: ReactNode }) {
  return <WorkspaceShell ws="student">{children}<LockerBridge /></WorkspaceShell>;
}
