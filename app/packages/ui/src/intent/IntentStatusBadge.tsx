import { cn } from '../lib/cn.js';
import type { EffectiveStatus } from './IntentView.js';
import styles from './IntentStatusBadge.module.css';

const cls: Record<EffectiveStatus, string | undefined> = {
  'Active': styles.active, 'Expiring soon': styles.expiring,
  'Fulfilled': styles.fulfilled, 'Refunded': styles.refunded, 'Closed': styles.closed,
};

export function IntentStatusBadge({ status }: { status: EffectiveStatus }) {
  return <span className={cn(styles.sbadge, cls[status])}><span className={styles.sd} />{status}</span>;
}
