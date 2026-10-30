import { CurriculumPage } from '@/components/CurriculumPage';
import { tx } from '@/lib/i18n';

export const metadata = { title: 'Curriculum' };
export const dynamic = 'force-dynamic';

export default function TrainerCurriculum() {
  return <CurriculumPage role="vocational_trainer" mode="pick" eyebrow={tx('Trainer · Programme', 'المدرب · التخصص')} title={tx('Curriculum', 'المنهج')}
    sub={tx('The programme chosen in the trade bar: knowledge modules with hours, skills with their target level, and attitudes, from the WABYS manual.',
      'التخصص المختار في شريط التخصصات: الوحدات المعرفية بساعاتها، والمهارات بمستواها المستهدف، والاتجاهات المهنية، من دليل وابيز.')} />;
}
