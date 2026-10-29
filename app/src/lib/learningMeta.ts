/**
 * Light summary of each trade's learning content (see learning.ts), so the
 * V-Lab page can draw its tabs without loading the 3D models and lessons.
 */
export interface LearningMeta { accent: string; models: number; lessons: number }

export const LEARNING_META: Record<string, LearningMeta> = {
  cnc: { accent: '#2f8fd8', models: 2, lessons: 2 },
  auto: { accent: '#d9463b', models: 1, lessons: 2 },
  elec: { accent: '#e8a70a', models: 2, lessons: 2 },
  weld: { accent: '#f06721', models: 1, lessons: 2 },
};
