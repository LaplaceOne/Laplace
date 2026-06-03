import * as React from 'react';
import styles from './Cta.module.css';

export function Cta({
  title,
  sub,
  buttons,
}: {
  title: React.ReactNode;
  sub: React.ReactNode;
  buttons: React.ReactNode;
}) {
  return (
    <section className={styles.cta}>
      <div className="wrap">
        <div className={styles.ctaLine} />
        <h2>{title}</h2>
        <p>{sub}</p>
        <div className={styles.ctaBtns}>{buttons}</div>
      </div>
    </section>
  );
}
