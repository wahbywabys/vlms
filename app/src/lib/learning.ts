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
import { benchGrinder } from '@/models/benchGrinder';
import { carEngine } from '@/models/carEngine';
import { cncLathe } from '@/models/cncLathe';
import { cncMill } from '@/models/cncMill';
import type { ModelDef } from '@/models/kit';
import { lockstitch } from '@/models/lockstitch';
import { migWelder } from '@/models/migWelder';
import { motorModel } from '@/models/motorAr';
import { offsetPress } from '@/models/offsetPress';
import { pumpRig } from '@/models/pumpRig';
import { starterPanel } from '@/models/starterPanel';
import { visionCell } from '@/models/visionCell';
import { aitSafety } from '@/safety/ait';
import { autoSafety } from '@/safety/auto';
import { cncSafety } from '@/safety/cnc';
import { cncMillSafety } from '@/safety/cncMill';
import { eimSafety } from '@/safety/eim';
import { elecSafety } from '@/safety/elec';
import { grinderSafety } from '@/safety/grinder';
import { prtSafety } from '@/safety/prt';
import { rmgSafety } from '@/safety/rmg';
import type { Scenario } from '@/safety/types';
import { weldSafety } from '@/safety/weld';
import { LEARNING_META } from './learningMeta';

export interface TradeLearning { accent: string; models: ModelDef[]; lessons: Lesson[]; safety: Scenario[] }

export const LEARNING: Record<string, TradeLearning> = {
  cnc: { accent: LEARNING_META.cnc!.accent, models: [cncLathe, cncMill, benchGrinder, motorModel], lessons: cncLessons, safety: [cncSafety, cncMillSafety, grinderSafety] },
  auto: { accent: LEARNING_META.auto!.accent, models: [carEngine], lessons: autoLessons, safety: [autoSafety] },
  elec: { accent: LEARNING_META.elec!.accent, models: [starterPanel, motorModel], lessons: elecLessons, safety: [elecSafety] },
  weld: { accent: LEARNING_META.weld!.accent, models: [migWelder, benchGrinder], lessons: weldLessons, safety: [weldSafety, grinderSafety] },
  rmg: { accent: LEARNING_META.rmg!.accent, models: [lockstitch], lessons: [], safety: [rmgSafety] },
  eim: { accent: LEARNING_META.eim!.accent, models: [pumpRig, motorModel], lessons: [], safety: [eimSafety] },
  prt: { accent: LEARNING_META.prt!.accent, models: [offsetPress], lessons: [], safety: [prtSafety] },
  ait: { accent: LEARNING_META.ait!.accent, models: [visionCell], lessons: [], safety: [aitSafety] },
};

// Keep the tab counts in learningMeta.ts honest during development.
if (process.env.NODE_ENV !== 'production') {
  for (const [id, l] of Object.entries(LEARNING)) {
    const m = LEARNING_META[id];
    if (!m || m.models !== l.models.length || m.lessons !== l.lessons.length || m.safety !== l.safety.length) console.error(`learningMeta.ts is out of date for trade ${id}`);
  }
}
