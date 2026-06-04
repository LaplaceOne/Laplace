import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '@laplace-one/ui';
import { useSlot, useLaplaceContext } from '@laplace-one/sdk/react';
import type { Cluster } from '@laplace-one/registry';
import { env } from '../../env';
import { useIntentDetail } from '../../indexer/hooks';
import { useIntentActions } from './useIntentActions';
import { IntentDetailView } from './IntentDetailView';
import styles from './IntentDetail.module.css';

const CLUSTERS: Cluster[] = ['localnet', 'devnet', 'mainnet-beta'];

export default function PublicIntent() {
  const { pda } = useParams<{ pda: string }>();
  const [params] = useSearchParams();
  const queried = params.get('cluster');
  const cluster: Cluster =
    queried && (CLUSTERS as string[]).includes(queried) ? (queried as Cluster) : env.cluster;

  const slot = useSlot();
  const { signer } = useLaplaceContext() as { signer?: any };
  const { detail, refresh } = useIntentDetail(pda);
  const actions = useIntentActions(pda, refresh);

  return (
    <section className="wrap">
      <Link to="/app" className={styles.backLink}>
        <Icon icon="eva:arrow-back-outline" /> Open in console
      </Link>
      {!detail ? (
        <p>Loading…</p>
      ) : (
        <IntentDetailView
          view={detail.view}
          timeline={detail.timeline}
          slot={slot}
          cluster={cluster}
          signer={signer}
          actions={actions}
        />
      )}
    </section>
  );
}
