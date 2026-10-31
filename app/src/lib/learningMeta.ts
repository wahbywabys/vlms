/**
 * Light summary of each trade's learning content (see learning.ts), so the
 * V-Lab page can draw its tabs without loading the 3D models and lessons.
 */
export interface LearningMeta { accent: string; models: number; lessons: number; safety: number }

export const LEARNING_META: Record<string, LearningMeta> = {
  cnc: { accent: '#2f8fd8', models: 5, lessons: 3, safety: 3 },
  auto: { accent: '#d9463b', models: 2, lessons: 3, safety: 1 },
  elec: { accent: '#e8a70a', models: 3, lessons: 2, safety: 1 },
  weld: { accent: '#f06721', models: 3, lessons: 3, safety: 2 },
  rmg: { accent: '#c2417a', models: 2, lessons: 0, safety: 1 },
  eim: { accent: '#3a9d5d', models: 3, lessons: 0, safety: 1 },
  prt: { accent: '#7a4fd1', models: 2, lessons: 0, safety: 1 },
  ait: { accent: '#0f9fb0', models: 2, lessons: 0, safety: 1 },
  iel: { accent: '#f08c00', models: 2, lessons: 0, safety: 1 },
  csn: { accent: '#1098ad', models: 2, lessons: 0, safety: 1 },
  rac: { accent: '#4dabf7', models: 2, lessons: 0, safety: 1 },
  ham: { accent: '#e64980', models: 2, lessons: 0, safety: 1 },
  oeq: { accent: '#5c7cfa', models: 2, lessons: 0, safety: 1 },
  ave: { accent: '#ae3ec9', models: 3, lessons: 0, safety: 1 },
  iem: { accent: '#fab005', models: 4, lessons: 0, safety: 1 },
};
