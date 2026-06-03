import * as React from 'react';
import { CopyButton, useToast } from '@laplace/ui';
import { useClient, useLaplaceContext } from '@laplace/sdk/react';
import { mapLaplaceError } from '@laplace/sdk';
import { hexToBytes, toBytes32Hex } from './createState';
import styles from './ValidityNew.module.css';

export default function ValidityNew() {
  const client = useClient();
  const { signer } = useLaplaceContext();
  const { toast } = useToast();

  const [elfHash, setElfHash] = React.useState('');
  const [vkeyHash, setVkeyHash] = React.useState('');
  const [fixedInputs, setFixedInputs] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [resultHash, setResultHash] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signer) { toast('Connect your wallet first', 'error'); return; }

    const elfBytes = hexToBytes(elfHash);
    const vkeyBytes = hexToBytes(vkeyHash);
    const fixedBytes = hexToBytes(fixedInputs);

    setBusy(true);
    try {
      const res = await client.createValidityConfig(
        { guestElfHash: elfBytes, sp1VkeyHash: vkeyBytes, fixedPublicInputs: fixedBytes },
        { payer: signer },
      );
      const hash = toBytes32Hex(res.configHash);
      setResultHash(hash);
      toast(`Config created · ${hash.slice(0, 8)}…`);
    } catch (e) {
      toast(mapLaplaceError(e).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <h1>New Validity Config</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        Register an SP1 verifying key + guest ELF hash as a reusable on-chain validity criterion.
      </p>

      <div className={styles.panel}>
        <h2>Parameters</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="elf-hash">Guest ELF Hash (hex, 32 bytes)</label>
            <input
              id="elf-hash"
              type="text"
              spellCheck={false}
              placeholder="0000…0000 (64 hex chars)"
              value={elfHash}
              onChange={(e) => setElfHash(e.target.value)}
            />
            <div className={styles.hint}>
              The SHA-256 hash of your SP1 guest program ELF binary.
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="vkey-hash">SP1 Verifying Key Hash (hex, 32 bytes)</label>
            <input
              id="vkey-hash"
              type="text"
              spellCheck={false}
              placeholder="0000…0000 (64 hex chars)"
              value={vkeyHash}
              onChange={(e) => setVkeyHash(e.target.value)}
            />
            <div className={styles.hint}>
              Obtained from <code>vk.bytes32()</code> in the SP1 SDK.
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="fixed-inputs">Fixed Public Inputs (hex)</label>
            <textarea
              id="fixed-inputs"
              spellCheck={false}
              placeholder="Hex-encoded fixed public inputs (may be empty: leave blank)"
              value={fixedInputs}
              onChange={(e) => setFixedInputs(e.target.value)}
            />
            <div className={styles.hint}>
              Portion of the public inputs that are fixed at config creation time.
              Leave empty if all inputs are dynamic.
            </div>
          </div>

          {!signer && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Connect your wallet to create a validity config.
            </p>
          )}

          <button
            type="submit"
            className="btn btn--accent"
            style={{ width: '100%', height: 48, fontSize: 15 }}
            disabled={busy || !signer}
          >
            {busy ? 'Creating…' : 'Create validity config'}
          </button>
        </form>

        {resultHash && (
          <div className={styles.resultPanel}>
            <h2>Config Hash</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Copy this hash and use it in the Create wizard → Validity recipe.
            </p>
            <div className={styles.shareRow}>
              <input
                type="text"
                readOnly
                value={resultHash}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
              <CopyButton value={resultHash} className={styles.actBtn} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
