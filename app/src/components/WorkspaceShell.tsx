import type { ReactNode } from 'react';
import { requireRole, type Role, type Session } from '@/lib/auth';
import { q1 } from '@/lib/db';
import { tx, type Txt } from '@/lib/i18n';
import { Shell, type Section } from './Shell';

export type WorkspaceKey = 'student' | 'trainer' | 'teacher' | 'supervisor' | 'director';

export const WORKSPACE: Record<WorkspaceKey, { role: Role; label: Txt; home: string; sections: Section[]; alerts?: string }> = {
  student: {
    role: 'student', label: tx('Student', 'الطالب'), home: '/student',
    sections: [
      { href: '/student', label: tx('My progress', 'تقدّمي'), exact: true },
      { href: '/student/lab', label: tx('V-Lab', 'المعمل الافتراضي') },
      { href: '/student/quiz', label: tx('Theory quiz', 'اختبار نظري') },
      { href: '/student/logbook', label: tx('Logbook', 'سجل التدريب') },
    ],
  },
  trainer: {
    role: 'vocational_trainer', label: tx('Vocational trainer', 'المدرب المهني'), home: '/trainer', alerts: '/trainer',
    sections: [
      { href: '/trainer', label: tx('Workshop floor', 'أرضية الورشة'), exact: true },
      { href: '/trainer/vlab', label: tx('V-Lab exams', 'امتحانات المعمل') },
      { href: '/trainer/learners', label: tx('Learners', 'المتدربون') },
    ],
  },
  teacher: {
    role: 'academic_teacher', label: tx('Academic teacher', 'المعلم الأكاديمي'), home: '/teacher',
    sections: [
      { href: '/teacher', label: tx('Question bank', 'بنك الأسئلة'), exact: true },
      { href: '/teacher/new', label: tx('New question', 'سؤال جديد') },
      { href: '/teacher/matrix', label: tx('Competency matrix', 'مصفوفة الجدارات') },
    ],
  },
  supervisor: {
    role: 'industry_supervisor', label: tx('Workplace supervisor', 'مشرف موقع العمل'), home: '/supervisor',
    sections: [{ href: '/supervisor', label: tx('Logbook sign-offs', 'اعتماد سجلات التدريب'), exact: true }],
  },
  director: {
    role: 'director', label: tx('Director', 'المدير'), home: '/director', alerts: '/director',
    sections: [
      { href: '/director', label: tx('Institution overview', 'نظرة عامة على المؤسسة'), exact: true },
      { href: '/director/learners', label: tx('Learners', 'المتدربون') },
    ],
  },
};

const initials = (en: string, arName: string | null): Txt => ({
  en: en.replace(/^(Eng\.|Dr\.|Mr\.|Ms\.)\s*/, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  ar: (arName ?? en).replace(/^(م\.|د\.|أ\.)\s*/, '').trim().charAt(0),
});

export async function WorkspaceShell({ ws, children }: { ws: WorkspaceKey; children: ReactNode }) {
  const w = WORKSPACE[ws];
  const s: Session = await requireRole(w.role);
  const inst = await q1<{ name: string; name_ar: string | null }>(`SELECT name, name_ar FROM institutions WHERE id = $1`, [s.institutionId]);
  const mine = (Object.keys(WORKSPACE) as WorkspaceKey[]).filter((k) => s.roles.includes(WORKSPACE[k].role));
  return (
    <Shell
      user={{ name: s.name, nameAr: s.nameAr, roleKey: ws, roleLabel: w.label, initials: initials(s.name, s.nameAr) }}
      sections={w.sections}
      workspaces={mine.map((k) => ({ href: WORKSPACE[k].home, label: WORKSPACE[k].label, active: k === ws }))}
      institution={{ en: inst?.name ?? '', ar: inst?.name_ar ?? inst?.name ?? '' }}
      alertsHref={w.alerts}
    >
      {children}
    </Shell>
  );
}
