import { CurriculumPage } from '@/components/CurriculumPage';
import { tx } from '@/lib/i18n';

export const metadata = { title: 'Curriculum' };
export const dynamic = 'force-dynamic';

export default function TeacherCurriculum() {
  return <CurriculumPage role="academic_teacher" mode="pick" eyebrow={tx('Teacher · Programme', 'المعلم · التخصص')} title={tx('Curriculum', 'المنهج')}
    sub={tx('The programme chosen in the trade bar: knowledge modules with hours, skills with their target level, and attitudes, from the WABYS manual.',
      'التخصص المختار في شريط التخصصات: الوحدات المعرفية بساعاتها، والمهارات بمستواها المستهدف، والاتجاهات المهنية، من دليل وابيز.')} />;
}
