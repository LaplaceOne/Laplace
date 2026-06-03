import { Icon } from './Icon.js';
import styles from './ArrowLink.module.css';

export function ArrowLink({ href, children, icon = 'eva:arrow-forward-outline', target }: {
  href: string; children: React.ReactNode; icon?: string; target?: string;
}) {
  return (
    <a href={href} className={styles.arrowLink} target={target} rel={target === '_blank' ? 'noopener' : undefined}>
      {children}
      <Icon icon={icon} />
    </a>
  );
}
