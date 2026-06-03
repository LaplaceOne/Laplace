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
        <RoleActionButton action={action} onAct={(k) => onAct(intent.pda, k)} />
      </div>
    </div>
  );
}

function shorten(a: string): string { return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a; }
