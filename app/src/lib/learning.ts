/**
 * What each trade learns with besides its V-Lab: the 3D digital twins on the
 * "3D & VR" tab and the interactive video lessons. Keyed by trade id; a trade
 * that is not listed simply shows the V-Lab only.
 */
import type { Lesson } from '@/components/LessonPlayer';
import { autoLessons } from '@/lessons/auto';
import { cncLessons } from '@/lessons/cnc';
import { elecLessons } from '@/lessons/elec';
import { weldLessons } from '@/lessons/weld';
import { carEngine } from '@/models/carEngine';
import { cncLathe } from '@/models/cncLathe';
import type { ModelDef } from '@/models/kit';
import { migWelder } from '@/models/migWelder';
import { motorModel } from '@/models/motorAr';
import { starterPanel } from '@/models/starterPanel';
import { autoSafety } from '@/safety/auto';
import { cncSafety } from '@/safety/cnc';
import { elecSafety } from '@/safety/elec';
import type { Scenario } from '@/safety/types';
import { weldSafety } from '@/safety/weld';
import { LEARNING_META } from './learningMeta';

export interface TradeLearning { accent: string; models: ModelDef[]; lessons: Lesson[]; safety: Scenario[] }

export const LEARNING: Record<string, TradeLearning> = {
  cnc: { accent: LEARNING_META.cnc!.accent, models: [cncLathe, motorModel], lessons: cncLessons, safety: [cncSafety] },
  auto: { accent: LEARNING_META.auto!.accent, models: [carEngine], lessons: autoLessons, safety: [autoSafety] },
  elec: { accent: LEARNING_META.elec!.accent, models: [starterPanel, motorModel], lessons: elecLessons, safety: [elecSafety] },
  weld: { accent: LEARNING_META.weld!.accent, models: [migWelder], lessons: weldLessons, safety: [weldSafety] },
};

// Keep the tab counts in learningMeta.ts honest during development.
if (process.env.NODE_ENV !== 'production') {
  for (const [id, l] of Object.entries(LEARNING)) {
    const m = LEARNING_META[id];
    if (!m || m.models !== l.models.length || m.lessons !== l.lessons.length || m.safety !== l.safety.length) console.error(`learningMeta.ts is out of date for trade ${id}`);
  }
}
