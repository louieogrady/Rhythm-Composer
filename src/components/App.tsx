import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { useSearchParams } from 'react-router-dom';

import '../App.scss';

import kickImg   from '../images/kick.png';
import clapImg   from '../images/clap.png';
import snareImg  from '../images/snare.png';
import congaImg  from '../images/conga.png';
import cymbalImg from '../images/cymbal.png';
import hihatImg  from '../images/hihat.png';

// Order matches Tone.Sequence case indices: kick(0) cymbal(1) clap(2) snare(3) hihat(4) conga(5)
const INST_IMAGES = [kickImg, cymbalImg, clapImg, snareImg, hihatImg, congaImg];
const INST_ALT    = ['kick', 'cymbal', 'clap', 'snare', 'hihat', 'conga'];

import Cell from './Cell';
import PlayPause from './PlayPause';
import ClearPattern from './ClearPattern';
import RandomPattern from './RandomPattern';
import Title from './Title';
import InfoPopUp from './InfoPopup';
import FreqPopUp from './FreqPopup';
import { Knob } from '../lib';

import * as engine from '../audio/engine';

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

const stepsToParam = (steps: number[][]): string => steps.flat().join(',');

const paramToSteps = (str: string): number[][] | null => {
  const flat = str.split(',').map(Number);
  if (flat.length !== 96) return null;
  return Array.from({ length: 6 }, (_, i) => flat.slice(i * 16, i * 16 + 16));
};

