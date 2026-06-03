import * as React from 'react';
import { cn } from '../lib/cn.js';
import { useInView } from './useInView.js';
import styles from './Reveal.module.css';

export function Reveal({ children, as: As = 'div', className }: {
  children: React.ReactNode; as?: React.ElementType; className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <As ref={ref} className={cn(styles.reveal, inView && styles.in, className)}>
      {children}
    </As>
  );
}
