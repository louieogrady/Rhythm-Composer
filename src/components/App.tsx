import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import '../App.scss';

// Order: kick(0) cymbal(1) clap(2) snare(3) hihat(4) conga(5)
const INST_LABELS = ['BD', 'CY', 'CP', 'SD', 'HH', 'CO'];

import Cell from './Cell';
import CellEditPopup, { type CellEditTarget } from './CellEditPopup';
import SlotButton from './SlotButton';
import SlotMenu, { type SlotMenuTarget } from './SlotMenu';
import PlayPause from './PlayPause';
import ClearPattern from './ClearPattern';
import RandomPattern from './RandomPattern';
import Title from './Title';
import InfoPopUp from './InfoPopup';
import FreqPopUp from './FreqPopup';
import { Knob, useZoom } from '../lib';

import * as csoundEngine from '../audio/csound-engine';

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

export { type SlotMenuTarget };

const BANK_SIZE = 5;

interface KnobConfig {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}

const VEL_DEFAULT  = 1.0;
const PROB_DEFAULT = 1.0;

export interface Cell {
  on: 0 | 1;
  vel: number;
  prob: number;
}

const makeCell = (on: 0 | 1 = 0): Cell => ({ on, vel: VEL_DEFAULT, prob: PROB_DEFAULT });

