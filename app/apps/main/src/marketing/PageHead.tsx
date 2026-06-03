import * as React from 'react';
import { Eyebrow } from './Eyebrow';
import styles from './PageHead.module.css';

export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHead}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
