import { describe, it, expect } from 'vitest';
import {
  EMPTY_STEPS,
  patternToParam,
  paramToPattern,
  makeCell,
  VEL_DEFAULT,
  PROB_DEFAULT,
} from '../lib/pattern';

const GOLDEN_EMPTY = 'f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_f39_';

describe('patternToParam / paramToPattern', () => {
  it('1: empty pattern round-trips', () => {
    const steps = EMPTY_STEPS();
    expect(paramToPattern(patternToParam(steps))).toEqual(steps);
  });

  it('2: empty pattern encodes to 128 chars', () => {
    expect(patternToParam(EMPTY_STEPS()).length).toBe(128);
  });

  it('3: empty cells decode with vel:1 and prob:1', () => {
    const decoded = paramToPattern(patternToParam(EMPTY_STEPS()));
    expect(decoded).not.toBeNull();
    for (const row of decoded!) {
      for (const cell of row) {
        expect(cell).toEqual({ on: 0, vel: 1, prob: 1 });
      }
    }
  });

  it('4: full pattern (all on, vel:1, prob:1) round-trips at length 128', () => {
    const steps = Array.from({ length: 6 }, () =>
      Array.from({ length: 16 }, () => ({ on: 1 as const, vel: 1, prob: 1 }))
    );
    const encoded = patternToParam(steps);
    expect(encoded.length).toBe(128);
    expect(paramToPattern(encoded)).toEqual(steps);
  });

  it('5: velocity is quantised to 4-bit (vel:0.5 → 8/15)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 0.5, prob: 1 };
    const decoded = paramToPattern(patternToParam(steps));
    expect(decoded![0][0].vel).toBe(8 / 15);
  });

  it('6: probability is quantised to 3-bit (prob:0.5 → 4/7)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 1, prob: 0.5 };
    const decoded = paramToPattern(patternToParam(steps));
    expect(decoded![0][0].prob).toBe(4 / 7);
  });

  it('7: velocity clamped high (vel:2.0 → decoded 1)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 2.0, prob: 1 };
    const decoded = paramToPattern(patternToParam(steps));
    expect(decoded![0][0].vel).toBe(1);
  });

  it('8: velocity clamped low (vel:-1 → decoded 0)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: -1, prob: 1 };
    const decoded = paramToPattern(patternToParam(steps));
    expect(decoded![0][0].vel).toBe(0);
  });

  it('9: on bit isolated (on:1, vel:0, prob:0)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 1, vel: 0, prob: 0 };
    const encoded = patternToParam(steps);
    const decoded = paramToPattern(encoded);
    expect(decoded![0][0]).toEqual({ on: 1, vel: 0, prob: 0 });
  });

  it('10: output is base64url alphabet only (no +, /, or =)', () => {
    const encoded = patternToParam(EMPTY_STEPS());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('11: rejects wrong-length string', () => {
    expect(paramToPattern('abc')).toBeNull();
  });

  it('12: rejects empty string', () => {
    expect(paramToPattern('')).toBeNull();
  });

  it('13: rejects 128 chars of non-base64', () => {
    expect(paramToPattern('*'.repeat(128))).toBeNull();
  });

  it('14: distinct cells at [0][0] and [5][15] survive round-trip', () => {
    const steps = EMPTY_STEPS();
    steps[0][0]  = { on: 1, vel: 0.25, prob: 1 };
    steps[5][15] = { on: 1, vel: 0.75, prob: 0.5 };
    const decoded = paramToPattern(patternToParam(steps));
    expect(decoded![0][0].on).toBe(1);
    expect(decoded![5][15].on).toBe(1);
    expect(decoded![0][0].vel).toBe(Math.round(0.25 * 15) / 15);
    expect(decoded![5][15].vel).toBe(Math.round(0.75 * 15) / 15);
  });

  it('15: vel and prob bit fields do not bleed (vel:1, prob:0)', () => {
    const steps = EMPTY_STEPS();
    steps[0][0] = { on: 0, vel: 1, prob: 0 };
    const decoded = paramToPattern(patternToParam(steps));
    expect(decoded![0][0]).toEqual({ on: 0, vel: 1, prob: 0 });
  });

  it('golden: EMPTY_STEPS encodes to known string', () => {
    expect(patternToParam(EMPTY_STEPS())).toBe(GOLDEN_EMPTY);
  });
});
