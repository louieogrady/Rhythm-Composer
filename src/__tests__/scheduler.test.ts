import { describe, it, expect } from 'vitest';
import { resolveStepTriggers, type InstrumentParams } from '../lib/scheduler';
import { EMPTY_STEPS } from '../lib/pattern';

const seededRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const params: InstrumentParams = {
  kickTuning:    50,
  cymbalRelease: 0.3,
  clapReverb:    0.4,
  pingPong:      0.2,
  hihatDecay:    0.25,
  congaTuning:   107,
};

describe('resolveStepTriggers', () => {
  it('1: all cells off → empty result', () => {
    const steps = EMPTY_STEPS();
    expect(resolveStepTriggers(steps, 0, 0, params)).toEqual([]);
  });

  it('2: on cell fires with rng=()=>0', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 1, prob: 1 };
    const calls = resolveStepTriggers(steps, 0, 0, params, () => 0);
    expect(calls).toHaveLength(1);
    expect(calls[0].instr).toBe(1);
  });

  it('3: prob=0 skips when rng=()=>0.5 (0.5 > 0 is true)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 1, prob: 0 };
    const calls = resolveStepTriggers(steps, 0, 0, params, () => 0.5);
    expect(calls).toEqual([]);
  });

  it('4: prob=1 always fires at boundary (rng=()=>1: 1>1 is false)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 1, prob: 1 };
    const calls = resolveStepTriggers(steps, 0, 0, params, () => 1);
    expect(calls).toHaveLength(1);
  });

  it('5a: prob=0.5 fires when rng=()=>0.4 (0.4>0.5 false)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 1, prob: 0.5 };
    expect(resolveStepTriggers(steps, 0, 0, params, () => 0.4)).toHaveLength(1);
  });

  it('5b: prob=0.5 skips when rng=()=>0.6 (0.6>0.5 true)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 1, prob: 0.5 };
    expect(resolveStepTriggers(steps, 0, 0, params, () => 0.6)).toEqual([]);
  });

  it('6: velocity passes through unquantised', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 0.62, prob: 1 };
    const calls = resolveStepTriggers(steps, 0, 0, params, () => 0);
    expect(calls[0].vel).toBe(0.62);
  });

  it('7: correct instr per row (rows 0–5 all on)', () => {
    const steps = EMPTY_STEPS();
    for (let r = 0; r < 6; r++) steps[r][0] = { on: 1, vel: 1, prob: 1 };
    const calls = resolveStepTriggers(steps, 0, 0, params, () => 0);
    expect(calls.map(c => c.instr)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('8: per-instrument p5 matches params', () => {
    const steps = EMPTY_STEPS();
    for (let r = 0; r < 6; r++) steps[r][0] = { on: 1, vel: 1, prob: 1 };
    const calls = resolveStepTriggers(steps, 0, 0, params, () => 0);
    const byInstr = Object.fromEntries(calls.map(c => [c.instr, c.p5]));
    expect(byInstr[1]).toBe(params.kickTuning);
    expect(byInstr[2]).toBe(params.cymbalRelease);
    expect(byInstr[3]).toBe(params.clapReverb);
    expect(byInstr[4]).toBe(params.pingPong);
    expect(byInstr[5]).toBe(params.hihatDecay);
    expect(byInstr[6]).toBe(params.congaTuning);
  });

  it('9: per-instrument dur values', () => {
    const steps = EMPTY_STEPS();
    for (let r = 0; r < 6; r++) steps[r][0] = { on: 1, vel: 1, prob: 1 };
    const calls = resolveStepTriggers(steps, 0, 0, params, () => 0);
    const byInstr = Object.fromEntries(calls.map(c => [c.instr, c.dur]));
    expect(byInstr[1]).toBe(0.5);
    expect(byInstr[2]).toBe(params.cymbalRelease + 0.1);
    expect(byInstr[3]).toBe(0.25 + params.clapReverb);
    expect(byInstr[4]).toBe(0.3);
    expect(byInstr[5]).toBe(params.hihatDecay + 0.05);
    expect(byInstr[6]).toBe(0.7);
  });

  it('10: delay passes through', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 1, prob: 1 };
    const calls = resolveStepTriggers(steps, 0, 0.123, params, () => 0);
    expect(calls[0].delay).toBe(0.123);
  });

  it('11: column selection — only fires for matching column', () => {
    const steps = EMPTY_STEPS();
    steps[0][5] = { on: 1, vel: 1, prob: 1 };
    expect(resolveStepTriggers(steps, 0, 0, params, () => 0)).toEqual([]);
    expect(resolveStepTriggers(steps, 5, 0, params, () => 0)).toHaveLength(1);
  });

  it('12: seeded RNG determinism (seed 42: kick skips, snare fires)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 1, prob: 0.5 };
    steps[3][0] = { on: 1, vel: 1, prob: 0.5 };
    const calls = resolveStepTriggers(steps, 0, 0, params, seededRng(42));
    expect(calls).toHaveLength(1);
    expect(calls[0].instr).toBe(4);
  });
});
