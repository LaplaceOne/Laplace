import { cn } from '../lib/cn.js';
import styles from './ExpiryCountdown.module.css';

const MS_PER_SLOT = 400;

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function ExpiryCountdown({ expirySlot, currentSlot }: { expirySlot: bigint; currentSlot: bigint }) {
  if (currentSlot >= expirySlot) return <span className={cn(styles.countdown, styles.past)}>Expired</span>;
  const remainingMs = Number(expirySlot - currentSlot) * MS_PER_SLOT;
  const urgent = remainingMs <= 15 * 60 * 1000;
  return <span className={cn(styles.countdown, urgent && styles.urgent)}>{fmt(remainingMs)}</span>;
}
