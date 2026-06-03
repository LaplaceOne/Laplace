import { cn } from '../lib/cn.js';
import type { RoleAction, RoleActionKind } from './IntentView.js';
import styles from './RoleActionButton.module.css';

export function RoleActionButton({ action, onAct, variant }: {
  action: RoleAction; onAct: (kind: RoleActionKind) => void; variant?: 'ghost' | 'neutral';
}) {
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={cn(styles.actBtn, variant === 'ghost' && styles.ghost, variant === 'neutral' && styles.neutral)}
        disabled={!action.enabled || action.kind === 'none'}
        onClick={() => action.enabled && onAct(action.kind)}
      >
        {action.label}
      </button>
      {action.reason && <span className={styles.note}>{action.reason}</span>}
    </div>
  );
}
