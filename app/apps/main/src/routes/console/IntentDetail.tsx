import { Link, useParams } from 'react-router-dom';
import { Icon } from '@laplace/ui';
import { useSlot, useLaplaceContext } from '@laplace/sdk/react';
import type { Cluster } from '@laplace/registry';
import { useIntentDetail } from '../../indexer/hooks';
import { useIntentActions } from './useIntentActions';
import { IntentDetailView } from './IntentDetailView';
import styles from './IntentDetail.module.css';

export default function IntentDetail() {
  const { pda } = useParams<{ pda: string }>();
  const slot = useSlot();
  const { signer, cluster } = useLaplaceContext() as { signer?: any; cluster: Cluster };
  const { detail, refresh } = useIntentDetail(pda);
  const actions = useIntentActions(pda, refresh);

  return (
    <section className="wrap">
      <Link to="/app" className={styles.backLink}>
        <Icon icon="eva:arrow-back-outline" /> Back to console
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
