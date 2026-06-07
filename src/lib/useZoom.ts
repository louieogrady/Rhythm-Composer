import { useEffect, useRef } from 'react';

export interface ZoomOptions {
  initial?: number;    // default 0.8
  min?: number;        // default 0.5
  max?: number;        // default 2.0
  onTransform?: (s: number, tx: number, ty: number) => void;
}

interface State { scale: number; tx: number; ty: number; }

export function useZoom(
  target: React.RefObject<HTMLElement>,
  options?: ZoomOptions
): void {
  const { initial = 0.8, min = 0.5, max = 2 } = options ?? {};
  const onTransformRef = useRef(options?.onTransform);
  onTransformRef.current = options?.onTransform;

  const state = useRef<State>({ scale: initial, tx: 0, ty: 0 });

  useEffect(() => {
    const el = target.current;
    if (!el) return;

    // Keep bg-layer (200% sized, 0.9 parallax) covering the viewport at all times.
    // Derived: |bgTx| ≤ vw × (bgScale − 0.5)  where bgTx = tx × 0.9
    const bound = (tx: number, ty: number, s: number): [number, number] => {
      const bgS  = 1 + (s - 1) * 0.9;
      const maxX = window.innerWidth  * (bgS - 0.5) / 0.9;
      const maxY = window.innerHeight * (bgS - 0.5) / 0.9;
      return [Math.max(-maxX, Math.min(maxX, tx)), Math.max(-maxY, Math.min(maxY, ty))];
    };

    const commit = (animated: boolean): void => {
      const { scale, tx, ty } = state.current;
      el.style.transition      = animated ? 'transform 120ms ease-out' : 'none';
      el.style.transformOrigin = '50% 50%';
      el.style.transform       = `translate(${tx}px, ${ty}px) scale(${scale})`;
      onTransformRef.current?.(scale, tx, ty);
    };

    commit(false);

    // ── Zoom: Ctrl+scroll anywhere on window ──────────────────────────────────
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      const { scale, tx, ty } = state.current;
      const rect     = el.getBoundingClientRect();
      const vcx      = rect.left + rect.width  / 2;
      const vcy      = rect.top  + rect.height / 2;

      // Proportional exponential delta — smooth on both trackpad and mouse wheel
      const pixels   = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const clamped  = Math.max(-300, Math.min(300, pixels));
      const newScale = Math.min(max, Math.max(min, scale * Math.pow(0.999, clamped)));
      const ratio    = newScale / scale;

      const [newTx, newTy] = bound(
        tx + (e.clientX - vcx) * (1 - ratio),
        ty + (e.clientY - vcy) * (1 - ratio),
        newScale,
      );
      state.current = { scale: newScale, tx: newTx, ty: newTy };
      commit(true);
    };

    // ── Pan: left-button drag anywhere except interactive controls ────────────
    let drag: { ox: number; oy: number; tx0: number; ty0: number } | null = null;

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      if (t.closest('button, input, select, [role="button"], .knob-svg, a')) return;
      e.preventDefault();
      drag = { ox: e.clientX, oy: e.clientY, tx0: state.current.tx, ty0: state.current.ty };
      document.body.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent): void => {
      if (!drag) return;
      const [tx, ty] = bound(
        drag.tx0 + (e.clientX - drag.ox),
        drag.ty0 + (e.clientY - drag.oy),
        state.current.scale,
      );
      state.current.tx = tx;
      state.current.ty = ty;
      commit(false);
    };

    const onMouseUp = (): void => {
      if (!drag) return;
      drag = null;
      document.body.style.cursor = '';
    };

    window.addEventListener('wheel',     onWheel,     { passive: false });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    return () => {
      window.removeEventListener('wheel',     onWheel);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      document.body.style.cursor = '';
    };
  }, [target, min, max, initial]);
}
