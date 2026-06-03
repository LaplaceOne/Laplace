import * as React from 'react';
import { cn } from '../lib/cn.js';
import styles from './Button.module.css';

type Variant = 'default' | 'accent' | 'ghost';
type Size = 'default' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  as?: 'button' | 'a';
  href?: string;
}

export function Button({ variant = 'default', size = 'default', as = 'button', className, children, href, ...rest }: ButtonProps) {
  const cls = cn(styles.btn, styles[variant], size === 'lg' && styles.lg, className);
  if (as === 'a') return <a href={href} className={cls}>{children}</a>;
  return <button className={cls} {...rest}>{children}</button>;
}
