import * as React from 'react';
import {
  AssetAmount,
  CopyButton,
  Icon,
  IntentStatusBadge,
  viewActionFor,
  viewEffectiveStatus,
  type IntentView,
} from '@laplace/ui';
import { intentShareLink } from '@laplace/sdk';
import { getCluster, type Cluster } from '@laplace/registry';
import type { TransactionSigner } from '@solana/kit';
import { criterionLabel } from '../../intent/criterionLabel';
import type { IntentTimelineItem } from '../../indexer/indexerClient';
import type { useIntentActions } from './useIntentActions';
import styles from './IntentDetail.module.css';

type Actions = ReturnType<typeof useIntentActions>;

function explorerTxUrl(signature: string, cluster: Cluster): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

function shortPid(pid: string): string {
  return `${pid.slice(0, 4)}…${pid.slice(-4)}`;
}

/** Parse a hex (with or without 0x) or base58 string into bytes. */
function preimageToBytes(input: string): Uint8Array {
  const s = input.trim().replace(/^0x/i, '');
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    const m = s.match(/.{1,2}/g) ?? [];
    return Uint8Array.from(m.map((b) => parseInt(b, 16)));
  }
  // base58 fallback
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = 0n;
  for (const ch of s) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('invalid base58 character');
    num = num * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
  for (const ch of s) { if (ch === '1') bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}

/** Read a proof file as bytes — accepts a raw binary proof (.bin) or a hex / 0x-hex text file. */
async function bytesFromFile(file: File): Promise<Uint8Array> {
  const raw = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder().decode(raw).trim();
  const hex = text.replace(/^0x/i, '').replace(/\s+/g, '');
  if (hex.length > 0 && hex.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hex)) return preimageToBytes(hex);
  return raw;
}

