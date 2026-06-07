# Spec: Replace Tone.js with Csound WASM

## Goal

Replace Tone.js synthesis with Csound running in a browser AudioWorklet, producing a dramatically better-sounding drum machine. Remove Tone.js entirely — it currently serves two roles (synthesis + sequencer clock) and we replace both.

---

## Timing: Drop Tone.js, use a Web Audio lookahead scheduler

Tone.js itself is built on this pattern. With Csound as the engine, keeping Tone.js around purely for its clock means two competing audio systems with their own `AudioContext` instances — a mess. Instead, a ~40-line lookahead scheduler:

```
setInterval (scheduler, ~25ms)
  while (audioCtx.currentTime < lookAhead + scheduleWindow)
    schedule next 16th note step
    advance nextNoteTime by (60 / bpm / 4) seconds
    apply swing offset to odd steps
```

`audioCtx.currentTime` is the ground-truth hardware clock — this is exactly what Tone.js uses internally. Swing is trivial to implement as a time offset on odd steps. BPM changes take effect on the next scheduled note.

---

## Csound WASM: `@csound/browser`

Csound runs in an `AudioWorklet`, keeping synthesis off the main thread. The API is straightforward:

```ts
import { Csound } from '@csound/browser';
const cs = await Csound();
await cs.compileCsdText(orchestraString);
await cs.start();
// trigger a note: instrument 1, starts now, duration 0.5s, velocity 0.8
cs.inputMessage(`i 1 0 0.5 0.8`);
```

Real-time parameter control (decay, tuning, reverb wet) is via Csound **channels**: `cs.setControlChannel('hihatDecay', 0.3)`. Instruments read these with `chnget`.

---

## Orchestra design (`engine.orc`)

One `.orc` file, 6 instruments. Each is a proper synthesis algorithm — not oscillator primitives, but physically-informed designs:

| # | Instrument | Approach |
|---|------------|----------|
| 1 | Kick       | `membrane` opcode — physical model of a circular membrane with pitch and stiffness control |
| 2 | Cymbal     | FM metallic noise, multi-partial additive stack |
| 3 | Clap       | Filtered burst noise, short pre-delay to simulate hand layering |
| 4 | Snare      | `membrane` for the drum head + noise layer mixed |
| 5 | Hihat      | Bandpass filtered noise, short decay |
| 6 | Conga      | `membrane` opcode, longer decay, higher fundamental than kick |

Per-instrument effect parameters read from channels: `hihatDecay`, `cymbalRelease`, `clapReverb`, `kickTuning`, `congaTuning`, `pingPongWet`.

Effects (reverb, ping-pong delay) implemented as Csound opcodes (`freeverb`, `vdelay`) on individual instruments rather than the current post-chain approach — cleaner and sounds better.

---

## What changes

**`src/audio/engine.ts`** — full rewrite. Exports:
- `init(): Promise<void>` — creates AudioContext, loads Csound, compiles orchestra
- `trigger(instrument: number, time: number, velocity: number): void`
- `setMasterVolume / setBpm / setSwing` etc. — same interface names, different internals

**`src/components/App.tsx`** — replace the `Tone.Sequence` `useEffect` with the lookahead scheduler. The rest of the component (state, knobs, URL params, UI) is untouched.

**`package.json`** — remove `tone`, add `@csound/browser`

**New: `src/audio/engine.orc`** — Csound orchestra file

---

## What stays the same

All React UI, SCSS, knob wiring, URL param logic, TypeScript types. The engine's external interface (trigger by row index, set parameters by name) stays identical so `App.tsx` changes are minimal.

---

## Phases

1. **Scaffold** — install `@csound/browser`, prove it initialises and a beep plays. Unblock any Vite/WASM bundling issues early.
2. **Scheduler** — implement lookahead clock, drive `setActiveColumn`, confirm timing is solid with a placeholder trigger.
3. **Instruments** — port all 6 one by one, starting with kick (simplest to evaluate).
4. **Controls** — wire all knobs through `setControlChannel`.
5. **Effects** — implement per-instrument reverb/delay in the orchestra.
6. **Remove Tone.js** — final cleanup once everything works.

---

## Open questions

- Do you want effects (reverb, delay) implemented in Csound or keep them as Web Audio API nodes post-Csound output? Csound is cleaner but means learning Csound opcode syntax for effects too.
- Do you want to explore `wgpluck` for conga as an alternative to `membrane`? Plucked string model gives a more pitched, bongo-adjacent character vs the pure membrane model.
