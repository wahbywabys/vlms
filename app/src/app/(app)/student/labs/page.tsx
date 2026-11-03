import { LabsPage } from '@/components/labs/LabsPage';
import { tx } from '@/lib/i18n';

export const metadata = { title: '3D & VR Labs' };

export default function Page() {
  return <LabsPage role="student" mode="own" eyebrow={tx('All programmes', 'كل التخصصات')} />;
}
