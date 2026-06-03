import * as React from 'react';
import { Icon } from '../components/Icon.js';
import { cn } from '../lib/cn.js';
import styles from './Toast.module.css';

type ToastKind = 'success' | 'error' | 'info';
interface ToastState { msg: string; kind: ToastKind; id: number }
interface ToastCtx { toast: (msg: string, kind?: ToastKind) => void }

const Ctx = React.createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = React.useState<ToastState | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = React.useCallback((msg: string, kind: ToastKind = 'success') => {
    setT({ msg, kind, id: (t?.id ?? 0) + 1 });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 2600);
  }, [t?.id]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className={cn(styles.toast, t && styles.show)} role="status" aria-live="polite">
        {t && <><Icon icon={t.kind === 'error' ? 'eva:alert-circle-outline' : 'eva:checkmark-circle-2-outline'} />{t.msg}</>}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = React.useContext(Ctx);
  if (!c) throw new Error('useToast must be used within <ToastProvider>');
  return c;
}
