import type { Snapshot } from './pattern';

export { type Snapshot };

export const BANK_SIZE = 5;

export type Bank = (Snapshot | null)[];

export const emptyBank = (): Bank => Array<Snapshot | null>(BANK_SIZE).fill(null);

export const writeSlot = (bank: Bank, i: number, snap: Snapshot): Bank =>
  bank.map((s, j) => (j === i ? snap : s));

export const clearSlotAt = (bank: Bank, i: number): Bank =>
  bank.map((s, j) => (j === i ? null : s));

export type SlotAction =
  | { kind: 'deselect' }
  | { kind: 'save'; index: number }
  | { kind: 'load'; index: number; snapshot: Snapshot };

export const resolveSlotClick = (bank: Bank, activeSlot: number | null, i: number): SlotAction => {
  if (activeSlot === i) return { kind: 'deselect' };
  if (bank[i] === null) return { kind: 'save', index: i };
  return { kind: 'load', index: i, snapshot: bank[i]! };
};
