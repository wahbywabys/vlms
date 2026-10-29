import type { ReactNode } from 'react';
import { WorkspaceShell } from '@/components/WorkspaceShell';

export default function Layout({ children }: { children: ReactNode }) {
  return <WorkspaceShell ws="student">{children}</WorkspaceShell>;
}
