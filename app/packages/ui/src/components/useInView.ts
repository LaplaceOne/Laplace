import * as React from 'react';

export function useInView<T extends HTMLElement>(threshold = 0.12) {
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setInView(true); io.unobserve(e.target); }
      }
    }, { threshold });
    io.observe(el);
    const fallback = setTimeout(() => setInView(true), 1400);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, [threshold]);

  return { ref, inView };
}
