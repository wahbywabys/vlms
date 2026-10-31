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
import { electronicsBench } from '@/models/electronicsBench';
import type { ModelDef } from '@/models/kit';
import { laserMfp } from '@/models/laserMfp';
import { lockstitch } from '@/models/lockstitch';
import { migWelder } from '@/models/migWelder';
import { motorModel } from '@/models/motorAr';
import { motorRewind } from '@/models/motorRewind';
import { networkRack } from '@/models/networkRack';
import { offsetPress } from '@/models/offsetPress';
import { pumpRig } from '@/models/pumpRig';
import { splitAc } from '@/models/splitAc';
import { starterPanel } from '@/models/starterPanel';
import { TOOL_BOARDS } from '@/models/toolBoard';
import { tvBench } from '@/models/tvBench';
import { visionCell } from '@/models/visionCell';
import { washingMachine } from '@/models/washingMachine';
import { aitSafety } from '@/safety/ait';
import { aveSafety } from '@/safety/ave';
import { csnSafety } from '@/safety/csn';
import { hamSafety } from '@/safety/ham';
import { ielSafety } from '@/safety/iel';
import { iemSafety } from '@/safety/iem';
import { oeqSafety } from '@/safety/oeq';
import { racSafety } from '@/safety/rac';
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
  cnc: { accent: LEARNING_META.cnc!.accent, models: [cncLathe, cncMill, benchGrinder, motorModel, TOOL_BOARDS.cnc!], lessons: cncLessons, safety: [cncSafety, cncMillSafety, grinderSafety] },
  auto: { accent: LEARNING_META.auto!.accent, models: [carEngine, TOOL_BOARDS.auto!], lessons: autoLessons, safety: [autoSafety] },
  elec: { accent: LEARNING_META.elec!.accent, models: [starterPanel, motorModel, TOOL_BOARDS.elec!], lessons: elecLessons, safety: [elecSafety] },
  weld: { accent: LEARNING_META.weld!.accent, models: [migWelder, benchGrinder, TOOL_BOARDS.weld!], lessons: weldLessons, safety: [weldSafety, grinderSafety] },
  rmg: { accent: LEARNING_META.rmg!.accent, models: [lockstitch, TOOL_BOARDS.rmg!], lessons: [], safety: [rmgSafety] },
  eim: { accent: LEARNING_META.eim!.accent, models: [pumpRig, motorModel, TOOL_BOARDS.eim!], lessons: [], safety: [eimSafety] },
  prt: { accent: LEARNING_META.prt!.accent, models: [offsetPress, TOOL_BOARDS.prt!], lessons: [], safety: [prtSafety] },
  ait: { accent: LEARNING_META.ait!.accent, models: [visionCell, TOOL_BOARDS.ait!], lessons: [], safety: [aitSafety] },
  iel: { accent: LEARNING_META.iel!.accent, models: [electronicsBench, TOOL_BOARDS.iel!], lessons: [], safety: [ielSafety] },
  csn: { accent: LEARNING_META.csn!.accent, models: [networkRack, TOOL_BOARDS.csn!], lessons: [], safety: [csnSafety] },
  rac: { accent: LEARNING_META.rac!.accent, models: [splitAc, TOOL_BOARDS.rac!], lessons: [], safety: [racSafety] },
  ham: { accent: LEARNING_META.ham!.accent, models: [washingMachine, TOOL_BOARDS.ham!], lessons: [], safety: [hamSafety] },
  oeq: { accent: LEARNING_META.oeq!.accent, models: [laserMfp, TOOL_BOARDS.oeq!], lessons: [], safety: [oeqSafety] },
  ave: { accent: LEARNING_META.ave!.accent, models: [tvBench, electronicsBench, TOOL_BOARDS.ave!], lessons: [], safety: [aveSafety] },
  iem: { accent: LEARNING_META.iem!.accent, models: [motorRewind, starterPanel, motorModel, TOOL_BOARDS.iem!], lessons: [], safety: [iemSafety] },
};

// Keep the tab counts in learningMeta.ts honest during development.
if (process.env.NODE_ENV !== 'production') {
  for (const [id, l] of Object.entries(LEARNING)) {
    const m = LEARNING_META[id];
    if (!m || m.models !== l.models.length || m.lessons !== l.lessons.length || m.safety !== l.safety.length) console.error(`learningMeta.ts is out of date for trade ${id}`);
  }
}
