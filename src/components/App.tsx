import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import '../App.scss';

// Order: kick(0) cymbal(1) clap(2) snare(3) hihat(4) conga(5)
const INST_LABELS = ['BD', 'CY', 'CP', 'SD', 'HH', 'CO'];

import Cell from './Cell';
import PlayPause from './PlayPause';
import ClearPattern from './ClearPattern';
import RandomPattern from './RandomPattern';
import Title from './Title';
import InfoPopUp from './InfoPopup';
import FreqPopUp from './FreqPopup';
import { Knob, useZoom } from '../lib';

import * as csoundEngine from '../audio/csound-engine';

interface KnobConfig {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}

const EMPTY_STEPS = (): number[][] =>
  Array.from({ length: 6 }, () => Array<number>(16).fill(0));

const stepsToParam = (steps: number[][]): string => {
  const flat = steps.flat();
  const bytes = new Uint8Array(12);
  for (let i = 0; i < 96; i++) {
    if (flat[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));
  }
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const paramToSteps = (str: string): number[][] | null => {
  if (str.length !== 16) return null;
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    if (bin.length !== 12) return null;
    const flat = Array.from({ length: 96 }, (_, i) =>
      (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1
    );
    return Array.from({ length: 6 }, (_, i) => flat.slice(i * 16, i * 16 + 16));
  } catch {
    return null;
  }
};

const DB_DEFAULT = -3;

const App = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [steps, setSteps]                         = useState<number[][]>(EMPTY_STEPS);
  const [bpm, setBpmState]                        = useState(120);
  const [masterVolume, setMasterVolumeState]      = useState(DB_DEFAULT);
  const [kickDrumTuning, setKickDrumTuning]       = useState(43.65);
  const [congaTuning, setCongaTuning]             = useState(107);
  const [clapReverbWetLevel, setClapReverbWetLevel] = useState(0);
  const [closedHihatDecayLevel, setClosedHihatDecayLevel] = useState(0.25);
  const [cymbalLevel, setCymbalLevel]             = useState(0.25);
  const [pingPongLevel, setPingPongLevel]         = useState(0);
  const [activeColumn, setActiveColumn]           = useState(0);
  const [showInfo, setShowInfo]                   = useState(false);
  const [showFreq, setShowFreq]                   = useState(false);

  // Refs for stale-closure prevention in scheduler callback
  const stepsRef          = useRef(steps);
  const kickTuningRef     = useRef(kickDrumTuning);
  const congaTuningRef    = useRef(congaTuning);
  const cymbalReleaseRef  = useRef(cymbalLevel);
  const clapReverbRef     = useRef(clapReverbWetLevel);
  const pingPongRef       = useRef(pingPongLevel);
  const hihatDecayRef     = useRef(closedHihatDecayLevel);

  useEffect(() => { stepsRef.current         = steps;                }, [steps]);
  useEffect(() => { kickTuningRef.current    = kickDrumTuning;       }, [kickDrumTuning]);
  useEffect(() => { congaTuningRef.current   = congaTuning;          }, [congaTuning]);
  useEffect(() => { cymbalReleaseRef.current = cymbalLevel;          }, [cymbalLevel]);
  useEffect(() => { clapReverbRef.current    = clapReverbWetLevel;   }, [clapReverbWetLevel]);
  useEffect(() => { pingPongRef.current      = pingPongLevel;        }, [pingPongLevel]);
  useEffect(() => { hihatDecayRef.current    = closedHihatDecayLevel;}, [closedHihatDecayLevel]);

  const updateParam = useCallback((key: string, value: number | string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set(key, typeof value === 'number' ? value.toFixed(2) : value);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Register sequencer callbacks once on mount
  useEffect(() => {
    csoundEngine.setOnSchedule((col, delay) => {
      stepsRef.current.forEach((row, noteIndex) => {
        if (!row[col]) return;
        const vel = Math.random() * 0.5 + 0.5;
        switch (noteIndex) {
          case 0: // Kick
            csoundEngine.trigger(1, delay, 0.5, vel, kickTuningRef.current);
            break;
          case 1: { // Cymbal — duration tracks release knob
            const rel = cymbalReleaseRef.current;
            csoundEngine.trigger(2, delay, rel + 0.1, vel, rel);
            break;
          }
          case 2: { // Clap — duration extends with reverb tail
            const rev = clapReverbRef.current;
            csoundEngine.trigger(3, delay, 0.25 + rev * 1.0, vel, rev);
            break;
          }
          case 3: // Snare
            csoundEngine.trigger(4, delay, 0.3, vel, pingPongRef.current);
            break;
          case 4: { // Hihat — duration tracks decay knob
            const dec = hihatDecayRef.current;
            csoundEngine.trigger(5, delay, dec + 0.05, vel, dec);
            break;
          }
          case 5: // Conga
            csoundEngine.trigger(6, delay, 0.7, vel, congaTuningRef.current);
            break;
        }
      });
    });
    csoundEngine.setOnStep((col) => setActiveColumn(col));

    // Load URL params on first mount
    const params = new URLSearchParams(window.location.search);
    params.forEach((val, key) => applyParam(key, val));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyParam = (key: string, rawVal: string): void => {
    const num = Number(rawVal);
    switch (key) {
      case 'k':    setKickDrumTuning(num); csoundEngine.setControlChannel('kickTuning', num); break;
      case 'rev':  setClapReverbWetLevel(num); break;
      case 'ping': setPingPongLevel(num); break;
      case 'hh':   setClosedHihatDecayLevel(num); break;
      case 'cym':  setCymbalLevel(num); break;
      case 'con':  setCongaTuning(num); csoundEngine.setControlChannel('congaTuning', num); break;
      case 'bpm':  csoundEngine.setBpm(num); setBpmState(num); break;
      case 'steps': {
        const parsed = paramToSteps(rawVal);
        if (parsed) setSteps(parsed);
        break;
      }
      default: break;
    }
  };

  // Transport
  const play = async (): Promise<void> => {
    await csoundEngine.init();
    // Push current knob state to Csound channels now that engine is ready
    csoundEngine.setControlChannel('masterGain', Math.pow(10, masterVolume / 20));
    csoundEngine.play();
  };
  const pause = (): void => { csoundEngine.pause(); };

  // Step grid
  const stepToggle = useCallback((x: number, y: number) => {
    setSteps(prev => {
      const next = prev.map((row, i) =>
        i === x ? row.map((v, j) => (j === y ? (v === 0 ? 1 : 0) : v)) : row
      );
      setSearchParams(sp => {
        const nsp = new URLSearchParams(sp);
        nsp.set('steps', stepsToParam(next));
        return nsp;
      }, { replace: true });
      return next;
    });
  }, [setSearchParams]);

  const randomPattern = useCallback(() => {
    const rand = (): number[] => Array(16).fill(0).map(() => Math.random() > 0.8 ? 1 : 0);
    const newSteps = Array.from({ length: 6 }, rand);
    setSteps(newSteps);
    setSearchParams(sp => {
      const nsp = new URLSearchParams(sp);
      nsp.set('steps', stepsToParam(newSteps));
      return nsp;
    }, { replace: true });
  }, [setSearchParams]);

  const clearPattern = useCallback(() => {
    const cleared = EMPTY_STEPS();
    setSteps(cleared);
    setSearchParams(sp => {
      const nsp = new URLSearchParams(sp);
      nsp.set('steps', stepsToParam(cleared));
      return nsp;
    }, { replace: true });
  }, [setSearchParams]);

  // Knob change handlers — all live controls route through Csound channels
  const changeBpm = (v: number, commit: boolean): void => {
    csoundEngine.setBpm(v);
    setBpmState(v);
    if (commit) updateParam('bpm', v);
  };
  const changeVolume = (v: number): void => {
    csoundEngine.setControlChannel('masterGain', Math.pow(10, v / 20));
    setMasterVolumeState(v);
  };
  const changeSwing = (v: number): void => csoundEngine.setSwing(v);

  const changeKickTuning = (v: number, commit: boolean): void => {
    setKickDrumTuning(v);
    if (commit) updateParam('k', v);
  };
  const changeCymbalRelease = (v: number, commit: boolean): void => {
    setCymbalLevel(v);
    if (commit) updateParam('cym', v);
  };
  const changeClapReverb = (v: number, commit: boolean): void => {
    setClapReverbWetLevel(v);
    if (commit) updateParam('rev', v);
  };
  const changePingPong = (v: number, commit: boolean): void => {
    setPingPongLevel(v);
    if (commit) updateParam('ping', v);
  };
  const changeHihatDecay = (v: number, commit: boolean): void => {
    setClosedHihatDecayLevel(v);
    if (commit) updateParam('hh', v);
  };
  const changeCongaTuning = (v: number, commit: boolean): void => {
    setCongaTuning(v);
    if (commit) updateParam('con', v);
  };

  // Per-row knob props
  const instKnobs: KnobConfig[] = [
    { label: 'Tuning',  min: 44,  max: 100, value: kickDrumTuning,        onChange: v => changeKickTuning(v, false),    onCommit: v => changeKickTuning(v, true) },
    { label: 'Release', min: 0.1, max: 1,   value: cymbalLevel,           onChange: v => changeCymbalRelease(v, false), onCommit: v => changeCymbalRelease(v, true) },
    { label: 'Reverb',  min: 0,   max: 1,   value: clapReverbWetLevel,    onChange: v => changeClapReverb(v, false),    onCommit: v => changeClapReverb(v, true) },
    { label: 'Delay',   min: 0,   max: 1,   value: pingPongLevel,         onChange: v => changePingPong(v, false),      onCommit: v => changePingPong(v, true) },
    { label: 'Decay',   min: 0.1, max: 1,   value: closedHihatDecayLevel, onChange: v => changeHihatDecay(v, false),   onCommit: v => changeHihatDecay(v, true) },
    { label: 'Tuning',  min: 44,  max: 200, value: congaTuning,           onChange: v => changeCongaTuning(v, false),  onCommit: v => changeCongaTuning(v, true) },
  ];

  const stageRef = useRef<HTMLDivElement>(null);
  const bgRef    = useRef<HTMLDivElement>(null);
  useZoom(stageRef, {
    onTransform: (s, tx, ty) => {
      const el = bgRef.current;
      if (!el) return;
      // 0.9 keeps background nearly in sync with the unit — same-plane "moving closer" feel
      el.style.transform = `translate(${tx * 0.9}px, ${ty * 0.9}px) scale(${1 + (s - 1) * 0.9})`;
    },
  });

  const overlayClass = showInfo || showFreq ? 'overlay' : undefined;

  return (
    <>
      <div className="bg-layer" ref={bgRef} />
      <div className="vignette-layer" />
      <div className={overlayClass}>
        <div className="App">
          <div className="app-unit" ref={stageRef}>

            <div className="title-row">
              <Title
                showInfoPopup={() => { setShowInfo(s => !s); setShowFreq(false); }}
                showFreqPopup={() => { setShowFreq(s => !s); setShowInfo(false); }}
              />
            </div>

            <div className="main-row">
              <div id="musicGrid">
                {steps.map((row, x) => (
                  <div className="row" key={x}>
                    <span className="inst-label">{INST_LABELS[x]}</span>
                    {row.map((_, y) => (
                      <Cell
                        key={y}
                        stepToggle={stepToggle}
                        x={x}
                        y={y}
                        activeColumn={activeColumn}
                        steps={steps}
                      />
                    ))}
                    <div className="inst-knob">
                      <Knob {...instKnobs[x]} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bottom-row">
              <div className="buttons">
                <PlayPause play={play} pause={pause} />
                <ClearPattern clearPattern={clearPattern} />
                <RandomPattern randomPattern={randomPattern} />
              </div>
              <div className="bottom-sliders">
                <Knob label="Tempo (BPM)" min={10}  max={200} value={bpm}          defaultValue={120} onChange={v => changeBpm(v, false)}    onCommit={v => changeBpm(v, true)} />
                <Knob label="Swing"       min={0}   max={0.25} defaultValue={0}    onChange={changeSwing} />
                <Knob label="Volume (dB)" min={-12} max={0}   value={masterVolume} defaultValue={DB_DEFAULT}  onChange={changeVolume} />
              </div>
            </div>

          </div>
        </div>
      </div>

      {showInfo && <InfoPopUp showInfoPopup={() => setShowInfo(false)} />}
      {showFreq && <FreqPopUp showFreqPopup={() => setShowFreq(false)} />}
    </>
  );
};

export default App;
