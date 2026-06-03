import { useNavigate } from 'react-router-dom';
import { IntentCard } from '@laplace/ui';
import { useSlot } from '@laplace/sdk/react';
import { useWallet } from '../../wallet/WalletProvider';
import { useIntentList, useStats } from '../../indexer/hooks';

export default function Dashboard() {
  const nav = useNavigate();
  const slot = useSlot();
  const { selectedAccount } = useWallet();
  const stats = useStats();
  const { data, loading } = useIntentList({ role: 'all' });
  const wallet = selectedAccount?.address;

  return (
    <section className="wrap">
      <h1>Console</h1>
      {stats && <p className="mono">active {stats.byStatus.active} · fulfilled {stats.byStatus.fulfilled} · refunded {stats.byStatus.refunded} · total {stats.total}</p>}
      {loading ? <p>Loading…</p> : data.length === 0 ? <p>No intents yet.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {data.map((v) => (
            <IntentCard key={v.pda} intent={v} currentSlot={slot} wallet={wallet}
              criterionLabel="criterion" onOpen={(pda) => nav(`/app/intent/${pda}`)} onAct={() => {}} />
          ))}
        </div>
      )}
    </section>
  );
}
