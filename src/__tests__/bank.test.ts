import { describe, it, expect } from 'vitest';
import {
  emptyBank,
  writeSlot,
  clearSlotAt,
  resolveSlotClick,
  BANK_SIZE,
} from '../lib/bank';
import type { Snapshot } from '../lib/pattern';

const snap = (p = 'X'): Snapshot => ({
  p,
  bpm: 120,
  k: 44,
  con: 107,
  rev: 0,
  ping: 0,
  hh: 0.25,
  cym: 0.25,
});

describe('bank', () => {
  it('1: emptyBank has length 5 and all null', () => {
    const b = emptyBank();
    expect(b).toHaveLength(BANK_SIZE);
    expect(b.every(s => s === null)).toBe(true);
  });

  it('2: writeSlot writes to correct slot, others remain null', () => {
    const b = emptyBank();
    const s = snap();
    const next = writeSlot(b, 2, s);
    expect(next[2]).toEqual(s);
    expect(next[0]).toBeNull();
    expect(next[1]).toBeNull();
    expect(next[3]).toBeNull();
    expect(next[4]).toBeNull();
  });

  it('3: writeSlot overwrites existing slot', () => {
    const b = emptyBank();
    const first = snap('A');
    const second = snap('B');
    const b1 = writeSlot(b, 2, first);
    const b2 = writeSlot(b1, 2, second);
    expect(b2[2]).toEqual(second);
  });

  it('4: writeSlot is immutable (original bank unchanged)', () => {
    const b = emptyBank();
    const next = writeSlot(b, 2, snap());
    expect(next).not.toBe(b);
    expect(b[2]).toBeNull();
  });

  it('5: clearSlotAt clears the slot immutably', () => {
    const b = writeSlot(emptyBank(), 3, snap());
    const next = clearSlotAt(b, 3);
    expect(next[3]).toBeNull();
    expect(next).not.toBe(b);
    expect(b[3]).not.toBeNull();
  });

  it('6: resolveSlotClick deselects when clicking active slot', () => {
    const b = emptyBank();
    expect(resolveSlotClick(b, 1, 1)).toEqual({ kind: 'deselect' });
  });

  it('7: resolveSlotClick saves when slot is empty and not active', () => {
    const b = emptyBank();
    expect(resolveSlotClick(b, null, 4)).toEqual({ kind: 'save', index: 4 });
  });

  it('8: resolveSlotClick loads when slot is filled and not active', () => {
    const s = snap();
    const b = writeSlot(emptyBank(), 0, s);
    const action = resolveSlotClick(b, null, 0);
    expect(action).toEqual({ kind: 'load', index: 0, snapshot: s });
  });

  it('9: load beats save when slot is filled and a different slot is active', () => {
    const s = snap();
    const b = writeSlot(emptyBank(), 0, s);
    const action = resolveSlotClick(b, 2, 0);
    expect(action.kind).toBe('load');
  });

  it('10: deselect beats load when clicking the active filled slot', () => {
    const s = snap();
    const b = writeSlot(emptyBank(), 0, s);
    const action = resolveSlotClick(b, 0, 0);
    expect(action.kind).toBe('deselect');
  });
});