export function IntentDetailView({
  view,
  timeline,
  slot,
  cluster,
  signer,
  actions,
}: {
  view: IntentView;
  timeline: IntentTimelineItem[];
  slot: bigint;
  cluster: Cluster;
  signer?: TransactionSigner;
  actions: Actions;
}) {
  const me = signer?.address ? String(signer.address) : undefined;
  const es = viewEffectiveStatus(view, slot);
  const crit = criterionLabel(view.criterionProgram, cluster);
  const act = viewActionFor(view, { wallet: me, currentSlot: slot });

  const hashlockPid = getCluster(cluster).programs.hashlock;
  const validityPid = getCluster(cluster).programs.validity;
  const isHashlock = view.criterionProgram === hashlockPid;
  const isValidity = view.criterionProgram === validityPid;

  const shareUrl = intentShareLink(view.pda as any, cluster);

  const parties: Array<[string, string]> = [
    ['maker', view.maker],
    ['receiver', view.receiver],
    ['refund recipient', view.refundRecipient],
  ];

  // timeline rows from indexer items, plus a synthetic settlement/awaiting row
  const term = view.closed
    ? 'Closed'
    : view.status === 'Fulfilled'
      ? 'Fulfilled'
      : view.status === 'Refunded'
        ? 'Refunded'
        : null;

  return (
    <div className={styles.detailGrid}>
      <div>
        <div className={styles.panel}>
          <div className={styles.detailTop}>
            <div>
              <div className={styles.detailAmt}>
                <AssetAmount amount={view.amount} asset={view.asset} />
              </div>
              <div className={styles.crit}>
                <Icon icon="eva:shield-outline" />
                {crit.name}
              </div>
            </div>
            <IntentStatusBadge status={es} />
          </div>
          <div className={styles.ids}>
            intent {view.pda} · program {shortPid(view.criterionProgram)}
          </div>
        </div>

        <div className={styles.panel}>
          <h2>Parties</h2>
          {parties.map(([role, addr]) => (
            <div key={role} className={styles.party}>
              <span className={styles.role}>{role}</span>
              <span className={styles.addr}>
                {addr}
                {me && addr === me && <span className={styles.you}>YOU</span>}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.panel}>
          <h2>Timeline</h2>
          <div className={styles.timeline}>
            <div className={`${styles.tlItem} ${styles.done}`}>
              <div className={styles.tlt}>Created</div>
              <div className={styles.tls}>slot {String(view.createdSlot)}</div>
            </div>
            {timeline
              .filter((t) => t.kind.toLowerCase() !== 'created')
              .map((t, i) => (
                <div key={`${t.kind}-${i}`} className={`${styles.tlItem} ${styles.done}`}>
                  <div className={styles.tlt}>{t.kind}</div>
                  <div className={styles.tls}>
                    slot {t.slot} ·{' '}
                    <a href={explorerTxUrl(t.signature, cluster)} target="_blank" rel="noreferrer">
                      {t.signature.slice(0, 8)}…
                    </a>
                  </div>
                </div>
              ))}
            {term ? null : (
              <div className={`${styles.tlItem} ${styles.future}`}>
                <div className={styles.tlt}>Settlement</div>
                <div className={styles.tls}>
                  awaiting {isHashlock ? 'preimage reveal' : isValidity ? 'validity proof' : 'criterion'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className={`${styles.panel} ${styles.actionPanel}`}>
          <ActionPanel
            view={view}
            act={act}
            isHashlock={isHashlock}
            isValidity={isValidity}
            signer={signer}
            actions={actions}
          />
        </div>

        <div className={styles.panel}>
          <h2>Share</h2>
          <div className={styles.shareRow}>
            <input readOnly value={shareUrl} aria-label="Share link" />
            <CopyButton value={shareUrl} className={styles.copyBtn} />
          </div>
          <div className={styles.hint} style={{ marginTop: 10 }}>
            Links carry only the intent address + cluster. Secrets never travel in a URL.
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionPanel({
  view,
  act,
  isHashlock,
  isValidity,
  signer,
  actions,
}: {
  view: IntentView;
  act: ReturnType<typeof viewActionFor>;
  isHashlock: boolean;
  isValidity: boolean;
  signer?: TransactionSigner;
  actions: Actions;
}) {
  const { busy } = actions;
  const [preimage, setPreimage] = React.useState('');
  const [proofHex, setProofHex] = React.useState('');
  const [proofFile, setProofFile] = React.useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [suffixHex, setSuffixHex] = React.useState('');
  const [err, setErr] = React.useState<string | undefined>(undefined);

  if (!signer) {
    return (
      <>
        <h2>Status</h2>
        <p className={styles.hint} style={{ margin: 0 }}>
          Connect your wallet to act on this intent.
        </p>
      </>
    );
  }

  if (act.kind === 'fulfill' && isHashlock) {
    return (
      <>
        <h2>Fulfill · reveal preimage</h2>
        <div className={styles.warnBox}>
          <Icon icon="eva:alert-triangle-outline" />
          <p>
            Revealing the preimage is <strong>public and irreversible</strong> — it lands in
            transaction calldata on-chain.
          </p>
        </div>
        <div className={styles.field}>
          <label htmlFor="preimage">Preimage (secret)</label>
          <textarea
            id="preimage"
            placeholder="paste 32-byte secret (hex or base58)"
            value={preimage}
            onChange={(e) => setPreimage(e.target.value)}
          />
          {err && <div className={styles.hint} style={{ color: 'var(--warn)' }}>{err}</div>}
        </div>
        <button
          type="button"
          className={`${styles.actBtn} ${styles.bigBtn}`}
          disabled={!act.enabled || busy || preimage.trim() === ''}
          onClick={() => {
            try {
              setErr(undefined);
              actions.fulfillHashlock(preimageToBytes(preimage), signer);
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Invalid preimage');
            }
          }}
        >
          Reveal & fulfill
        </button>
        <div className={styles.hint}>
          Releases the escrow to the receiver atomically if SHA256(secret) matches the hashlock.
        </div>
        {act.reason && <div className={styles.hint}>{act.reason}</div>}
      </>
    );
  }

  if (act.kind === 'fulfill' && isValidity) {
    return (
      <>
        <h2>Fulfill · validity proof</h2>
        <div className={styles.field}>
          <label htmlFor="proof">Groth16 proof</label>
          <textarea
            id="proof"
            placeholder="proof bytes (hex) — or upload a file below"
            value={proofHex}
            onChange={(e) => { setProofHex(e.target.value); setProofFile(null); }}
          />
          <div className={styles.fileRow}>
            <label className={styles.fileBtn}>
              <Icon icon="eva:upload-outline" /> Upload proof file
              <input
                type="file"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = ''; // allow re-selecting the same file
                  if (!f) return;
                  try {
                    setErr(undefined);
                    setProofFile({ name: f.name, bytes: await bytesFromFile(f) });
                    setProofHex('');
                  } catch {
                    setErr('Could not read that file');
                  }
                }}
              />
            </label>
            {proofFile && (
              <span className={styles.fileChip}>
                <Icon icon="eva:file-text-outline" />
                {proofFile.name} · {proofFile.bytes.length} bytes
                <button type="button" aria-label="Remove proof file" onClick={() => setProofFile(null)}>
                  <Icon icon="eva:close-outline" />
                </button>
              </span>
            )}
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="suffix">Public-input suffix</label>
          <input
            id="suffix"
            placeholder="0x… (optional)"
            value={suffixHex}
            onChange={(e) => setSuffixHex(e.target.value)}
          />
          {err && <div className={styles.hint} style={{ color: 'var(--warn)' }}>{err}</div>}
        </div>
        <button
          type="button"
          className={`${styles.actBtn} ${styles.bigBtn}`}
          disabled={!act.enabled || busy || (!proofFile && proofHex.trim() === '')}
          onClick={() => {
            try {
              setErr(undefined);
              const proof = proofFile ? proofFile.bytes : preimageToBytes(proofHex);
              actions.fulfillValidity(proof, preimageToBytes(suffixHex || ''), signer);
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Invalid proof bytes');
            }
          }}
        >
          Submit proof & fulfill
        </button>
        <div className={styles.hint}>
          The ValidityConfig PDA is passed as the single criterion account. A proof file may be raw
          bytes (.bin) or hex text.
        </div>
        {act.reason && <div className={styles.hint}>{act.reason}</div>}
      </>
    );
  }

  if (act.kind === 'refund') {
    return (
      <>
        <h2>Refund · expired intent</h2>
        <div className={styles.warnBox}>
          <Icon icon="eva:clock-outline" />
          <p>
            This intent passed its expiry slot unfulfilled. Refund is a permissionless crank — funds
            return to the refund recipient.
          </p>
        </div>
        <button
          type="button"
          className={`${styles.actBtn} ${styles.bigBtn} ${styles.ghost}`}
          disabled={!act.enabled || busy}
          onClick={() => actions.refund(signer)}
        >
          Refund to {shortPid(view.refundRecipient)}
        </button>
        {act.reason && <div className={styles.hint}>{act.reason}</div>}
      </>
    );
  }

  if (act.kind === 'close') {
    return (
      <>
        <h2>Close · reclaim rent</h2>
        <p className={styles.hint} style={{ margin: '0 0 16px' }}>
          This intent is {view.status.toLowerCase()}. As maker you can close the account to reclaim
          rent{view.asset.kind === 'SplToken' ? ' and close the SPL vault' : ''}.
        </p>
        <button
          type="button"
          className={`${styles.actBtn} ${styles.bigBtn} ${styles.neutral}`}
          disabled={!act.enabled || busy}
          onClick={() => actions.close(signer)}
        >
          Close intent
        </button>
        {act.reason && <div className={styles.hint}>{act.reason}</div>}
      </>
    );
  }

  return (
    <>
      <h2>Status</h2>
      <p className={styles.hint} style={{ margin: 0 }}>
        {act.reason ?? 'No action is available to your wallet for this intent right now.'}
      </p>
    </>
  );
}
