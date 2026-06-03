import * as React from 'react';
import styles from './Eyebrow.module.css';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className={styles.eyebrow}><span className={styles.tick} />{children}</span>;
}
