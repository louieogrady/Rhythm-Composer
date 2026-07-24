import type { Cell } from './pattern';

export interface TriggerCall {
  instr: number;
  delay: number;
  dur: number;
  vel: number;
  p5: number;
}

export interface InstrumentParams {
  kickTuning: number;
  cymbalRelease: number;
  clapReverb: number;
  pingPong: number;
  hihatDecay: number;
  congaTuning: number;
}

export const resolveStepTriggers = (
  steps: Cell[][],
  col: number,
  delay: number,
  params: InstrumentParams,
  rng: () => number = Math.random,
): TriggerCall[] => {
  const out: TriggerCall[] = [];
  steps.forEach((row, noteIndex) => {
    const cell = row[col];
    if (!cell.on) return;
    if (rng() > cell.prob) return;
    const vel = cell.vel;
    switch (noteIndex) {
      case 0: out.push({ instr: 1, delay, dur: 0.5, vel, p5: params.kickTuning }); break;
      case 1: { const rel = params.cymbalRelease; out.push({ instr: 2, delay, dur: rel + 0.1, vel, p5: rel }); break; }
      case 2: { const rev = params.clapReverb;   out.push({ instr: 3, delay, dur: 0.25 + rev, vel, p5: rev }); break; }
      case 3: out.push({ instr: 4, delay, dur: 0.3, vel, p5: params.pingPong }); break;
      case 4: { const dec = params.hihatDecay;   out.push({ instr: 5, delay, dur: dec + 0.05, vel, p5: dec }); break; }
      case 5: out.push({ instr: 6, delay, dur: 0.7, vel, p5: params.congaTuning }); break;
    }
  });
  return out;
};
