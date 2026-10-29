'use client';
import { useL } from '@/components/LangProvider';
import { SkillsHeatmap, type RadarPoint, type SkillsData } from '@/components/modules/SkillsHeatmap';
import { apiFetch } from '@/lib/browserApi';

export function SkillsClient({ data, standard }: { data: SkillsData; standard?: string }) {
  const { L, lang } = useL();
  return <SkillsHeatmap ui={{ L, lang }} data={data} standard={standard}
    loadLearner={(id) => apiFetch<{ radar: RadarPoint[] }>(`/analytics/skills/learners/${id}`).then((r) => r.radar)} />;
}
