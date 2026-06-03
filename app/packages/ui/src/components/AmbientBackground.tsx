import * as React from 'react';
import styles from './AmbientBackground.module.css';

/**
 * Ambient animated background — a faithful port of the design-reference
 * `styles/bg.js` flow-field. A grid of hairline segments (a nod to the
 * Laplace operator on a field) whose angle is driven by a layered sin/cos
 * flow-field, with a magnetic pointer: nearby segments bend radially toward
 * the cursor with a gaussian falloff. Two slow-drifting brand glows are CSS.
 * Reduced-motion aware (single static frame, no pointer listeners); pauses
 * when the tab is hidden; resize debounced; re-reads --primary-solid on
 * theme change via a MutationObserver.
 */
export function AmbientBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return; // no-op under jsdom (getContext null)

    let W = 0;
    let H = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // grid + look
    const SP = 38; // grid spacing
    const LEN = 12; // base half-length of a segment
    const R = 230; // magnetic radius (px)
    let rgb = '80,120,200';
    let baseA = 0.15;
    const lineW = 1.4;

    // magnetic pointer state (viewport coords; canvas is fixed)
    let mTX = -9999;
    let mTY = -9999; // target
    let mX = -9999;
    let mY = -9999; // smoothed
    let strength = 0; // eases 0..1 with presence
    let present = 0; // 1 while pointer over page

    function toRgb(c: string): string {
      if (c.indexOf('rgb') === 0) {
        const m = c.match(/[\d.]+/g);
        return m
          ? Math.round(Number(m[0])) + ',' + Math.round(Number(m[1])) + ',' + Math.round(Number(m[2]))
          : '80,120,200';
      }
      let h = c.replace('#', '');
      if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
      const n = parseInt(h, 16);
      return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
    }

    function readColor() {
      const cs = getComputedStyle(document.documentElement);
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      rgb = toRgb((cs.getPropertyValue('--primary-solid') || '#2f7ce0').trim());
      baseA = dark ? 0.22 : 0.15;
    }

    function resize() {
      if (!ctx) return;
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = W + 'px';
      canvas!.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColor();
      if (reduce) draw(0);
    }

    function draw(t: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = lineW;
      ctx.lineCap = 'round';

      // ease pointer follow + presence
      strength += ((present ? 1 : 0) - strength) * 0.07;
      if (present) {
        mX += (mTX - mX) * 0.16;
        mY += (mTY - mY) * 0.16;
      }
      const active = strength > 0.01;
      const R2 = R * R;

      // base pass — single batched path; the cursor only bends direction
      // (no brightness/length change)
      ctx.strokeStyle = 'rgba(' + rgb + ',' + baseA + ')';
      ctx.beginPath();
      for (let x = SP / 2; x < W; x += SP) {
        for (let y = SP / 2; y < H; y += SP) {
          let fa =
            Math.sin(x * 0.0016 + t * 0.00018) +
            Math.cos(y * 0.0018 - t * 0.00015) +
            Math.sin((x + y) * 0.0011 + t * 0.00012);
          fa *= 1.7;
          let ang = fa;

          if (active) {
            const dxm = x - mX;
            const dym = y - mY;
            const d2 = dxm * dxm + dym * dym;
            const w = Math.exp(-d2 / R2) * strength;
            if (w > 0.01) {
              const mag = Math.atan2(dym, dxm); // pure radial pole — points at the cursor, no swirl
              const bx = Math.cos(fa) * (1 - w) + Math.cos(mag) * w;
              const by = Math.sin(fa) * (1 - w) + Math.sin(mag) * w;
              ang = Math.atan2(by, bx);
            }
          }

          const ex = Math.cos(ang) * LEN;
          const ey = Math.sin(ang) * LEN;
          ctx.moveTo(x - ex, y - ey);
          ctx.lineTo(x + ex, y + ey);
        }
      }
      ctx.stroke();
    }

    let raf: number | null = null;
    let running = true;
    function loop(now: number) {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (reduce) {
        draw(0);
        return;
      }
      if (raf) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    // pointer (mouse / pen / touch) — covers magnetic interaction
    const onPointerMove = (e: PointerEvent) => {
      mTX = e.clientX;
      mTY = e.clientY;
      present = 1;
      if (mX < -9000) {
        mX = mTX;
        mY = mTY;
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      mTX = e.clientX;
      mTY = e.clientY;
      present = 1;
    };
    const leave = () => {
      present = 0;
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) leave();
    };

    if (!reduce) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerdown', onPointerDown, { passive: true });
      document.addEventListener('mouseleave', leave);
      document.addEventListener('pointerleave', leave);
      document.addEventListener('pointercancel', leave);
      window.addEventListener('blur', leave);
      document.addEventListener('mouseout', onMouseOut);
    }

    let rt: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(resize, 150);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    const observer = new MutationObserver(readColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    resize();
    start();

    return () => {
      stop();
      clearTimeout(rt);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (!reduce) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('mouseleave', leave);
        document.removeEventListener('pointerleave', leave);
        document.removeEventListener('pointercancel', leave);
        window.removeEventListener('blur', leave);
        document.removeEventListener('mouseout', onMouseOut);
      }
    };
  }, []);

  return (
    <>
      <div className={styles.glows} aria-hidden="true">
        <div className={`${styles.g} ${styles.g1}`} />
        <div className={`${styles.g} ${styles.g2}`} />
      </div>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </>
  );
}
