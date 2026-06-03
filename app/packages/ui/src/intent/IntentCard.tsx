import { Icon } from '../components/Icon.js';
import { AssetAmount } from './AssetAmount.js';
import { IntentStatusBadge } from './IntentStatusBadge.js';
import { ExpiryCountdown } from './ExpiryCountdown.js';
import { RoleActionButton } from './RoleActionButton.js';
import { viewEffectiveStatus, viewActionFor, type IntentView, type RoleActionKind } from './IntentView.js';
import styles from './IntentCard.module.css';

export function IntentCard({ intent, currentSlot, wallet, criterionLabel, onOpen, onAct }: {
  intent: IntentView; currentSlot: bigint; wallet?: string; criterionLabel: string;
  onOpen: (pda: string) => void; onAct: (pda: string, kind: RoleActionKind) => void;
}) {
  const status = viewEffectiveStatus(intent, currentSlot);
  const action = viewActionFor(intent, { wallet, currentSlot });
  // Only surface an action this wallet can take — an enabled action, or a connect-wallet nudge.
  // Role-mismatch buttons (e.g. "Close" shown to a non-maker, "Fulfill" to a non-receiver) are just
  // noise on a card, so they are hidden; the detail view still explains who may act.
  const showAction = action.enabled || action.reason === 'Connect wallet';
  return (
    <div className={styles.icard} onClick={() => onOpen(intent.pda)} role="button" tabIndex={0}>
      <div className={styles.top}>
        <div className={styles.amt}><AssetAmount amount={intent.amount} asset={intent.asset} /></div>
        <IntentStatusBadge status={status} />
      </div>
      <span className={styles.crit}><Icon icon="eva:shield-outline" />{criterionLabel}</span>
      <div className={styles.row}><span className={styles.lbl}>Receiver</span><span className={styles.val}>{shorten(intent.receiver)}</span></div>
      <div className={styles.foot}>
        <ExpiryCountdown expirySlot={intent.expirySlot} currentSlot={currentSlot} />
        {showAction && <RoleActionButton action={action} onAct={(k) => onAct(intent.pda, k)} />}
      </div>
    </div>
  );
}

function shorten(a: string): string { return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a; }
