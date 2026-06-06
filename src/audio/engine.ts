import * as Tone from 'tone';

const dest = Tone.getDestination();

export const appVol = new Tone.Volume();

export const pingPong = new Tone.PingPongDelay({
  delayTime: '8n',
  feedback: 0.32,
  wet: 0,
});

export const kickComp = new Tone.Compressor(-35, 2);

export const clapReverb = new Tone.JCReverb({
  roomSize: 0.3,
  wet: 0,
});

const clapFilter = new Tone.Filter({
  type: 'bandpass',
  frequency: 1100,
  rolloff: -12,
  Q: 1,
  gain: 1,
});

export const kick = new Tone.MembraneSynth({
  volume: -2,
  pitchDecay: 0.032,
  octaves: 5,
  oscillator: { type: 'square4' },
  envelope: { attack: 0.02, decay: 0.2, sustain: 0.01, release: 0.75 },
}).chain(kickComp, appVol, dest);

export const snare = new Tone.NoiseSynth({
  volume: -8.3,
  noise: { type: 'pink' },
  envelope: { attack: 0.002, decay: 0.21, sustain: 0.05 },
}).chain(pingPong, appVol, dest);

export const closedHihat = new Tone.MetalSynth({
  volume: -8,
  envelope: { attack: 0.002, decay: 0.25, release: 0.025 },
  harmonicity: 4.1,
  modulationIndex: 40,
  resonance: 2000,
  octaves: 1,
}).chain(appVol, dest);
closedHihat.frequency.value = 150;

export const clap = new Tone.NoiseSynth({
  volume: -12,
  noise: { type: 'white', playbackRate: 1 },
  envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.02 },
}).chain(clapFilter, clapReverb, appVol, dest);

export const conga = new Tone.MembraneSynth({
  volume: -2,
  pitchDecay: 0.005,
  octaves: 2,
  envelope: { attack: 0.001, decay: 0.37, sustain: 0.08 },
}).chain(appVol, dest);

export const cymbal = new Tone.MetalSynth({
  volume: -5,
  envelope: { attack: 0.001, decay: 0.15, release: 0.25 },
  harmonicity: 5.1,
  modulationIndex: 32,
  resonance: 4000,
  octaves: 2,
}).chain(appVol, dest);
cymbal.frequency.value = 1200;

export const setMasterVolume = (v: number): void => { appVol.volume.value = v; };
export const setSwing = (v: number): void => { Tone.getTransport().swing = v; };
export const setBpm = (v: number): void => { Tone.getTransport().bpm.rampTo(v, 1); };
export const setPingPong = (v: number): void => { pingPong.wet.value = v; };
export const setClapReverb = (v: number): void => { clapReverb.wet.value = v; };
export const setHihatDecay = (v: number): void => { closedHihat.envelope.decay = v; };
export const setCymbalRelease = (v: number): void => {
  cymbal.envelope.release = v;
  cymbal.envelope.decay = v / 2;
};
export const getInitialVolume = (): number => appVol.volume.value;
