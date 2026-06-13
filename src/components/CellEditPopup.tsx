import { useEffect } from 'react';

import ClickOutside from './ClickOutside';
import { Knob } from '../lib';

export interface CellEditTarget {
  x: number;
  y: number;
  rect: DOMRect;
}

interface CellEditPopupProps {
  target: CellEditTarget;
  velocity: number;
  probability: number;
  onVelocity: (v: number) => void;
  onProbability: (v: number) => void;
  onCommit: () => void;
  onClose: () => void;
}

const POPUP_W = 180;
const POPUP_H = 120;
const GAP = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const CellEditPopup = ({ target, velocity, probability, onVelocity, onProbability, onCommit, onClose }: CellEditPopupProps) => {
  const { rect } = target;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onTouchStart = (e: TouchEvent) => {
      const el = document.querySelector('.cell-edit-popup');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('touchstart', onTouchStart);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('touchstart', onTouchStart);
    };
  }, [onClose]);

  const left = clamp(rect.left + rect.width / 2 - POPUP_W / 2, GAP, window.innerWidth - POPUP_W - GAP);
  const placeBelow = rect.top < POPUP_H + GAP;
  const top = placeBelow ? rect.bottom + GAP : rect.top - POPUP_H - GAP;

  return (
    <ClickOutside onClick={onClose}>
      <div
        className="cell-edit-popup"
        style={{ position: 'fixed', left, top, width: POPUP_W, height: POPUP_H }}
      >
        <Knob label="Vel" min={0} max={1} value={velocity} onChange={onVelocity} onCommit={onCommit} />
        <Knob
          label="Prob"
          unit="%"
          min={0}
          max={100}
          value={probability * 100}
          onChange={v => onProbability(v / 100)}
          onCommit={onCommit}
        />
      </div>
    </ClickOutside>
  );
};

export default CellEditPopup;
