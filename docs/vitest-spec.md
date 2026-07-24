# Vitest Test Suite — Spec

## What & Why

The project has zero automated tests. The most fragile logic — URL pattern encoding, per-cell velocity/probability bit-packing, and pattern-bank slot transitions — is pure and deterministic but currently buried inside `App.tsx`, untested, and only exercisable by clicking through the live UI. This spec adds a **Vitest** suite (Vite-native, minimal config) that covers the pure logic directly, plus a mocked test of the scheduler callback's probability-gating and velocity-passthrough behaviour. The payoff: encoding regressions (which silently corrupt shareable links) and slot-state bugs get caught before they ship.

## Scope

- Install and configure Vitest with a `jsdom` environment via `vite.config.ts` `test` block.
- Extract the pure encoding functions (`patternToParam`, `paramToPattern`) and the cell primitives (`Cell` type, `makeCell`, `EMPTY_STEPS`, `clamp01`, encoding constants) out of `App.tsx` into a shared `src/lib/pattern.ts` module, re-exported so `App.tsx` behaviour is unchanged.
- Extract the pattern-bank slot transition logic (`saveToSlot`, `clearSlot`, `onSlotClick` decision) into pure reducer-style functions in `src/lib/bank.ts` so they can be tested without rendering `App`.
- Extract the per-instrument scheduling decision (the body of the `setOnSchedule` callback) into a pure function `resolveStepTriggers` in `src/lib/scheduler.ts`, injectable with a seeded RNG so probability gating is deterministic under test.
- Add test files under `src/__tests__/` covering: URL round-trips, bit-packing fidelity, bank transitions, scheduler resolution.
- Add `test`, `test:run`, `test:ui` npm scripts.
- Mock `@csound/browser` and the Web Audio API where the scheduler test touches them (it should not, after extraction — see Technical Design).

## Out of Scope

- Component render / DOM-interaction tests (clicking cells, knob drag, popups). No `@testing-library/react` usage in this pass — see Data note below on why it's installed but unused.
- Integration tests that boot real Csound WASM or a real `AudioContext`.
- Testing `useZoom`, `Knob` pointer math, or SCSS.
- Visual / snapshot testing.
- CI wiring (GitHub Actions). Scripts only.

## Current State

All target logic lives in `src/components/App.tsx` and is **not exported**:

| Symbol | Location | Testability blocker |
|---|---|---|
| `patternToParam(steps)` | `App.tsx:63–76` | module-local const, not exported |
| `paramToPattern(str)` | `App.tsx:78–97` | module-local const, not exported |
| `Cell` interface | `App.tsx:50–54` | exported already |
| `makeCell`, `EMPTY_STEPS`, `clamp01` | `App.tsx:56–61` | module-local |
| `VEL_DEFAULT`, `PROB_DEFAULT` | `App.tsx:47–48` | module-local |
| `saveToSlot` / `clearSlot` / `onSlotClick` | `App.tsx:246–269` | closures over `useState` setters; not pure |
| `setOnSchedule` callback body | `App.tsx:150–183` | closure over refs; calls `csoundEngine.trigger` directly; uses global `Math.random` |

Key facts confirmed from the source:

- **Encoding** (`App.tsx:70`): each cell packs to one byte as `(on << 7) | (encVel << 3) | encProb`, where `encVel = round(clamp01(vel) * 15)` (4 bits) and `encProb = round(clamp01(prob) * 7)` (3 bits). Bit 6 is unused/always 0. 96 bytes → base64url, trailing `=` stripped → **128-char** string.
- **Decode** (`App.tsx:78–97`): rejects any input whose length `!== 128`, and rejects if the decoded binary length `!== 96`. `atob` failure is caught and returns `null`. Decoded `vel = ((byte>>3)&0x0F)/15`, `prob = (byte&0x07)/7`.
- **Scheduler decision** (`App.tsx:150–183`): for each of 6 rows, skip if `!cell.on`; skip if `Math.random() > cell.prob`; else call `csoundEngine.trigger` with a per-instrument `(dur, vel, p5)`. `vel` is passed through unchanged. The p5 values are derived from knob refs, not from the cell.
- **Bank transitions** (`App.tsx:246–269`): `BANK_SIZE = 5`. `onSlotClick(i)`: if `i` is the active slot → deselect (no bank change); else if slot empty → `saveToSlot` (capture snapshot, set active); else → `applySnapshot` + set active. `clearSlot(i)`: null the slot; if it was active, clear active.

