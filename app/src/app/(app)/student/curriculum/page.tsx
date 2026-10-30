import { CurriculumPage } from '@/components/CurriculumPage';
import { tx } from '@/lib/i18n';

export const metadata = { title: 'My programme' };
export const dynamic = 'force-dynamic';

export default function StudentCurriculum() {
  return <CurriculumPage role="student" mode="own" eyebrow={tx('Student · My programme', 'الطالب · برنامجي')} title={tx('My programme', 'برنامجي')}
    sub={tx('Everything you will learn in your programme: knowledge, practical skills and professional attitudes, year by year. Tap a line to see what you must be able to do.',
      'كل ما ستتعلمه في تخصصك: المعارف والمهارات العملية والاتجاهات المهنية، سنة بسنة. اضغط على أي سطر لترى ما يجب أن تتقنه.')} />;
}
