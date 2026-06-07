import { Csound } from '@csound/browser';

// p-field convention: p3=dur, p4=vel (0–1), p5=instrument-specific param
// sr omitted — Csound inherits browser AudioContext rate (~48 kHz)
// All opcodes are core Csound — no plugins required
const ORC = `
ksmps  = 128
nchnls = 2
0dbfs  = 1

; ─── 1: Kick — sine with exponential pitch sweep ────────────────────────────
instr 1
  ivel  = p4
  ifreq = p5
  kgain chnget "masterGain"
  kgain = (kgain < 0.001 ? 1 : kgain)

  ; Pitch falls from 4x fundamental over 50ms, then gentle tail
  kfrq  linseg ifreq * 4, 0.05, ifreq, p3 - 0.05, ifreq * 0.6
  atone oscili 1, kfrq

  ; Click transient via short noise burst
  anoise rand 1
  aclickenv linseg ivel, 0.003, 0, p3 - 0.003, 0
  aclick = anoise * aclickenv

  ; Overall amplitude: fast attack, exponential decay
  aenv  expseg ivel, p3, ivel * 0.0005
  asig  = (atone * 0.85 + aclick * 0.15) * aenv * kgain
  out   asig, asig
endin

; ─── 2: Cymbal — FM metallic stack ──────────────────────────────────────────
instr 2
  ivel  = p4
  irel  = p5
  kgain chnget "masterGain"
  kgain = (kgain < 0.001 ? 1 : kgain)

  imod  = 300
  kenv  expseg ivel, irel, ivel * 0.001

  amod1 oscili imod * 0.5, imod
  amod2 oscili imod * 0.7, imod * 1.3
  amod3 oscili imod * 0.4, imod * 0.8
  amod4 oscili imod * 0.6, imod * 1.6
  am1   oscili kenv * 0.35, 205 + amod1
  am2   oscili kenv * 0.30, 307 + amod2
  am3   oscili kenv * 0.20, 513 + amod3
  am4   oscili kenv * 0.15, 673 + amod4
  asig  = (am1 + am2 + am3 + am4) * 0.5 * kgain
  out   asig, asig
endin

; ─── 3: Clap — layered noise bursts through bandpass + reverb ───────────────
instr 3
  ivel  = p4
  iwet  = p5
  kgain chnget "masterGain"
  kgain = (kgain < 0.001 ? 1 : kgain)

  anoise rand 1
  aenv1  linseg ivel, 0.003, 0,    0.297, 0
  aenv2  linseg 0,   0.008,  ivel, 0.003, 0, 0.289, 0
  aenv3  linseg 0,   0.014,  ivel, 0.004, 0, 0.282, 0
  amix   = anoise * (aenv1 + aenv2 * 0.7 + aenv3 * 0.5)
  afilt  butterbp amix, 1400, 700
  afilt  = afilt * 3

  arev   reverb afilt, 1.2
  adry   = afilt * (1 - iwet)
  awet   = arev  * iwet * 0.4
  asig   = (adry + awet) * kgain
  out    asig, asig
endin

; ─── 4: Snare — tonal sine + noise layer + ping-pong delay ──────────────────
instr 4
  ivel   = p4
  ipingp = p5
  kgain  chnget "masterGain"
  kgain  = (kgain < 0.001 ? 1 : kgain)

  ; Tonal drum-head component
  kbody  linseg 210, 0.01, 180, p3 - 0.01, 160
  ahead  oscili 1, kbody
  aenv1  expseg ivel, p3, ivel * 0.0005
  ahead  = ahead * aenv1

  ; Snare buzz — bandpass-filtered noise
  anoise rand 1
  abuzz  butterbp anoise, 4500, 2800
  aenv2  linseg ivel, 0.003, ivel * 0.4, 0.1, 0
  abuzz  = abuzz * aenv2 * 2

  asig   = (ahead * 0.45 + abuzz * 0.55) * kgain

  adl    delay  asig, 0.24
  adr    delay  asig, 0.36
  out    asig * (1 - ipingp) + adl * ipingp * 0.6,  asig * (1 - ipingp) + adr * ipingp * 0.6
endin

; ─── 5: Hihat — high-pass noise with variable decay ─────────────────────────
instr 5
  ivel   = p4
  idecay = p5
  kgain  chnget "masterGain"
  kgain  = (kgain < 0.001 ? 1 : kgain)

  anoise rand 1
  ahigh  butterhp anoise, 9000
  aenv   linseg ivel, idecay, 0
  asig   = ahigh * aenv * 1.5 * kgain
  out    asig, asig
endin

; ─── 6: Conga — sine with pitch sweep, longer decay ─────────────────────────
instr 6
  ivel  = p4
  ifreq = p5
  kgain chnget "masterGain"
  kgain = (kgain < 0.001 ? 1 : kgain)

  kfrq  linseg ifreq * 2.5, 0.03, ifreq, p3 - 0.03, ifreq * 0.75
  asig  oscili 1, kfrq
  aenv  expseg ivel, p3, ivel * 0.0005
  asig  = asig * aenv * kgain
  out   asig, asig
endin
`;

