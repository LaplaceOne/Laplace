import * as React from 'react';
import { useToast } from '@laplace/ui';
import { useLaplaceContext } from '@laplace/sdk/react';
import { mapLaplaceError } from '@laplace/sdk';
import {
  type Instruction,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  getBase16Decoder,
  compileTransaction,
  getBase64EncodedWireTransaction,
} from '@solana/kit';
import { MANUAL_INSTRUCTIONS, type ManualInstr, type Field } from './manualInstructions';
import { env } from '../../env';
import styles from './Manual.module.css';

const hex = getBase16Decoder();

/** Role number → short human flag for the serialized preview. */
const ROLE: Record<number, string> = {
  0: 'readonly',
  1: 'writable',
  2: 'readonly·signer',
  3: 'writable·signer',
};

/** Group the registry by program for the left list. */
const GROUPS: Array<{ program: ManualInstr['program']; items: ManualInstr[] }> = (
  ['laplace', 'validity', 'hashlock'] as const
).map((program) => ({ program, items: MANUAL_INSTRUCTIONS.filter((m) => m.program === program) }));

export default function Manual() {
  const { toast } = useToast();
  const { rpc, rpcSubscriptions, signer } = useLaplaceContext();

  const [sel, setSel] = React.useState<string>(MANUAL_INSTRUCTIONS[0]!.key);
  const [vals, setVals] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const instr = MANUAL_INSTRUCTIONS.find((m) => m.key === sel) ?? MANUAL_INSTRUCTIONS[0]!;
  const set = (name: string, v: string) => setVals((p) => ({ ...p, [name]: v }));

  function selectInstr(key: string) {
    setSel(key);
    setVals({});
  }

  /** A signer-aware value map: account fields equal to the signer address use the signer object. */
  function valuesForSend(): Record<string, any> {
    const v: Record<string, any> = { ...vals };
    if (signer) {
      for (const f of instr.fields) {
        if (f.account && v[f.name] && v[f.name] === signer.address) v[f.name] = signer;
      }
    }
    return v;
  }

  // Serialized preview (program address + account metas + data hex), best-effort.
  const preview = React.useMemo(() => {
    try {
      const ix = instr.build(vals) as any;
      const accounts: Array<{ address: string; role: number }> = ix.accounts ?? [];
      const data: Uint8Array = ix.data ?? new Uint8Array(0);
      return {
        ok: true as const,
        program: String(ix.programAddress),
        accounts,
        dataHex: hex.decode(data),
      };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [instr, vals]);

  async function simulate() {
    if (!signer) {
      toast('Connect your wallet first', 'error');
      return;
    }
    setBusy(true);
    try {
      const ix = instr.build(valuesForSend()) as Instruction;
      const { value: blockhash } = await rpc.getLatestBlockhash().send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(signer, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
        (tx) => appendTransactionMessageInstruction(ix, tx),
      );
      const compiled = compileTransaction(message as any);
      const wire = getBase64EncodedWireTransaction(compiled as any);
      const res = await rpc
        .simulateTransaction(wire, { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true })
        .send();
      if (res.value?.err) {
        toast(`Simulation error · ${JSON.stringify(res.value.err)}`, 'error');
      } else {
        const units = res.value?.unitsConsumed ? ` · ${String(res.value.unitsConsumed)} CU` : '';
        toast(`Simulated — no errors${units}`);
      }
    } catch (e) {
      toast(mapLaplaceError(e).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!signer) {
      toast('Connect your wallet first', 'error');
      return;
    }
    setBusy(true);
    try {
      const ix = instr.build(valuesForSend()) as Instruction;
      const { value: blockhash } = await rpc.getLatestBlockhash().send();
      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(signer, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
        (tx) => appendTransactionMessageInstruction(ix, tx),
      );
      const signed = await signTransactionMessageWithSigners(message);
      const signature = getSignatureFromTransaction(signed);
      await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signed as any, { commitment: 'confirmed' });
      toast(`Instruction sent · ${signature.slice(0, 8)}…`);
    } catch (e) {
      toast(mapLaplaceError(e).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wrap">
      <div>
        <h1>Manual operations</h1>
        <p>Power-user escape hatch — build, serialize, simulate, and send any protocol instruction on {env.cluster}.</p>
      </div>

      <div className={styles.manualGrid}>
        <div className={styles.instrList}>
          {GROUPS.map((g) => (
            <React.Fragment key={g.program}>
              <div className={styles.instrGroup}>{g.program}</div>
              {g.items.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`${styles.instrItem} ${sel === m.key ? styles.active : ''}`}
                  onClick={() => selectInstr(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div>
          <div className={styles.detailTop}>
            <div>
              <div className={styles.title}>{instr.label}</div>
              <div className={styles.prog}>program · {instr.program}</div>
            </div>
            <span className={styles.crit}>{instr.fields.filter((f) => f.account).length} accounts</span>
          </div>

          {instr.fields.length === 0 ? (
            <div className={styles.hint}>This instruction takes no accounts or arguments.</div>
          ) : (
            instr.fields.map((f) => <FieldInput key={f.name} field={f} value={vals[f.name] ?? ''} onChange={(v) => set(f.name, v)} />)
          )}

          <div className={styles.field}>
            <label>Serialized instruction</label>
            {preview.ok ? (
              <div className={styles.serialized}>
                <div>
                  <span className={styles.k}>program</span> {preview.program}
                </div>
                {preview.accounts.map((a, i) => (
                  <div key={i}>
                    <span className={styles.k}>[{i}]</span> {a.address} · {ROLE[a.role] ?? `role ${a.role}`}
                  </div>
                ))}
                <div>
                  <span className={styles.k}>data</span> {preview.dataHex || '(empty)'}
                </div>
              </div>
            ) : (
              <div className={styles.serialized}>Cannot serialize yet — {preview.error}</div>
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" className={`${styles.actBtn} ${styles.neutral}`} disabled={busy || !signer} onClick={simulate}>
              {busy ? 'Working…' : 'Simulate'}
            </button>
            <button type="button" className={styles.actBtn} disabled={busy || !signer} onClick={send}>
              {signer ? 'Send' : 'Connect wallet'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const placeholder =
    field.kind === 'address'
      ? 'pubkey'
      : field.kind === 'bytes'
        ? 'hex (optionally 0x-prefixed)'
        : field.kind === 'u64'
          ? 'integer'
          : 'u8 (0–255)';
  const label = `${field.name}${field.account ? ' · account' : ''} · ${field.kind}`;
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.trim())} />
    </div>
  );
}
