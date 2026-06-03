import { cn } from '../lib/cn.js';
import styles from './CodeBlock.module.css';

export function CodeBlock({ filename, children, className }: {
  filename?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn(styles.code, className)}>
      <div className={styles.bar}>
        {filename && <span className="label">{filename}</span>}
        <div className={styles.dotrow}><i /><i /><i /></div>
      </div>
      <pre className={styles.body}>{children}</pre>
    </div>
  );
}
