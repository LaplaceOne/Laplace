import * as React from 'react';
import styles from './SecHead.module.css';

export function SecHead({
  label,
  title,
  sub,
}: {
  label: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className={styles.secHead}>
      <div>
        <span className={`${styles.label} label`}>{label}</span>
        <h2 className={styles.secTitle}>{title}</h2>
      </div>
      {sub && <p className={styles.secSub}>{sub}</p>}
    </div>
  );
}
