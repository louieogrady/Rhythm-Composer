import { useEffect } from 'react';

import ClickOutside from './ClickOutside';

export interface SlotMenuTarget {
  index: number;
  rect: DOMRect;
}

interface SlotMenuProps {
  target: SlotMenuTarget;
  onOverwrite: (i: number) => void;
  onClear: (i: number) => void;
  onClose: () => void;
}

const POPUP_W = 120;
const POPUP_H = 72;
const GAP = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const SlotMenu = ({ target, onOverwrite, onClear, onClose }: SlotMenuProps) => {
  const { rect, index } = target;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onTouchStart = (e: TouchEvent) => {
      const el = document.querySelector('.slot-menu');
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
        className="slot-menu"
        style={{ position: 'fixed', left, top, width: POPUP_W, height: POPUP_H }}
      >
        <button onClick={() => onOverwrite(index)}>Overwrite</button>
        <button onClick={() => onClear(index)}>Clear</button>
      </div>
    </ClickOutside>
  );
};

export default SlotMenu;
