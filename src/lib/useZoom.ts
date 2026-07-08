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

    // Limit pan so the unit stays partially visible — bg coverage is never an issue
    // since parallax is only 5% and background-size handles the zoom effect.
    const bound = (tx: number, ty: number, _s: number): [number, number] => {
      const maxX = window.innerWidth  * 1.5;
      const maxY = window.innerHeight * 1.5;
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

    // ── Touch: single finger = pan, two fingers = pinch zoom ─────────────────
    let touchDrag: { ox: number; oy: number; tx0: number; ty0: number } | null = null;
    let pinchStart: { dist: number; scale0: number; mx: number; my: number } | null = null;

    const touchDist = (touches: TouchList): number => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent): void => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const tgt = t.target as HTMLElement;
        if (tgt.closest('button, input, select, [role="button"], .knob-svg, a')) return;
        e.preventDefault();
        pinchStart = null;
        touchDrag = { ox: t.clientX, oy: t.clientY, tx0: state.current.tx, ty0: state.current.ty };
      } else if (e.touches.length === 2) {
        e.preventDefault();
        touchDrag = null;
        pinchStart = {
          dist:   touchDist(e.touches),
          scale0: state.current.scale,
          mx:     (e.touches[0].clientX + e.touches[1].clientX) / 2,
          my:     (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };

    const onTouchMove = (e: TouchEvent): void => {
      e.preventDefault();
      if (e.touches.length === 1 && touchDrag) {
        const t = e.touches[0];
        const [tx, ty] = bound(
          touchDrag.tx0 + (t.clientX - touchDrag.ox),
          touchDrag.ty0 + (t.clientY - touchDrag.oy),
          state.current.scale,
        );
        state.current.tx = tx;
        state.current.ty = ty;
        commit(false);
      } else if (e.touches.length === 2 && pinchStart) {
        const newDist  = touchDist(e.touches);
        const newScale = Math.min(max, Math.max(min, pinchStart.scale0 * (newDist / pinchStart.dist)));
        const ratio    = newScale / state.current.scale;
        const rect     = el.getBoundingClientRect();
        const vcx      = rect.left + rect.width  / 2;
        const vcy      = rect.top  + rect.height / 2;
        const [newTx, newTy] = bound(
          state.current.tx + (pinchStart.mx - vcx) * (1 - ratio),
          state.current.ty + (pinchStart.my - vcy) * (1 - ratio),
          newScale,
        );
        state.current = { scale: newScale, tx: newTx, ty: newTy };
        commit(false);
      }
    };

    const onTouchEnd = (e: TouchEvent): void => {
      if (e.touches.length === 0) {
        touchDrag = null;
        pinchStart = null;
      } else if (e.touches.length === 1 && pinchStart) {
        // Dropped one finger from a pinch — transition to single-finger pan
        pinchStart = null;
        const t = e.touches[0];
        touchDrag = { ox: t.clientX, oy: t.clientY, tx0: state.current.tx, ty0: state.current.ty };
      }
    };

    window.addEventListener('wheel',       onWheel,      { passive: false });
    window.addEventListener('mousedown',   onMouseDown);
    window.addEventListener('mousemove',   onMouseMove);
    window.addEventListener('mouseup',     onMouseUp);
    window.addEventListener('touchstart',  onTouchStart, { passive: false });
    window.addEventListener('touchmove',   onTouchMove,  { passive: false });
    window.addEventListener('touchend',    onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('wheel',       onWheel);
      window.removeEventListener('mousedown',   onMouseDown);
      window.removeEventListener('mousemove',   onMouseMove);
      window.removeEventListener('mouseup',     onMouseUp);
      window.removeEventListener('touchstart',  onTouchStart);
      window.removeEventListener('touchmove',   onTouchMove);
      window.removeEventListener('touchend',    onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      document.body.style.cursor = '';
    };
  }, [target, min, max, initial]);
}
