import { useRef, type CSSProperties } from 'react';

import type { Cell as CellData } from './App';

interface CellProps {
  stepToggle: (x: number, y: number) => void;
  openEditor: (x: number, y: number, rect: DOMRect) => void;
  onCloseEditor: () => void;
  isEditing: boolean;
  x: number;
  y: number;
  activeColumn: number;
  steps: CellData[][];
}

const LONG_PRESS_MS = 450;
const MOVE_THRESHOLD = 10;

const Cell = ({ stepToggle, openEditor, onCloseEditor, isEditing, x, y, activeColumn, steps }: CellProps) => {
  const cell = steps[x][y];
  const isOn = cell.on === 1;
  const isBeat = y % 4 === 0;
  const isActive = activeColumn === y;

  const boxRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isEditing) {
      onCloseEditor();
      return;
    }
    if (boxRef.current) openEditor(x, y, boxRef.current.getBoundingClientRect());
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    longPressFired.current = false;
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (isEditing) {
        onCloseEditor();
        return;
      }
      if (boxRef.current) openEditor(x, y, boxRef.current.getBoundingClientRect());
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) clearLongPress();
  };

  const onTouchEnd = () => {
    clearLongPress();
  };

  const onClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    stepToggle(x, y);
  };

  const innerClass = `inner${isOn ? ' inner--on' : isBeat ? ' inner--beat' : ''}${cell.prob < 1 ? ' inner--prob' : ''}`;
  const innerStyle = isOn ? ({ '--cell-velocity': cell.vel } as CSSProperties) : undefined;

  return (
    <div className={`box${isActive ? ' box--active' : ''}`} ref={boxRef}>
      <div
        className={innerClass}
        style={innerStyle}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      />
    </div>
  );
};

export default Cell;
