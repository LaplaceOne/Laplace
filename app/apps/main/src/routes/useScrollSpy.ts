import * as React from 'react';

export function useScrollSpy(ids: string[], rootMargin = '-40% 0px -55% 0px'): string {
  const [active, setActive] = React.useState(ids[0] ?? '');
  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin });
    const els = ids.map((id) => document.getElementById(id)).filter((x): x is HTMLElement => !!x);
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids.join(','), rootMargin]);
  return active;
}
