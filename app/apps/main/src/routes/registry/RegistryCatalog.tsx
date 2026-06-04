import * as React from 'react';
import { criteria, guests, type TrustTier } from '@laplace-one/registry';
import { Icon } from '@laplace-one/ui';
import { env } from '../../env';
import styles from './RegistryCatalog.module.css';

type Tab = 'criteria' | 'guests';
const TIERS: Array<TrustTier | 'all'> = ['all', 'official', 'audited', 'community', 'unverified'];

export function RegistryCatalog() {
  const [tab, setTab] = React.useState<Tab>('criteria');
  const [tier, setTier] = React.useState<TrustTier | 'all'>('all');

  const items = tab === 'criteria' ? criteria : guests;
  const filtered = items.filter((it) => tier === 'all' || it.tier === tier);

  return (
    <section id="catalog-sec" className={styles.catalogSec}>
      <div className={styles.tabs}>
        <button
          className={tab === 'criteria' ? styles.active : undefined}
          onClick={() => { setTab('criteria'); setTier('all'); }}
        >
          Criteria
        </button>
        <button
          className={tab === 'guests' ? styles.active : undefined}
          onClick={() => { setTab('guests'); setTier('all'); }}
        >
          Validity guests
        </button>
      </div>
      <div className={styles.toolbar}>
        <span className={styles.hint}>
          {tab === 'criteria'
            ? 'Deployed Solana programs that plug into the verify_criterion interface.'
            : 'SP1 guest programs whose proofs the validity criterion verifies.'}
        </span>
        <div className={styles.filters}>
          {TIERS.map((t) => (
            <button
              key={t}
              className={tier === t ? styles.active : undefined}
              onClick={() => setTier(t)}
            >
              {t === 'all' ? 'All tiers' : t}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.catalog}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Icon icon="eva:cube-outline" />
            <p>None yet — this catalog tracks real on-chain entries.</p>
          </div>
        ) : (
          filtered.map((it: any) => (
            <CatalogCard key={it.key} item={it} cluster={env.cluster} />
          ))
        )}
      </div>
    </section>
  );
}

function CatalogCard({ item, cluster }: { item: any; cluster: string }) {
  const [open, setOpen] = React.useState(false);
  const pid = item.programId?.[cluster];
  return (
    <div className={`${styles.rcard}${open ? ' ' + styles.open : ''}`}>
      <button
        className={styles.rcardHead}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={styles.rcardLeft}>
          <span className={styles.rname}>{item.name ?? item.key}</span>
          <span className={styles.rcardSub}>{item.kind ?? ''}</span>
        </span>
        <span className={styles.rcardRight}>
          <span className={`${styles.tier} ${styles[item.tier as string] ?? ''}`}>
            <span className={styles.tdot} />
            {item.tier}
          </span>
          {pid && <span className={styles.rpid}>{pid.slice(0, 4)}…{pid.slice(-4)}</span>}
          <Icon icon="eva:chevron-down-outline" className={styles.chev} />
        </span>
      </button>
      {open && (
        <div className={styles.rcardBody}>
          <p>{item.desc ?? item.statement ?? '—'}</p>
          {item.commitment && (
            <div className={styles.kv}>
              <span>Commitment</span>
              <code>{item.commitment}</code>
            </div>
          )}
          {item.fulfillmentKind && (
            <div className={styles.kv}>
              <span>Fulfillment</span>
              <code>{item.fulfillmentKind}</code>
            </div>
          )}
          {pid && (
            <div className={styles.kv}>
              <span>Program ID ({cluster})</span>
              <code>{pid}</code>
            </div>
          )}
          {item.docsUrl && (
            <a href={item.docsUrl} target="_blank" rel="noopener">
              Docs →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