> **Note — the "Csound engine scheduler" in the task is App-side.** The task lists "Csound engine scheduler — the onSchedule callback logic" under `csound-engine.ts`, but the probability gating and velocity passthrough actually live in the **App** `setOnSchedule` callback (`App.tsx:150–183`). `csound-engine.ts` only *invokes* the callback (`scheduleNextNote`, `csound-engine.ts:165–172`). This spec tests the App-side decision logic by extracting it; it does **not** test the WASM engine's own timing loop (out of scope). This is a deviation from the task's file attribution, flagged here deliberately.

No test tooling is installed (`package.json:12–20` has no `vitest`, `jsdom`, or testing-library). `vite.config.ts` has no `test` block. `tsconfig.json` does not include `vitest/globals` types.

## Proposed Behaviour

- A developer can run `npm test` to launch Vitest in watch mode, or `npm run test:run` for a single CI-style pass, or `npm run test:ui` for the browser UI.
- The suite exercises pure functions extracted into `src/lib/`, so no Csound WASM or real `AudioContext` boots during tests.
- Refactoring is behaviour-preserving: `App.tsx` imports the extracted symbols and renders identically. `patternToParam`/`paramToPattern` produce byte-identical output to today, so existing shared URLs keep working.
- Probability gating is deterministic in tests via an injected RNG, so a `prob = 0` cell provably never triggers and a `prob = 1` cell provably always triggers regardless of RNG.

## Technical Design

### Refactor 1 — `src/lib/pattern.ts` (new)

Move verbatim from `App.tsx` (no logic change):

```ts
export const VEL_DEFAULT  = 1.0;
export const PROB_DEFAULT = 1.0;

export interface Cell {
  on: 0 | 1;
  vel: number;
  prob: number;
}

export const makeCell = (on: 0 | 1 = 0): Cell => ({ on, vel: VEL_DEFAULT, prob: PROB_DEFAULT });

export const EMPTY_STEPS = (): Cell[][] =>
  Array.from({ length: 6 }, () => Array.from({ length: 16 }, () => makeCell()));

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const patternToParam = (steps: Cell[][]): string => { /* App.tsx:63–76 verbatim */ };
export const paramToPattern = (str: string): Cell[][] | null => { /* App.tsx:78–97 verbatim */ };
```

`App.tsx` then imports these and **deletes** its local copies. The `export interface Cell` currently on `App.tsx:50` moves here; `App.tsx` re-exports it (`export type { Cell } from '../lib/pattern'`) if any sibling imports `Cell` from `App` today — grep before removing.

`btoa`/`atob` exist in `jsdom`, so no polyfill needed.

### Refactor 2 — `src/lib/bank.ts` (new)

Pure functions operating on plain values, no React:

```ts
import type { Snapshot } from '../components/App';

export const BANK_SIZE = 5;

export type Bank = (Snapshot | null)[];

export const emptyBank = (): Bank => Array<Snapshot | null>(BANK_SIZE).fill(null);

/** Returns the next bank array with `snap` written to slot `i` (immutable). */
export const writeSlot = (bank: Bank, i: number, snap: Snapshot): Bank =>
  bank.map((s, j) => (j === i ? snap : s));

/** Returns the next bank array with slot `i` cleared (immutable). */
export const clearSlotAt = (bank: Bank, i: number): Bank =>
  bank.map((s, j) => (j === i ? null : s));

export type SlotAction =
  | { kind: 'deselect' }
  | { kind: 'save'; index: number }
  | { kind: 'load'; index: number; snapshot: Snapshot };

/** Pure decision for onSlotClick — no side effects. */
export const resolveSlotClick = (bank: Bank, activeSlot: number | null, i: number): SlotAction => {
  if (activeSlot === i) return { kind: 'deselect' };
  if (bank[i] === null) return { kind: 'save', index: i };
  return { kind: 'load', index: i, snapshot: bank[i]! };
};
```

