export const VEL_DEFAULT  = 1.0;
export const PROB_DEFAULT = 1.0;

export interface Cell {
  on: 0 | 1;
  vel: number;
  prob: number;
}

export interface Snapshot {
  p: string;
  bpm: number;
  k: number;
  con: number;
  rev: number;
  ping: number;
  hh: number;
  cym: number;
}

export const makeCell = (on: 0 | 1 = 0): Cell => ({ on, vel: VEL_DEFAULT, prob: PROB_DEFAULT });

export const EMPTY_STEPS = (): Cell[][] =>
  Array.from({ length: 6 }, () => Array.from({ length: 16 }, () => makeCell()));

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const patternToParam = (steps: Cell[][]): string => {
  const bytes = new Uint8Array(96);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 16; c++) {
      const cell = steps[r][c];
      const encVel  = Math.round(clamp01(cell.vel)  * 15);
      const encProb = Math.round(clamp01(cell.prob) * 7);
      bytes[r * 16 + c] = (cell.on << 7) | (encVel << 3) | encProb;
    }
  }
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const paramToPattern = (str: string): Cell[][] | null => {
  if (str.length !== 128) return null;
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    if (bin.length !== 96) return null;
    return Array.from({ length: 6 }, (_, r) =>
      Array.from({ length: 16 }, (_, c) => {
        const byte = bin.charCodeAt(r * 16 + c);
        const on = ((byte >> 7) & 1) as 0 | 1;
        return {
          on,
          vel:  ((byte >> 3) & 0x0F) / 15,
          prob: (byte & 0x07) / 7,
        } satisfies Cell;
      })
    );
  } catch {
    return null;
  }
};
