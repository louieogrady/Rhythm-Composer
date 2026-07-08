import { useRef } from 'react';

interface SlotButtonProps {
  index: number;
  filled: boolean;
  active: boolean;
  onClick: (i: number) => void;
  onMenu: (i: number, rect: DOMRect) => void;
}

const LONG_PRESS_MS = 450;
const MOVE_THRESHOLD = 10;

const SlotButton = ({ index, filled, active, onClick, onMenu }: SlotButtonProps) => {
  const btnRef = useRef<HTMLButtonElement>(null);
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
    if (filled && btnRef.current) {
      onMenu(index, btnRef.current.getBoundingClientRect());
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    longPressFired.current = false;
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (filled && btnRef.current) {
        onMenu(index, btnRef.current.getBoundingClientRect());
      }
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

  const handleClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onClick(index);
  };

  let className = 'slot';
  if (filled) className += ' slot--filled';
  if (active) className += ' slot--active';

  return (
    <button
      ref={btnRef}
      className={className}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <span>{index + 1}</span>
    </button>
  );
};

export default SlotButton;
