'use client';
import { useL } from '@/components/LangProvider';
import { ParamAuthor, type PreviewResult } from '@/components/modules/ParamAuthor';
import { apiFetch } from '@/lib/browserApi';
import { createParametric } from '../actions';

export function ParametricClient({ competencies }: { competencies: { id: string; label: string }[] }) {
  const { L, lang } = useL();
  return <ParamAuthor ui={{ L, lang }} competencies={competencies}
    onPreview={(d) => apiFetch<PreviewResult>('/questions/preview', { body: d })}
    onSave={(d) => createParametric(d)} />;
}
