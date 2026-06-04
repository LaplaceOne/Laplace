import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { IntentCard, viewEffectiveStatus, type EffectiveStatus } from '@laplace-one/ui';
import { useSlot } from '@laplace-one/sdk/react';
import { useWallet } from '../../wallet/WalletProvider';
import { useIntentList, useStats } from '../../indexer/hooks';
import { criterionLabel } from '../../intent/criterionLabel';
import { env } from '../../env';
import styles from './Dashboard.module.css';

type Role = 'all' | 'maker' | 'receiver' | 'refund';
const ROLES: Array<{ k: Role; label: string }> = [
  { k: 'all', label: 'All' }, { k: 'maker', label: 'Made by me' },
  { k: 'receiver', label: 'To me' }, { k: 'refund', label: 'Refundable by me' },
];
const CHIPS: Array<EffectiveStatus | 'All'> = ['All', 'Active', 'Expiring soon', 'Fulfilled', 'Refunded', 'Closed'];

export default function Dashboard() {
  const nav = useNavigate();
  const slot = useSlot();
  const { selectedAccount } = useWallet();
  const wallet = selectedAccount?.address;
  const [role, setRole] = React.useState<Role>('all');
  const [chip, setChip] = React.useState<EffectiveStatus | 'All'>('All');
  const stats = useStats();
  const { data, loading } = useIntentList({ role });

  const shown = data.filter((v) => chip === 'All' || viewEffectiveStatus(v, slot) === chip);

  return (
    <div className="wrap">
      <div className={styles.head}>
        <div><h1>Console</h1><p>Your intents across the protocol on {env.cluster}.</p></div>
      </div>

      <div className={styles.statstrip}>
        <Stat k="Intents" v={stats ? String(stats.total) : '—'} />
        <Stat k="Active" v={stats ? String(stats.byStatus.active) : '—'} />
        <Stat k="Fulfilled" v={stats ? String(stats.byStatus.fulfilled) : '—'} />
        <Stat k="Refunded" v={stats ? String(stats.byStatus.refunded) : '—'} />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented}>
          {ROLES.map((r) => (
            <button key={r.k} className={role === r.k ? styles.active : undefined} onClick={() => setRole(r.k)}>{r.label}</button>
          ))}
        </div>
        <div className={styles.chips}>
          {CHIPS.map((c) => (
            <button key={c} className={`${styles.chip} ${chip === c ? styles.chipActive : ''}`} onClick={() => setChip(c)}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? <p>Loading…</p> : shown.length === 0 ? (
        <div className={styles.empty}>
          <h3>No intents here yet</h3>
          <p>Create your first intent to get started.</p>
          <button className="btn btn--accent" onClick={() => nav('/app/create')}>Create intent</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {shown.map((v) => (
            <IntentCard key={v.pda} intent={v} currentSlot={slot} wallet={wallet}
              criterionLabel={criterionLabel(v.criterionProgram, env.cluster).name}
              onOpen={(pda) => nav(`/app/intent/${pda}`)}
              onAct={(pda) => nav(`/app/intent/${pda}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className={styles.stat}><div className={styles.k}>{k}</div><div className={styles.v}>{v}</div></div>;
}