`App.tsx` rewrites `onSlotClick` to call `resolveSlotClick` and switch on `SlotAction.kind`, and rewrites `saveToSlot`/`clearSlot` to use `writeSlot`/`clearSlotAt`. To avoid a circular import (`bank.ts` → `App.tsx` → `bank.ts`), move the `Snapshot` interface (`App.tsx:23–32`) into `src/lib/pattern.ts` (or a new `src/lib/snapshot.ts`) and have both `App.tsx` and `bank.ts` import it from there. **Preferred:** put `Snapshot` in `pattern.ts` alongside `Cell` since it wraps a pattern string.

### Refactor 3 — `src/lib/scheduler.ts` (new)

Extract the `setOnSchedule` decision into a pure resolver that returns *what to trigger* rather than calling the engine:

```ts
import type { Cell } from './pattern';

export interface TriggerCall {
  instr: number;   // 1–6
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

/**
 * Pure resolution of one scheduler column into engine trigger calls.
 * `rng` returns [0,1); a cell fires when rng() <= cell.prob (i.e. NOT (rng > prob)),
 * matching App.tsx:154 `if (Math.random() > cell.prob) return;`.
 */
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
```

`App.tsx`'s `setOnSchedule` callback (`App.tsx:150–183`) becomes a thin adapter:

```ts
csoundEngine.setOnSchedule((col, delay) => {
  const calls = resolveStepTriggers(stepsRef.current, col, delay, {
    kickTuning:    kickTuningRef.current,
    cymbalRelease: cymbalReleaseRef.current,
    clapReverb:    clapReverbRef.current,
    pingPong:      pingPongRef.current,
    hihatDecay:    hihatDecayRef.current,
    congaTuning:   congaTuningRef.current,
  });
  for (const c of calls) csoundEngine.trigger(c.instr, c.delay, c.dur, c.vel, c.p5);
});
```

This keeps the RNG draw *inside* the resolver (one draw per on-cell, in row order), preserving the original draw count and order. Because the resolver returns data, the test never touches `csound-engine.ts` or the Web Audio API — **no Csound/AudioContext mock is required for the scheduler test.**

### Data Shapes

New types introduced (all in the file that owns them, per project rules):

```ts
// src/lib/scheduler.ts
export interface TriggerCall { instr: number; delay: number; dur: number; vel: number; p5: number; }
export interface InstrumentParams { kickTuning: number; cymbalRelease: number; clapReverb: number; pingPong: number; hihatDecay: number; congaTuning: number; }

// src/lib/bank.ts
export type Bank = (Snapshot | null)[];
export type SlotAction =
  | { kind: 'deselect' }
  | { kind: 'save'; index: number }
  | { kind: 'load'; index: number; snapshot: Snapshot };
```

`Snapshot` and `Cell` interfaces are unchanged in shape; only their home file moves to `src/lib/pattern.ts`.

### Test seam: seeded RNG

Provide a tiny deterministic RNG in the test (no dependency):

```ts
// mulberry32 — deterministic, seedable
const seededRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
```

For gating-boundary assertions, prefer constant RNGs: `() => 0` (always fires when `prob > 0`) and `() => 1` (never fires unless `prob >= 1`... note `1 > 1` is false, so `prob = 1` with `rng = 1` **does** fire — assert this boundary explicitly).

### Files Changed

