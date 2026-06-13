import { useState, useEffect, useRef, useId } from 'react';

interface KnobProps {
  min?: number;
  max?: number;
  value?: number;
  defaultValue?: number;
  label?: string;
  unit?: string;
  onChange?: (v: number) => void;
  onCommit?: (v: number) => void;
  sensitivity?: number;
}

interface DragState {
  startY: number;
  startVal: number;
  lastVal?: number;
}

const RANGE_DEG = 270;
const START_DEG = -135;

const fmtVal = (v: number, min: number, max: number): string => {
  const range = max - min;
  if (range >= 10) return String(Math.round(v));
  if (range >= 1)  return v.toFixed(1);
  return v.toFixed(2);
};

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arc = (cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string => {
  const s = polar(cx, cy, r, fromDeg);
  const e = polar(cx, cy, r, toDeg);
  const span = ((toDeg - fromDeg) + 360) % 360;
  const large = span > 180 ? 1 : 0;
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
};

export const Knob = ({
  min = 0,
  max = 1,
  value,
  defaultValue,
  label,
  unit = '',
  onChange,
  onCommit,
  sensitivity,
}: KnobProps) => {
  const init = value ?? defaultValue ?? min;
  const [internal, setInternal] = useState(init);
  const drag = useRef<DragState | null>(null);
  const uid = useId();
  const bodyGradId = `knobBody${uid}`;

  useEffect(() => {
    if (value !== undefined) setInternal(value);
  }, [value]);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const valueToDeg = (v: number) => START_DEG + ((v - min) / (max - min)) * RANGE_DEG;

  const angle = valueToDeg(internal);
  const endAngle = START_DEG + RANGE_DEG;
  const cx = 50, cy = 50;
  const bodyR = 36;
  const trackR = 44;
  const indicatorR = 27;
  const indRad = ((angle - 90) * Math.PI) / 180;

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startVal: internal };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const sens = sensitivity ?? (max - min) / 160;
    const delta = (drag.current.startY - e.clientY) * sens;
    const next = clamp(drag.current.startVal + delta);
    drag.current.lastVal = next;
    setInternal(next);
    onChange?.(next);
  };

  const onPointerUp = () => {
    if (drag.current) {
      onCommit?.(drag.current.lastVal ?? drag.current.startVal);
      drag.current = null;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const step = (max - min) / 100;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      const next = clamp(internal + step);
      setInternal(next);
      onChange?.(next);
      onCommit?.(next);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      const next = clamp(internal - step);
      setInternal(next);
      onChange?.(next);
      onCommit?.(next);
    }
  };

  const hasActiveArc = angle > START_DEG;
  const displayVal = fmtVal(internal, min, max) + unit;
  const valFontSize = displayVal.length <= 3 ? 15 : 12;

  return (
    <div className="knob-wrapper">
      <svg
        viewBox="0 0 100 100"
        className="knob-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(internal * 100) / 100}
        aria-label={label}
      >
        <defs>
          <radialGradient id={bodyGradId} cx="35%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#b4b2af" />
            <stop offset="45%" stopColor="#7e7c79" />
            <stop offset="100%" stopColor="#4a4844" />
          </radialGradient>
        </defs>
        <path
          d={arc(cx, cy, trackR, START_DEG, endAngle)}
          fill="none"
          stroke="#85837f"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {hasActiveArc && (
          <path
            d={arc(cx, cy, trackR, START_DEG, angle)}
            fill="none"
            stroke="#c86050"
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}
        <circle cx={cx} cy={cy + 1.5} r={bodyR} fill="rgba(0,0,0,0.35)" />
        <circle cx={cx} cy={cy} r={bodyR} fill={`url(#${bodyGradId})`} />
        <circle cx={cx} cy={cy} r={bodyR} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
        <line
          x1={cx}
          y1={cy}
          x2={(cx + indicatorR * Math.cos(indRad)).toFixed(3)}
          y2={(cy + indicatorR * Math.sin(indRad)).toFixed(3)}
          stroke="#c86050"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={3.5} fill="#c86050" />
        <text
          x={cx}
          y={cy + 15}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#1a1816"
          fontSize={valFontSize}
          fontFamily="monospace"
          pointerEvents="none"
        >
          {displayVal}
        </text>
      </svg>
      {label && <span className="knob-label">{label}</span>}
    </div>
  );
};