const App = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [steps, setSteps] = useState<number[][]>(EMPTY_STEPS);
  const [bpm, setBpmState] = useState(120);
  const [masterVolume, setMasterVolumeState] = useState(engine.getInitialVolume);
  const [kickDrumTuning, setKickDrumTuning] = useState(43.65);
  const [congaTuning, setCongaTuning] = useState(107);
  const [clapReverbWetLevel, setClapReverbWetLevel] = useState(0);
  const [closedHihatDecayLevel, setClosedHihatDecayLevel] = useState(0.25);
  const [cymbalLevel, setCymbalLevel] = useState(0.25);
  const [pingPongLevel, setPingPongLevel] = useState(0);
  const [activeColumn, setActiveColumn] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showFreq, setShowFreq] = useState(false);

  // Refs so Tone.Sequence callback always sees latest values (stale closure prevention)
  const stepsRef = useRef(steps);
  const kickTuningRef = useRef(kickDrumTuning);
  const congaTuningRef = useRef(congaTuning);

  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { kickTuningRef.current = kickDrumTuning; }, [kickDrumTuning]);
  useEffect(() => { congaTuningRef.current = congaTuning; }, [congaTuning]);

  const updateParam = useCallback((key: string, value: number | string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set(key, typeof value === 'number' ? value.toFixed(2) : value);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Sequencer loop — created once on mount
  useEffect(() => {
    const loop = new Tone.Sequence(
      (time: number, col: number) => {
        setActiveColumn(col);
        stepsRef.current.forEach((row, noteIndex) => {
          if (!row[col]) return;
          const vel = Math.random() * 0.5 + 0.5;
          switch (noteIndex) {
            case 0: engine.kick.triggerAttackRelease(kickTuningRef.current, '16n', time, vel); break;
            case 1: engine.cymbal.triggerAttackRelease(engine.cymbal.frequency.value, '8n', time, vel); break;
            case 2: engine.clap.triggerAttackRelease('16n', time, vel); break;
            case 3: engine.snare.triggerAttackRelease('16n', time, Math.random() * 0.45 + 0.45); break;
            case 4: engine.closedHihat.triggerAttackRelease(engine.closedHihat.frequency.value, '16n', time, vel); break;
            case 5: engine.conga.triggerAttackRelease(congaTuningRef.current, '16n', time, vel); break;
            default: break;
          }
        });
      },
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      '16n'
    ).start('+0.1');

    // Load URL params on first mount
    const params = new URLSearchParams(window.location.search);
    params.forEach((val, key) => applyParam(key, val));

    return () => { loop.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyParam = (key: string, rawVal: string): void => {
    const num = Number(rawVal);
    switch (key) {
      case 'k':    setKickDrumTuning(num); break;
      case 'rev':  engine.setClapReverb(num); setClapReverbWetLevel(num); break;
      case 'ping': engine.setPingPong(num); setPingPongLevel(num); break;
      case 'hh':   engine.setHihatDecay(num); setClosedHihatDecayLevel(num); break;
      case 'cym':  engine.setCymbalRelease(num); setCymbalLevel(num); break;
      case 'con':  setCongaTuning(num); break;
      case 'bpm':  engine.setBpm(num); setBpmState(num); break;
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
    await Tone.start();
    Tone.getTransport().bpm.value = bpm;
    Tone.getTransport().toggle();
  };
  const pause = (): void => { Tone.getTransport().stop(); };

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

  // Knob change handlers
  const changeBpm = (v: number, commit: boolean): void => {
    engine.setBpm(v);
    setBpmState(v);
    if (commit) updateParam('bpm', v);
  };
  const changeVolume = (v: number): void => {
    engine.setMasterVolume(v);
    setMasterVolumeState(v);
  };
  const changeSwing = (v: number): void => engine.setSwing(v);

  const changeKickTuning = (v: number, commit: boolean): void => {
    setKickDrumTuning(v);
    if (commit) updateParam('k', v);
  };
  const changeCymbalRelease = (v: number, commit: boolean): void => {
    engine.setCymbalRelease(v);
    setCymbalLevel(v);
    if (commit) updateParam('cym', v);
  };
  const changeClapReverb = (v: number, commit: boolean): void => {
    engine.setClapReverb(v);
    setClapReverbWetLevel(v);
    if (commit) updateParam('rev', v);
  };
  const changePingPong = (v: number, commit: boolean): void => {
    engine.setPingPong(v);
    setPingPongLevel(v);
    if (commit) updateParam('ping', v);
  };
  const changeHihatDecay = (v: number, commit: boolean): void => {
    engine.setHihatDecay(v);
    setClosedHihatDecayLevel(v);
    if (commit) updateParam('hh', v);
  };
  const changeCongaTuning = (v: number, commit: boolean): void => {
    setCongaTuning(v);
    if (commit) updateParam('con', v);
  };

  // Per-row knob props — order matches INST_IMAGES / Tone.Sequence case indices
  const instKnobs: KnobConfig[] = [
    { label: 'Tuning',  min: 44,  max: 100, value: kickDrumTuning,        onChange: v => changeKickTuning(v, false),    onCommit: v => changeKickTuning(v, true) },
    { label: 'Release', min: 0.1, max: 1,   value: cymbalLevel,           onChange: v => changeCymbalRelease(v, false), onCommit: v => changeCymbalRelease(v, true) },
    { label: 'Reverb',  min: 0,   max: 1,   value: clapReverbWetLevel,    onChange: v => changeClapReverb(v, false),    onCommit: v => changeClapReverb(v, true) },
    { label: 'Delay',   min: 0,   max: 1,   value: pingPongLevel,         onChange: v => changePingPong(v, false),      onCommit: v => changePingPong(v, true) },
    { label: 'Decay',   min: 0.1, max: 1,   value: closedHihatDecayLevel, onChange: v => changeHihatDecay(v, false),   onCommit: v => changeHihatDecay(v, true) },
    { label: 'Tuning',  min: 44,  max: 200, value: congaTuning,           onChange: v => changeCongaTuning(v, false),  onCommit: v => changeCongaTuning(v, true) },
  ];

  const overlayClass = showInfo || showFreq ? 'overlay' : undefined;

  return (
    <>
      <div className={overlayClass}>
        <div className="App">
          <div className="app-unit">

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
                    <img className="inst-img" src={INST_IMAGES[x]} alt={INST_ALT[x]} />
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
                <Knob label="Volume (dB)" min={-12} max={0}   value={masterVolume} defaultValue={-3}  onChange={changeVolume} />
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