type CsoundObj = Awaited<ReturnType<typeof Csound>>;

export type ScheduleCallback = (col: number, delay: number) => void;
export type StepCallback     = (col: number) => void;

let cs:          CsoundObj | null       = null;
let initPromise: Promise<void> | null   = null;
let audioCtx:    AudioContext | null    = null;

const LOOKAHEAD = 0.1;
const INTERVAL  = 25;

let isPlaying    = false;
let nextNoteTime = 0;
let currentCol   = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let bpm   = 120;
let swing = 0;

let onSchedule: ScheduleCallback | null = null;
let onStep:     StepCallback     | null = null;

// Channel values buffered before Csound initialises
const pendingChannels = new Map<string, number>();

function secondsPerSixteenth(): number { return (60 / bpm) / 4; }

function stepDuration(col: number): number {
  const base = secondsPerSixteenth();
  if (swing === 0) return base;
  return col % 2 === 0 ? base * (1 + swing) : base * (1 - swing);
}

function scheduleNextNote(): void {
  const col   = currentCol;
  const delay = Math.max(0, nextNoteTime - audioCtx!.currentTime);
  onSchedule?.(col, delay);
  setTimeout(() => onStep?.(col), delay * 1000);
  nextNoteTime += stepDuration(col);
  currentCol = (currentCol + 1) % 16;
}

function tick(): void {
  if (!audioCtx || !isPlaying) return;
  while (nextNoteTime < audioCtx.currentTime + LOOKAHEAD) {
    scheduleNextNote();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function init(): Promise<void> {
  if (cs) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    cs = await Csound();
    if (!cs) throw new Error('Csound failed to initialise');
    cs.on('message', (msg: string) => console.log('[csound]', msg));
    await cs.setOption('-odac');
    const ret = await cs.compileOrc(ORC);
    if (ret !== 0) throw new Error(`Csound orchestra compile failed (code ${ret}) — check [csound] messages above`);
    await cs.start();
    audioCtx = await cs.getAudioContext() as AudioContext;
    // Apply any channels that were set before init completed
    pendingChannels.forEach((val, name) => cs!.setControlChannel(name, val));
    console.log('[csound] engine ready');
  })();
  return initPromise;
}

export function setOnSchedule(cb: ScheduleCallback): void { onSchedule = cb; }
export function setOnStep(cb: StepCallback): void         { onStep     = cb; }

/**
 * Trigger a Csound instrument.
 * instr: 1–6  delay: seconds from now  dur: note duration  vel: 0–1  p5: instrument param
 */
export function trigger(instr: number, delay: number, dur: number, vel: number, p5: number): void {
  if (!cs) return;
  cs.inputMessage(`i ${instr} ${delay.toFixed(4)} ${dur.toFixed(4)} ${vel.toFixed(4)} ${p5.toFixed(4)}`);
}

export function setControlChannel(name: string, val: number): void {
  pendingChannels.set(name, val);
  if (cs) cs.setControlChannel(name, val);
}

export function play(): void {
  if (!audioCtx) return;
  if (!isPlaying) {
    isPlaying    = true;
    nextNoteTime = audioCtx.currentTime + 0.05;
    currentCol   = 0;
    intervalId   = setInterval(tick, INTERVAL);
  }
}

export function pause(): void {
  isPlaying = false;
  if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
}

export function setBpm(v: number): void   { bpm   = v; }
export function setSwing(v: number): void { swing = v; }
