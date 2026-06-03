import * as React from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'laplace-theme';

interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void; }
const Ctx = React.createContext<ThemeCtx | null>(null);

function readInitial(): Theme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(readInitial);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const value = React.useMemo<ThemeCtx>(() => ({
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((t) => (t === 'light' ? 'dark' : 'light')),
  }), [theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
