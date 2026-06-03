import * as React from 'react';
import { Icon } from './Icon.js';
import { cn } from '../lib/cn.js';
import styles from './CopyButton.module.css';

export function CopyButton({ value, label = 'copy', className }: {
  value: string; label?: string; className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    try { await navigator.clipboard.writeText(value); } catch {}
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" className={cn(styles.copyBtn, className)} onClick={onClick}>
      <Icon icon={copied ? 'eva:checkmark-outline' : 'eva:copy-outline'} />
      {copied ? 'copied' : label}
    </button>
  );
}
