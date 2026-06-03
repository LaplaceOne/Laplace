import { Link, NavLink } from 'react-router-dom';
import { ThemeToggle, Button } from '@laplace/ui';
import { BrandMark } from './BrandMark';
import styles from './Nav.module.css';

const links = [
  { to: '/docs', label: 'Docs' },
  { to: '/lab', label: 'Lab' },
  { to: '/registry', label: 'Registry' },
];

export function Nav() {
  return (
    <nav className={styles.nav}>
      <div className="wrap">
        <div className={styles.inner}>
          <Link to="/" className={styles.brand}><BrandMark className={styles.mark} /> Laplace</Link>
          <div className={styles.links}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className={styles.right}>
            <ThemeToggle />
            <Button as="a" href="/app" variant="accent">Launch console</Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