const EMPTY_STEPS = (): Cell[][] =>
  Array.from({ length: 6 }, () => Array.from({ length: 16 }, () => makeCell()));

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const patternToParam = (steps: Cell[][]): string => {
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

const paramToPattern = (str: string): Cell[][] | null => {
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

const DB_DEFAULT = -3;

const App = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [steps, setSteps]                         = useState<Cell[][]>(EMPTY_STEPS);
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
  const [editTarget, setEditTarget]               = useState<CellEditTarget | null>(null);
  const [bank, setBank]       = useState<(Snapshot | null)[]>(() => Array<Snapshot | null>(BANK_SIZE).fill(null));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [slotMenu, setSlotMenu]     = useState<SlotMenuTarget | null>(null);

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

  const invalidateSlot = useCallback(() => setActiveSlot(null), []);

  // Register sequencer callbacks once on mount
  useEffect(() => {
    csoundEngine.setOnSchedule((col, delay) => {
      stepsRef.current.forEach((row, noteIndex) => {
        const cell = row[col];
        if (!cell.on) return;
        if (Math.random() > cell.prob) return;
        const vel = cell.vel;
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
      case 'p': {
        const grid = paramToPattern(rawVal);
        if (grid) setSteps(grid);
        break;
      }
      default: break;
    }
  };

  const captureSnapshot = (): Snapshot => ({
    p:    patternToParam(steps),
    bpm,
    k:    kickDrumTuning,
    con:  congaTuning,
    rev:  clapReverbWetLevel,
    ping: pingPongLevel,
    hh:   closedHihatDecayLevel,
    cym:  cymbalLevel,
  });

  const applySnapshot = (snap: Snapshot): void => {
    applyParam('p',    snap.p);
    applyParam('bpm',  String(snap.bpm));
    applyParam('k',    String(snap.k));
    applyParam('con',  String(snap.con));
    applyParam('rev',  String(snap.rev));
    applyParam('ping', String(snap.ping));
    applyParam('hh',   String(snap.hh));
    applyParam('cym',  String(snap.cym));

    updateParam('bpm', snap.bpm);
    updateParam('k',   snap.k);
    updateParam('con', snap.con);
    updateParam('rev', snap.rev);
    updateParam('ping', snap.ping);
    updateParam('hh',  snap.hh);
    updateParam('cym', snap.cym);
    setSearchParams(sp => {
      const nsp = new URLSearchParams(sp);
      nsp.set('p', snap.p);
      return nsp;
    }, { replace: true });
  };

  const saveToSlot = (i: number): void => {
    const snap = captureSnapshot();
    setBank(prev => prev.map((s, j) => (j === i ? snap : s)));
    setActiveSlot(i);
  };

  const clearSlot = (i: number): void => {
    setBank(prev => prev.map((s, j) => (j === i ? null : s)));
    setActiveSlot(cur => (cur === i ? null : cur));
    setSlotMenu(null);
  };

  const onSlotClick = (i: number): void => {
    if (activeSlot === i) {
      setActiveSlot(null);
      return;
    }
    if (bank[i] === null) {
      saveToSlot(i);
    } else {
      applySnapshot(bank[i]!);
      setActiveSlot(i);
    }
  };

  const onSlotMenu = (i: number, rect: DOMRect): void => {
    if (bank[i] === null) return;
    setSlotMenu({ index: i, rect });
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
    invalidateSlot();
    setSteps(prev => {
      const next = prev.map((row, i) =>
        i === x ? row.map((c, j) => (j === y ? { ...c, on: (c.on === 0 ? 1 : 0) as 0 | 1 } : c)) : row
      );
      setSearchParams(sp => {
        const nsp = new URLSearchParams(sp);
        nsp.set('p', patternToParam(next));
        return nsp;
      }, { replace: true });
      return next;
    });
  }, [setSearchParams]);

  const setCellField = useCallback((x: number, y: number, field: 'vel' | 'prob', v: number) => {
    invalidateSlot();
    setSteps(prev =>
      prev.map((row, i) =>
        i === x ? row.map((c, j) => (j === y ? { ...c, [field]: v } : c)) : row
      )
    );
  }, []);

  const openEditor = useCallback((x: number, y: number, rect: DOMRect) => {
    invalidateSlot();
    setSteps(prev => {
      if (prev[x][y].on === 1) return prev;
      const next = prev.map((row, i) =>
        i === x ? row.map((c, j) => (j === y ? { ...c, on: 1 as const } : c)) : row
      );
      setSearchParams(sp => {
        const nsp = new URLSearchParams(sp);
        nsp.set('p', patternToParam(next));
        return nsp;
      }, { replace: true });
      return next;
    });
    setEditTarget({ x, y, rect });
  }, [setSearchParams]);

  const commitEdit = useCallback(() => {
    setSearchParams(sp => {
      const nsp = new URLSearchParams(sp);
      nsp.set('p', patternToParam(stepsRef.current));
      return nsp;
    }, { replace: true });
  }, [setSearchParams]);

  const randomPattern = useCallback(() => {
    invalidateSlot();
    const newSteps = Array.from({ length: 6 }, () =>
      Array.from({ length: 16 }, () => makeCell(Math.random() > 0.8 ? 1 : 0))
    );
    setSteps(newSteps);
    setSearchParams(sp => {
      const nsp = new URLSearchParams(sp);
      nsp.set('p', patternToParam(newSteps));
      return nsp;
    }, { replace: true });
  }, [setSearchParams]);

  const clearPattern = useCallback(() => {
    invalidateSlot();
    const cleared = EMPTY_STEPS();
    setSteps(cleared);
    setSearchParams(sp => {
      const nsp = new URLSearchParams(sp);
      nsp.set('p', patternToParam(cleared));
      return nsp;
    }, { replace: true });
  }, [setSearchParams]);

  // Knob change handlers — all live controls route through Csound channels
  const changeBpm = (v: number, commit: boolean): void => {
    csoundEngine.setBpm(v);
    setBpmState(v);
    if (commit) { invalidateSlot(); updateParam('bpm', v); }
  };
  const changeVolume = (v: number): void => {
    csoundEngine.setControlChannel('masterGain', Math.pow(10, v / 20));
    setMasterVolumeState(v);
  };
  const changeSwing = (v: number): void => csoundEngine.setSwing(v);

  const changeKickTuning = (v: number, commit: boolean): void => {
    setKickDrumTuning(v);
    if (commit) { invalidateSlot(); updateParam('k', v); }
  };
  const changeCymbalRelease = (v: number, commit: boolean): void => {
    setCymbalLevel(v);
    if (commit) { invalidateSlot(); updateParam('cym', v); }
  };
  const changeClapReverb = (v: number, commit: boolean): void => {
    setClapReverbWetLevel(v);
    if (commit) { invalidateSlot(); updateParam('rev', v); }
  };
  const changePingPong = (v: number, commit: boolean): void => {
    setPingPongLevel(v);
    if (commit) { invalidateSlot(); updateParam('ping', v); }
  };
  const changeHihatDecay = (v: number, commit: boolean): void => {
    setClosedHihatDecayLevel(v);
    if (commit) { invalidateSlot(); updateParam('hh', v); }
  };
  const changeCongaTuning = (v: number, commit: boolean): void => {
    setCongaTuning(v);
    if (commit) { invalidateSlot(); updateParam('con', v); }
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
  const fitScale = Math.min(0.8, window.innerWidth / 1080);
  useZoom(stageRef, {
    initial: fitScale,
    min: Math.max(0.25, fitScale * 0.85),
    onTransform: (s, tx, ty) => {
      setEditTarget(null);
      setSlotMenu(null);
      const el = bgRef.current;
      if (!el) return;
      el.style.transform = `translate(${tx * 0.05}px, ${ty * 0.05}px)`;
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
                        openEditor={openEditor}
                        onCloseEditor={() => setEditTarget(null)}
                        isEditing={editTarget?.x === x && editTarget?.y === y}
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

            <div className="bank-section">
              <span className="bank-label">Pattern Bank</span>
              <div className="bank-row">
                {bank.map((snap, i) => (
                  <SlotButton
                    key={i}
                    index={i}
                    filled={snap !== null}
                    active={activeSlot === i}
                    onClick={onSlotClick}
                    onMenu={onSlotMenu}
                  />
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
      {slotMenu && (
        <SlotMenu
          target={slotMenu}
          onOverwrite={i => { saveToSlot(i); setSlotMenu(null); }}
          onClear={clearSlot}
          onClose={() => setSlotMenu(null)}
        />
      )}
      {editTarget && (
        <CellEditPopup
          target={editTarget}
          velocity={steps[editTarget.x][editTarget.y].vel}
          probability={steps[editTarget.x][editTarget.y].prob}
          onVelocity={v => setCellField(editTarget.x, editTarget.y, 'vel', v)}
          onProbability={v => setCellField(editTarget.x, editTarget.y, 'prob', v)}
          onCommit={commitEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
};

export default App;
