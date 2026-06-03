import { BrandMark } from './BrandMark';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="wrap">
        <div className={styles.footGrid}>
          <div>
            <a className={styles.brand} href="/" style={{ textDecoration: 'none', marginBottom: '16px' }}>
              <BrandMark size={28} />
              {' '}Laplace
            </a>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '25em', lineHeight: 1.6 }}>
              Intent-based atomic settlement on Solana. Devnet · SOL + SPL · hashlock &amp; validity criteria.
            </p>
          </div>
          <div>
            <h4>Docs</h4>
            <a href="/docs#lifecycle">Lifecycle</a>
            <a href="/docs#interface">Criterion interface</a>
            <a href="/docs#hashlock">Hashlock</a>
            <a href="/docs#validity">Validity</a>
          </div>
          <div>
            <h4>Build</h4>
            <a href="/docs#quickstart">SDK quickstart</a>
            <a href="/docs#programs">Program IDs</a>
            <a href="/registry">Registry</a>
            <a href="https://github.com/LaplaceOne/Laplace" target="_blank" rel="noopener">GitHub</a>
          </div>
          <div>
            <h4>Products</h4>
            <a href="/lab">Laplace Lab</a>
            <a href="/app">Main site &amp; console</a>
            <a href="/lab#products">Laplace Bridge</a>
            <a href="/lab#products">Laplace Disclosure</a>
          </div>
        </div>
        <div className={styles.footBottom}>
          <span>© 2026 laplace protocol</span>
          <span>devnet · SOL + SPL</span>
        </div>
      </div>
    </footer>
  );
}
