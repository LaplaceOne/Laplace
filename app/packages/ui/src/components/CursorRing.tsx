import * as React from 'react';
import { cn } from '../lib/cn.js';
import styles from './CursorRing.module.css';

// Interactive selectors that grow/fill the ring (the `.hot` state).
const HOT =
  'a, button, input, select, textarea, .theme-toggle, [data-copy], [role="button"]';

/**
 * Accent-ring cursor — a faithful port of the design-reference `laplace.js`
 * `initCursor`. The real cursor stays for hit accuracy; this draws an extra
 * brand-blue ring (lerped via rAF) plus a small dot that tracks the pointer
 * instantly. Rendered ONLY for fine pointers (mouse/pen) — skipped on touch.
 * `.hot` grows/fills the ring over interactive elements; `.tap` shrinks it on
 * pointerdown. Reduced-motion aware (no rAF easing, no size transition — the
 * ring snaps to the pointer). Cleanup removes every listener and cancels rAF.
 */
export function CursorRing() {
  const ringRef = React.useRef<HTMLDivElement>(null);
  const dotRef = React.useRef<HTMLDivElement>(null);
  // Fine pointer only (mouse/pen) — decide once at mount so coarse pointers
  // render nothing at all.
  const [fine] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: fine)').matches,
  );

  React.useEffect(() => {
    if (!fine) return;
    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let tx = -50;
    let ty = -50; // pointer target
    let rx = -50;
    let ry = -50; // smoothed ring position
    let shown = false;

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      tx = e.clientX;
      ty = e.clientY;
      dot.style.transform = `translate3d(${tx}px,${ty}px,0) translate(-50%,-50%)`;
      if (!shown) {
        shown = true;
        ring.style.opacity = '1';
        dot.style.opacity = '1';
      }
      // Reduced motion: snap the ring to the pointer (no rAF lerp).
      if (reduce) {
        ring.style.transform = `translate3d(${tx}px,${ty}px,0) translate(-50%,-50%)`;
      }
      const target = e.target;
      const over =
        target instanceof Element && target.closest ? target.closest(HOT) : null;
      ring.classList.toggle(styles.hot, !!over);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') ring.classList.add(styles.tap);
    };
    const onPointerUp = () => {
      ring.classList.remove(styles.tap);
    };

    const hide = () => {
      ring.style.opacity = '0';
      dot.style.opacity = '0';
      shown = false;
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) hide();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('mouseleave', hide);
    document.addEventListener('mouseout', onMouseOut);
    window.addEventListener('blur', hide);

    let raf: number | null = null;
    if (!reduce) {
      const loop = () => {
        rx += (tx - rx) * 0.18;
        ry += (ty - ry) * 0.18;
        ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('mouseleave', hide);
      document.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('blur', hide);
    };
  }, [fine]);

  if (!fine) return null;

  return (
    <>
      <div
        ref={ringRef}
        data-cursor-ring=""
        className={cn(styles.ring)}
        aria-hidden="true"
      />
      <div ref={dotRef} className={cn(styles.dot)} aria-hidden="true" />
    </>
  );
}
