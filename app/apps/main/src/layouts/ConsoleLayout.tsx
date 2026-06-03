import { Outlet, NavLink, Link } from 'react-router-dom';
import { CursorRing, ThemeToggle } from '@laplace/ui';
import { BrandMark } from '../components/BrandMark';
import { WalletButton } from '../wallet/WalletButton';
import { env } from '../env';
import styles from './ConsoleLayout.module.css';

const tabs = [
  { to: '/app', label: 'Console', end: true },
  { to: '/app/create', label: 'Create' },
  { to: '/app/manual', label: 'Manual' },
];

export function ConsoleLayout() {
  return (
    <>
      <CursorRing />
      <header className={styles.appbar}>
        <div className={styles.appbarInner}>
          <Link to="/" className={styles.brand}>
            <BrandMark className={styles.mark} size={28} />
            Laplace
            <span className={styles.sub}>DEVNET</span>
          </Link>
          <nav className={styles.appTabs}>
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  isActive ? `${styles.appTab} ${styles.active}` : styles.appTab
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className={styles.appbarRight}>
            <span className={styles.clusterBadge}>
              <span className={styles.dot} />
              {env.cluster}
            </span>
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