| File | Change |
|---|---|
| `package.json` | Add `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` to `devDependencies`; add `test`, `test:run`, `test:ui` scripts |
| `vite.config.ts` | Add `test` block (`environment: 'jsdom'`, `globals: true`, `include`, `setupFiles`); add `/// <reference types="vitest/config" />` |
| `tsconfig.json` | Add `"vitest/globals"` to `compilerOptions.types` (or rely on `globals:true` + per-file imports — see note) |
| `src/lib/pattern.ts` | **New.** Extracted `Cell`, `Snapshot`, `makeCell`, `EMPTY_STEPS`, `clamp01`, `patternToParam`, `paramToPattern`, `VEL_DEFAULT`, `PROB_DEFAULT` |
| `src/lib/bank.ts` | **New.** `BANK_SIZE`, `Bank`, `emptyBank`, `writeSlot`, `clearSlotAt`, `SlotAction`, `resolveSlotClick` |
| `src/lib/scheduler.ts` | **New.** `TriggerCall`, `InstrumentParams`, `resolveStepTriggers` |
| `src/lib/index.ts` | Re-export new modules from the barrel (optional; keep existing `Knob`/`useZoom` exports) |
| `src/components/App.tsx` | Delete inlined logic; import from `src/lib/*`; rewrite `setOnSchedule` adapter, `onSlotClick`, `saveToSlot`, `clearSlot` |
| `src/test/setup.ts` | **New.** `import '@testing-library/jest-dom'` (harmless even if RTL unused this pass) |
| `src/__tests__/pattern.test.ts` | **New.** URL round-trip + bit-packing |
| `src/__tests__/bank.test.ts` | **New.** Slot transitions |
| `src/__tests__/scheduler.test.ts` | **New.** Probability gating + velocity passthrough |

### `vite.config.ts` target

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
```

### `package.json` scripts

```jsonc
"test":     "vitest",
"test:run": "vitest run",
"test:ui":  "vitest --ui"
```

### Install command

```
npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

> **`@testing-library/react` justification:** installed now so the follow-up component-test pass needs no dependency churn, and `setup.ts` wiring is in place. It is **not exercised** by the tests in this spec. If you want strictly zero unused deps, drop `@testing-library/react` + `@testing-library/jest-dom` and make `setup.ts` empty — the four target areas are all pure and need only `vitest` + `jsdom` (for `btoa`/`atob`).

## Concrete Test Cases

### `src/__tests__/pattern.test.ts`

| # | Case | Input | Expected |
|---|---|---|---|
| 1 | Empty round-trips | `EMPTY_STEPS()` | `paramToPattern(patternToParam(x))` deep-equals `x` |
| 2 | Empty encodes to fixed length | `EMPTY_STEPS()` | `patternToParam(x).length === 128` |
| 3 | Empty byte value | `EMPTY_STEPS()` | every decoded cell = `{ on:0, vel:1, prob:1 }` (default vel/prob encode to max) |
| 4 | Full pattern round-trips | all 96 cells `on:1, vel:1, prob:1` | round-trips deep-equal; length 128 |
| 5 | Velocity quantisation | one cell `vel:0.5` | decoded `vel === round(0.5*15)/15 === 8/15` (**not** 0.5 — assert the lossy value) |
| 6 | Probability quantisation | one cell `prob:0.5` | decoded `prob === round(0.5*7)/7 === 4/7` |
| 7 | Velocity clamp high | `vel:2.0` | encodes as if `1.0` → decoded `vel === 1` |
| 8 | Velocity clamp low | `vel:-1` | encodes as `0` → decoded `vel === 0` |
| 9 | `on` bit isolation | cell `on:1, vel:0, prob:0` | byte `>>7 === 1`; decoded `on:1, vel:0, prob:0` |
| 10 | base64url alphabet | any pattern | output matches `/^[A-Za-z0-9_-]+$/`, contains no `+`, `/`, or `=` |
| 11 | Reject wrong length | `"abc"` | `paramToPattern` returns `null` |
| 12 | Reject empty string | `""` | returns `null` (length ≠ 128) |
| 13 | Reject non-base64 128-char | 128 chars of `"*"` | returns `null` (via `atob` throw → catch, or length check) |
| 14 | Distinct cells preserved | set cells `[0][0]` and `[5][15]` distinctly | both survive round-trip at correct row/col |
| 15 | vel/prob independence | cell `vel:1, prob:0` | decoded `vel:1, prob:0` (bit fields don't bleed) |

> Test 5/6 exist specifically to **document the lossy quantisation as intended** — 4-bit vel (16 levels), 3-bit prob (8 levels). If a future change widens the fields, these tests flag it.

### `src/__tests__/bank.test.ts`

Use a stub `Snapshot` factory: `const snap = (p = 'X'): Snapshot => ({ p, bpm:120, k:44, con:107, rev:0, ping:0, hh:0.25, cym:0.25 })`.

| # | Case | Setup | Expected |
|---|---|---|---|
| 1 | `emptyBank` shape | — | length 5, all `null` |
| 2 | `writeSlot` writes | empty bank, `writeSlot(b, 2, snap())` | slot 2 = snap, others `null`, original `b` unmutated |
| 3 | `writeSlot` overwrites | bank with snap at 2, write different snap | slot 2 = new snap |
| 4 | `writeSlot` immutable | — | returned array `!== b`; `b[2] === null` still |
| 5 | `clearSlotAt` clears | bank filled at 3, clear 3 | slot 3 `null`, immutable |
| 6 | `resolveSlotClick` deselect | `activeSlot=1`, click 1 | `{ kind:'deselect' }` |
| 7 | `resolveSlotClick` save empty | slot 4 null, `activeSlot=null`, click 4 | `{ kind:'save', index:4 }` |
| 8 | `resolveSlotClick` load filled | slot 0 = snap, `activeSlot=null`, click 0 | `{ kind:'load', index:0, snapshot: snap }` |
| 9 | Load beats save when filled+not-active | slot 0 filled, `activeSlot=2`, click 0 | `{ kind:'load', ... }` (not save) |
| 10 | Deselect beats load | slot 0 filled, `activeSlot=0`, click 0 | `{ kind:'deselect' }` (active check wins) |

### `src/__tests__/scheduler.test.ts`

Fixed `params`: `{ kickTuning:50, cymbalRelease:0.3, clapReverb:0.4, pingPong:0.2, hihatDecay:0.25, congaTuning:107 }`. Build a `steps` grid via `EMPTY_STEPS()` and mutate specific cells.

| # | Case | Setup | Expected |
|---|---|---|---|
| 1 | Off cells never trigger | all cells off | `resolveStepTriggers(steps, 0, 0, params)` → `[]` |
| 2 | On cell fires (rng=0) | kick `[0][0]` on, `prob:1` | `rng=()=>0` → 1 call, `instr:1` |
| 3 | prob=0 never fires | kick on, `prob:0` | `rng=()=>0` → `[]` (0 > 0 is false... assert: `rng() > 0` with `rng=0` is `false` → **fires**; use `rng=()=>0.5`, `0.5 > 0` true → skip). **Assert with `rng=()=>0.5` that prob=0 → `[]`** |
| 4 | prob=1 always fires at boundary | on, `prob:1`, `rng=()=>1` (`1 > 1` false) | 1 call |
| 5 | prob gating mid | on, `prob:0.5`, `rng=()=>0.4` (fires), then `rng=()=>0.6` (skips) | 1 call, then 0 calls |
| 6 | Velocity passthrough | kick on, `vel:0.62` | trigger `.vel === 0.62` (unquantised — resolver reads the live cell, not URL) |
| 7 | Correct instr per row | one cell on in each row 0–5, all `prob:1`, `rng=0` | 6 calls with `instr` `[1,2,3,4,5,6]` in row order |
| 8 | Per-instrument p5 wiring | rows: cymbal→p5=0.3, clap→p5=0.4, snare→p5=0.2, hihat→p5=0.25, kick→p5=50, conga→p5=107 | each `TriggerCall.p5` matches `params` mapping |
| 9 | Per-instrument dur wiring | cymbal `dur=0.4` (rel+0.1), hihat `dur=0.30` (dec+0.05), clap `dur=0.65` (0.25+0.4), kick `0.5`, snare `0.3`, conga `0.7` | assert each `dur` |
| 10 | delay passthrough | any on cell, `delay=0.123` | `TriggerCall.delay === 0.123` |
| 11 | Column selection | kick on only at col 5 | `resolveStepTriggers(steps, 0, ...)` → `[]`; `(steps, 5, ...)` → 1 call |
| 12 | Draw order deterministic | rows 0,3 on with `prob:0.5`; seeded RNG | assert exact fire/skip set for a known seed (documents one-draw-per-on-cell in row order) |

## Edge Cases & Risks

- **Circular import** between `bank.ts` and `App.tsx` if `Snapshot` stays in `App.tsx`. Mitigation: move `Snapshot` into `src/lib/pattern.ts`. Verify no other file imports `Snapshot`/`Cell` from `App` before moving (grep `from '../components/App'` and `from './App'`).
- **`btoa`/`atob` availability:** present in `jsdom`. If the environment is ever switched to `node` for a file, these break — keep `pattern.test.ts` under the jsdom default. Node ≥16 also has global `atob`/`btoa`, so it likely works either way, but don't rely on it.
- **Probability boundary semantics:** the guard is `rng() > cell.prob`. So `prob = 1` **always** fires (nothing exceeds 1 except values `>1`, which `Math.random` never returns; `rng=()=>1` gives `1 > 1 === false` → fires). `prob = 0` fires only when `rng() === 0` exactly. Test 3/4 must encode this exactly or they'll assert the wrong thing — see the corrected setups in the table.
- **Lossy vel/prob:** tests must assert the **quantised** decoded values (`8/15`, `4/7`), not the pre-encode floats, or they fail spuriously. This is intended behaviour, documented, not a bug.
- **Floating-point equality:** `8/15` and `4/7` are exact enough that `toBe`/`toEqual` on the recomputed fraction works (both sides compute the same division). Prefer asserting `decoded.vel === 8/15` rather than `toBeCloseTo` to catch field-width changes precisely.
- **Refactor must be byte-identical:** after extraction, run one round-trip test asserting a known pattern still encodes to the exact same string it did before (capture a golden string from the current build first) to guarantee shareable links from before the refactor still decode.
- **`globals: true` vs imports:** with `globals:true` + `tsconfig` `types:["vitest/globals"]`, `describe/it/expect` need no import. If you skip the tsconfig change, import them from `vitest` per file. Pick one; the spec assumes `globals:true` + tsconfig types.
- **Vitest ↔ Vite version:** Vite is `6.3.5`. Install Vitest `^3` (Vite 6 compatible). Vitest 2 does not officially support Vite 6.

## Acceptance Criteria

- [ ] `npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom` completes and `package.json` lists them under `devDependencies`.
- [ ] `package.json` has `test`, `test:run`, `test:ui` scripts.
- [ ] `vite.config.ts` has a `test` block with `environment: 'jsdom'`, `globals: true`, and `setupFiles`.
- [ ] `patternToParam`, `paramToPattern`, `Cell`, `Snapshot`, `makeCell`, `EMPTY_STEPS`, `clamp01` are exported from `src/lib/pattern.ts` and `App.tsx` imports them (no local duplicate definitions remain in `App.tsx`).
- [ ] `resolveSlotClick`, `writeSlot`, `clearSlotAt`, `emptyBank` are exported from `src/lib/bank.ts` and `App.tsx` uses them.
- [ ] `resolveStepTriggers` is exported from `src/lib/scheduler.ts`; `App.tsx`'s `setOnSchedule` callback delegates to it and the test file imports it without importing `csound-engine.ts`.
- [ ] `npm run test:run` passes with all cases in the three test files green.
- [ ] A golden-string test proves `patternToParam` output is unchanged by the refactor.
- [ ] `npx tsc --noEmit` passes (strict mode, no `any`).
- [ ] `npm run build` still succeeds and the app behaves identically (manual smoke: toggle a cell, share URL, reload, save/load a slot).
- [ ] No test boots Csound WASM or a real `AudioContext`.

## Phase

**New phase — Phase 6: Testing.** `.specs/overview.md` "Completed Work" table ends at Phase 5 (Csound migration) and defines no test phase; `roadmap.md` lists three feature phases (Elektron redesign, velocity/probability, pattern bank) with no testing entry. This work is cross-cutting infrastructure, not a feature, and touches code delivered in the (now complete) velocity/probability and pattern-bank phases. Add a **Phase 6 — Testing** row to `.specs/overview.md` "Completed Work" once implemented, and note in the overview that pure logic now lives in `src/lib/pattern.ts`, `src/lib/bank.ts`, and `src/lib/scheduler.ts` rather than `App.tsx` (the File Layout section at `overview.md:105–133` will need those three files added).
